/**
 * GelRenderer - Canvas-based agarose gel electrophoresis visualization
 * Renders realistic gel images with wells, DNA bands, ladder lanes,
 * and size annotations on an HTML5 Canvas element.
 */
class GelRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.dpr = window.devicePixelRatio || 1;

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
      bandColor: 'rgba(80, 40, 180, 0.85)',
      bandSmearColor: 'rgba(80, 40, 180, 0.3)',
      gelBgColor: '#0a0a2e',
      gelBorderColor: '#333366',
      wellColor: '#000015',
      ladderColor: 'rgba(180, 140, 255, 0.7)',
      labelColor: '#ccccdd',
      sizeLabelColor: '#aaaacc',
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

    modal.classList.add('show');
  }

  _createInfoPanel(result) {
    const panel = document.createElement('div');
    panel.className = 'gel-info-panel';
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
    `;
    return panel;
  }

  _createControlsPanel(result) {
    const panel = document.createElement('div');
    panel.className = 'gel-controls-panel';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-secondary gel-export-btn';
    exportBtn.innerHTML = '<i class="fas fa-download"></i> Export PNG';
    exportBtn.addEventListener('click', () => this._exportPNG());

    const sizeTable = this._createSizeTable(result);

    panel.appendChild(exportBtn);
    panel.appendChild(sizeTable);
    return panel;
  }

  _createSizeTable(result) {
    const table = document.createElement('div');
    table.className = 'gel-size-table';

    const sortedFragments = result.fragmentSizes.map((size, i) => ({ index: i + 1, size }));
    sortedFragments.sort((a, b) => b.size - a.size);

    let rows = sortedFragments.map(f =>
      `<tr><td>${f.index}</td><td>${f.size.toLocaleString()} bp</td></tr>`
    ).join('');

    table.innerHTML = `
      <div class="gel-size-table-title">Fragment Sizes</div>
      <table>
        <thead><tr><th>#</th><th>Size</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    return table;
  }

  _drawGel(result) {
    const { ctx, layout } = this;
    const { gelLeft, gelRight, gelTop, gelBottom } = layout;

    ctx.fillStyle = '#f5f5f8';
    ctx.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight);

    this._drawGelBackground();
    this._drawGelGradient();

    const hasLadder = result.showLadder && result.ladderBands && result.ladderBands.length > 0;
    const numLanes = 1 + (hasLadder ? 1 : 0);
    const gelWidth = gelRight - gelLeft;
    const laneAreaWidth = gelWidth - (numLanes + 1) * layout.laneSpacing;
    const laneWidth = Math.min(layout.ladderLaneWidth, laneAreaWidth / numLanes);

    let currentX = gelLeft + layout.laneSpacing;

    if (hasLadder) {
      this._drawLane(currentX, laneWidth, result.ladderBands, true, result.ladderSizes);
      currentX += laneWidth + layout.laneSpacing;
    }

    this._drawLane(currentX, laneWidth, result.bands, false, result.fragmentSizes);
    this._drawLaneLabel(currentX, laneWidth, result.label || 'Digest');

    if (hasLadder) {
      this._drawLaneLabel(gelLeft + layout.laneSpacing, laneWidth, 'Ladder');
    }

    this._drawGelBorder();
    this._drawSizeScale(result);
  }

  _drawGelBackground() {
    const { ctx, layout } = this;
    const { gelLeft, gelRight, gelTop, gelBottom } = layout;

    ctx.fillStyle = layout.gelBgColor;
    ctx.fillRect(gelLeft, gelTop, gelRight - gelLeft, gelBottom - gelTop);
  }

  _drawGelGradient() {
    const { ctx, layout } = this;
    const { gelLeft, gelRight, gelTop, gelBottom } = this.layout;

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
    const { ctx, layout } = this;
    const { gelLeft, gelRight, gelTop, gelBottom } = layout;

    ctx.strokeStyle = layout.gelBorderColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gelLeft, gelTop, gelRight - gelLeft, gelBottom - gelTop);
  }

  _drawLane(x, width, bands, isLadder, sizes) {
    const { ctx, layout } = this;
    const { gelTop, gelBottom, wellDepth } = layout;

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

      const normalizedPos = band.normalizedPosition !== undefined
        ? band.normalizedPosition
        : band.migrationDistance / layout.wellToBottomDistance;

      const yPos = gelTop + wellDepth + normalizedPos * gelHeight;

      if (yPos < gelTop + wellDepth || yPos > gelBottom - 2) continue;

      const intensity = band.intensity || 1.0;
      const bandWidth = band.bandWidth || 0.3;
      const pixelHeight = Math.max(1.5, bandWidth * 8);

      if (isLadder) {
        this._drawBand(bandCenterX, yPos, width * 0.7, pixelHeight, layout.ladderColor, intensity, false);
      } else if (band.isSmear) {
        this._drawSmearBand(bandCenterX, yPos, width * 0.7, pixelHeight * 3, layout.bandSmearColor, intensity);
        this._drawBand(bandCenterX, yPos, width * 0.5, pixelHeight, layout.bandColor, intensity * 0.6, false);
      } else {
        this._drawBand(bandCenterX, yPos, width * 0.7, pixelHeight, layout.bandColor, intensity, false);
      }
    }

    if (isLadder && sizes) {
      this._drawLadderSizeLabels(x, width, bands, sizes, gelHeight);
    }
  }

  _drawBand(cx, cy, halfWidth, height, color, intensity, glow) {
    const { ctx } = this;

    ctx.save();

    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
    }

    const gradient = ctx.createLinearGradient(cx - halfWidth, cy, cx + halfWidth, cy);
    const baseAlpha = 0.3 * intensity;
    gradient.addColorStop(0, `rgba(80, 40, 180, ${baseAlpha})`);
    gradient.addColorStop(0.15, `rgba(90, 50, 200, ${0.7 * intensity})`);
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(0.85, `rgba(90, 50, 200, ${0.7 * intensity})`);
    gradient.addColorStop(1, `rgba(80, 40, 180, ${baseAlpha})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(cx - halfWidth, cy - height / 2, halfWidth * 2, height);

    ctx.restore();
  }

  _drawSmearBand(cx, cy, halfWidth, height, color, intensity) {
    const { ctx } = this;

    const gradient = ctx.createLinearGradient(cx, cy - height / 2, cx, cy + height / 2);
    gradient.addColorStop(0, 'rgba(80, 40, 180, 0.0)');
    gradient.addColorStop(0.3, `rgba(80, 40, 180, ${0.15 * intensity})`);
    gradient.addColorStop(0.5, `rgba(80, 40, 180, ${0.25 * intensity})`);
    gradient.addColorStop(0.7, `rgba(80, 40, 180, ${0.15 * intensity})`);
    gradient.addColorStop(1, 'rgba(80, 40, 180, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(cx - halfWidth, cy - height / 2, halfWidth * 2, height);
  }

  _drawLadderSizeLabels(laneX, laneWidth, bands, sizes, gelHeight) {
    const { ctx, layout } = this;
    const { gelTop, wellDepth } = layout;

    ctx.save();
    ctx.font = '9px monospace';
    ctx.fillStyle = layout.sizeLabelColor;
    ctx.textAlign = 'right';

    for (let i = 0; i < bands.length && i < sizes.length; i++) {
      const band = bands[i];
      const size = sizes[i];
      if (!band || !size || size <= 0) continue;

      const normalizedPos = band.normalizedPosition !== undefined
        ? band.normalizedPosition
        : band.migrationDistance / layout.gelTop;

      const yPos = gelTop + wellDepth + normalizedPos * gelHeight;

      if (yPos < gelTop + wellDepth + 5 || yPos > layout.gelBottom - 5) continue;

      const label = size >= 1000 ? `${(size / 1000).toFixed(size % 1000 === 0 ? 0 : 1)}kb` : `${size}bp`;
      ctx.fillText(label, laneX - 4, yPos + 3);
    }

    ctx.restore();
  }

  _drawLaneLabel(x, width, label) {
    const { ctx, layout } = this;

    ctx.save();
    ctx.font = '10px sans-serif';
    ctx.fillStyle = layout.labelColor;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + width / 2, layout.gelTop - 8);
    ctx.restore();
  }

  _drawSizeScale(result) {
    const { ctx, layout } = this;
    const { gelLeft, gelRight, gelBottom } = layout;

    if (!result.ladderBands || result.ladderBands.length === 0) return;

    ctx.save();
    ctx.font = '9px monospace';
    ctx.fillStyle = '#888899';
    ctx.textAlign = 'center';

    const scaleSizes = [10000, 5000, 2000, 1000, 500, 200, 100];
    const gelConfig = result.gelConfig;

    for (const size of scaleSizes) {
      if (size < gelConfig.effectiveRange[0] * 0.5 || size > gelConfig.effectiveRange[1] * 2) continue;

      const logMW = Math.log10(size);
      const { a, b, wellToBottom } = this._getGelParamsFromResult(result);
      const migration = a - b * logMW;
      const normalizedPos = Math.max(0, Math.min(1, migration / wellToBottom));

      const yPos = layout.gelTop + layout.wellDepth + normalizedPos * (layout.gelBottom - layout.gelTop - layout.wellDepth);

      if (yPos < layout.gelTop + 15 || yPos > layout.gelBottom - 5) continue;

      ctx.strokeStyle = 'rgba(100, 100, 140, 0.2)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(gelLeft, yPos);
      ctx.lineTo(gelRight, yPos);
      ctx.stroke();

      const label = size >= 1000 ? `${size / 1000}kb` : `${size}bp`;
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
          return { a, b, wellToBottom: Math.max(a, 12) };
        }
      }
    }
    return { a: 9.5, b: 2.7, wellToBottom: 12 };
  }

  _exportPNG() {
    if (!this.canvas) return;

    const link = document.createElement('a');
    link.download = 'gel_electrophoresis.png';
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }
}

if (typeof window !== 'undefined') {
  window.GelRenderer = GelRenderer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GelRenderer;
}
