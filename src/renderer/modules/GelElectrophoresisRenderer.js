/**
 * GelElectrophoresisRenderer - SVG-based virtual gel electrophoresis visualization
 * Renders restriction digest fragment patterns as a gel image with:
 * - Molecular weight ladder (marker lane)
 * - Multiple enzyme digest lanes
 * - Fragment bands sized by log-scale migration
 * - Band intensity simulation based on fragment count
 */
class GelElectrophoresisRenderer {
  constructor(options = {}) {
    this.laneWidth = options.laneWidth || 80;
    this.laneGap = options.laneGap || 12;
    this.gelHeight = options.gelHeight || 500;
    this.topMargin = options.topMargin || 50;
    this.bottomMargin = options.bottomMargin || 40;
    this.leftMargin = options.leftMargin || 80;
    this.bandColor = options.bandColor || '#1a1a2e';
    this.bandOpacity = options.bandOpacity || 0.85;
    this.gelBgColor = options.gelBgColor || '#0a0a14';
    this.markerColor = options.markerColor || '#e74c3c';
    this.labelColor = options.labelColor || '#ecf0f1';
    this.ladderRungs = options.ladderRungs || [1000, 2000, 3000, 5000, 7000, 10000, 15000, 20000, 30000, 50000];
  }

  render(digestResult, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[GelElectrophoresisRenderer] Container #${containerId} not found`);
      return;
    }

    const lanes = this._prepareLanes(digestResult);
    const svg = this._buildSVG(lanes, digestResult);
    container.innerHTML = svg;
  }

  renderToSVGString(digestResult) {
    const lanes = this._prepareLanes(digestResult);
    return this._buildSVG(lanes, digestResult);
  }

  _prepareLanes(digestResult) {
    const lanes = [];

    lanes.push({
      label: 'Ladder',
      isLadder: true,
      fragments: this.ladderRungs.map(size => ({ length: size })),
    });

    if (digestResult.enzymes && digestResult.fragmentDetails) {
      const enzymeLabel = digestResult.enzymes.join(' + ');
      lanes.push({
        label: enzymeLabel,
        isLadder: false,
        fragments: digestResult.fragmentDetails,
      });
    }

    return lanes;
  }

  renderMultiDigest(digestResults, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[GelElectrophoresisRenderer] Container #${containerId} not found`);
      return;
    }

    const lanes = this._prepareMultiLanes(digestResults);
    const svg = this._buildSVG(lanes, digestResults[0]);
    container.innerHTML = svg;
  }

  _prepareMultiLanes(digestResults) {
    const lanes = [];

    lanes.push({
      label: 'Ladder',
      isLadder: true,
      fragments: this.ladderRungs.map(size => ({ length: size })),
    });

    for (const result of digestResults) {
      if (result.enzymes && result.fragmentDetails) {
        lanes.push({
          label: result.enzymes.join(' + '),
          isLadder: false,
          fragments: result.fragmentDetails,
        });
      }
    }

    return lanes;
  }

  _sizeToY(size, maxSize, gelDrawHeight) {
    if (size <= 0) return this.topMargin + gelDrawHeight;
    const logMax = Math.log10(maxSize || 50000);
    const logMin = Math.log10(50);
    const logSize = Math.log10(Math.max(size, 50));
    const fraction = (logMax - logSize) / (logMax - logMin);
    return this.topMargin + fraction * gelDrawHeight;
  }

  _buildSVG(lanes, digestResult) {
    const gelDrawHeight = this.gelHeight - this.topMargin - this.bottomMargin;
    const totalLanes = lanes.length;
    const totalWidth = this.leftMargin + totalLanes * (this.laneWidth + this.laneGap) + this.laneGap;

    let svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${this.gelHeight + 30}" ` +
      `viewBox="0 0 ${totalWidth} ${this.gelHeight + 30}" ` +
      `style="background:${this.gelBgColor};border-radius:8px;font-family:'Courier New',monospace;">\n`;

    svg += `  <defs>\n`;
    svg += `    <linearGradient id="gelGrad" x1="0" y1="0" x2="0" y2="1">\n`;
    svg += `      <stop offset="0%" stop-color="#1a1a2e" stop-opacity="0.3"/>\n`;
    svg += `      <stop offset="50%" stop-color="#0a0a14" stop-opacity="0.1"/>\n`;
    svg += `      <stop offset="100%" stop-color="#1a1a2e" stop-opacity="0.3"/>\n`;
    svg += `    </linearGradient>\n`;
    svg += `    <filter id="bandGlow">\n`;
    svg += `      <feGaussianBlur stdDeviation="1.5" result="blur"/>\n`;
    svg += `      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>\n`;
    svg += `    </filter>\n`;
    svg += `  </defs>\n`;

    svg += `  <rect x="0" y="0" width="${totalWidth}" height="${this.gelHeight + 30}" fill="url(#gelGrad)"/>\n`;

    svg +=
      `  <text x="${this.leftMargin / 2}" y="25" text-anchor="middle" ` +
      `fill="${this.labelColor}" font-size="11" font-weight="bold">Virtual Gel</text>\n`;

    const allSizes = lanes.flatMap(l => l.fragments.map(f => f.length));
    const maxSize = Math.max(...allSizes, ...this.ladderRungs);

    for (const rungSize of this.ladderRungs) {
      const y = this._sizeToY(rungSize, maxSize, gelDrawHeight);
      svg +=
        `  <line x1="${this.leftMargin - 5}" y1="${y}" x2="${this.leftMargin + lanes.length * (this.laneWidth + this.laneGap)}" y2="${y}" ` +
        `stroke="#333" stroke-width="0.3" stroke-dasharray="2,4"/>\n`;
      svg +=
        `  <text x="${this.leftMargin - 8}" y="${y + 4}" text-anchor="end" ` +
        `fill="${this.labelColor}" font-size="9" opacity="0.7">${this._formatSize(rungSize)}</text>\n`;
    }

    for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
      const lane = lanes[laneIdx];
      const laneX = this.leftMargin + laneIdx * (this.laneWidth + this.laneGap) + this.laneGap / 2;

      svg +=
        `  <rect x="${laneX}" y="${this.topMargin}" width="${this.laneWidth}" height="${gelDrawHeight}" ` +
        `fill="#0d0d1a" rx="2" opacity="0.8"/>\n`;

      svg +=
        `  <text x="${laneX + this.laneWidth / 2}" y="${this.gelHeight - this.bottomMargin + 18}" ` +
        `text-anchor="middle" fill="${this.labelColor}" font-size="8" font-weight="bold">` +
        `${this._truncateLabel(lane.label, 10)}</text>\n`;

      if (lane.isLadder) {
        for (const frag of lane.fragments) {
          const y = this._sizeToY(frag.length, maxSize, gelDrawHeight);
          svg +=
            `  <rect x="${laneX + 4}" y="${y - 1.5}" width="${this.laneWidth - 8}" height="3" ` +
            `fill="${this.markerColor}" opacity="0.9" rx="1"/>\n`;
        }
      } else {
        const sortedFrags = [...lane.fragments].sort((a, b) => b.length - a.length);
        const sizeCounts = new Map();
        for (const f of sortedFrags) {
          sizeCounts.set(f.length, (sizeCounts.get(f.length) || 0) + 1);
        }

        const drawnPositions = [];
        for (const frag of sortedFrags) {
          let y = this._sizeToY(frag.length, maxSize, gelDrawHeight);

          for (const drawn of drawnPositions) {
            if (Math.abs(y - drawn) < 5) {
              y += 3;
            }
          }
          drawnPositions.push(y);

          const count = sizeCounts.get(frag.length) || 1;
          const intensityBoost = Math.min(count / 3, 1);
          const bandHeight = 2 + intensityBoost * 1.5;
          const opacity = this.bandOpacity + intensityBoost * 0.1;

          svg +=
            `  <rect x="${laneX + 6}" y="${y - bandHeight / 2}" width="${this.laneWidth - 12}" height="${bandHeight}" ` +
            `fill="${this.bandColor}" opacity="${Math.min(opacity, 1)}" rx="1" filter="url(#bandGlow)"/>\n`;

          if (frag.length > 5000 || sortedFrags.indexOf(frag) < 3) {
            svg +=
              `  <text x="${laneX + this.laneWidth - 4}" y="${y + 3}" text-anchor="end" ` +
              `fill="#aaa" font-size="7">${this._formatSize(frag.length)}</text>\n`;
          }
        }
      }
    }

    if (digestResult.enzymes) {
      svg +=
        `  <text x="${totalWidth / 2}" y="${this.gelHeight + 25}" text-anchor="middle" ` +
        `fill="${this.labelColor}" font-size="9" opacity="0.6">` +
        `${digestResult.chromosome || ''} | ${digestResult.totalFragments || '?'} fragments | ` +
        `${digestResult.sizeRange || '?'}</text>\n`;
    }

    svg += `</svg>`;
    return svg;
  }

  _formatSize(bp) {
    if (bp >= 1000000) return `${(bp / 1000000).toFixed(1)}Mb`;
    if (bp >= 1000) return `${(bp / 1000).toFixed(1)}kb`;
    return `${bp}bp`;
  }

  _truncateLabel(label, maxLen) {
    return label.length > maxLen ? label.substring(0, maxLen - 1) + '…' : label;
  }
}

if (typeof window !== 'undefined') {
  window.GelElectrophoresisRenderer = GelElectrophoresisRenderer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GelElectrophoresisRenderer;
}
