/** Renders the coverage band for the aligned reads track. */
class AlignmentCoverageRenderer {
  constructor(trackRenderer) {
    this.trackRenderer = trackRenderer;
  }

  async getBamDepthForViewport(chromosome, viewport, settings, bamFile, signal) {
    if (!this.trackRenderer.isReadsComponentVisible(settings, 'showCoverage', 'readsCoverage')) return null;
    viewport = { ...viewport, start: Math.floor(viewport.start), end: Math.ceil(viewport.end) };
    const { reader } = bamFile;
    if (typeof reader.getDepthForRange !== 'function') return null;
    const segments = this.trackRenderer.isCircularModeEnabled()
      ? this.trackRenderer.getViewportSegments(viewport, chromosome)
      : [
          {
            sourceStart: Math.max(0, viewport.start),
            sourceEnd: viewport.end,
            displayStart: Math.max(0, viewport.start),
          },
        ];
    try {
      let depth = null;
      for (const { sourceStart, sourceEnd, displayStart } of segments) {
        if (sourceEnd <= sourceStart) continue;
        const segment = await reader.getDepthForRange(
          chromosome,
          sourceStart,
          sourceEnd,
          { start: viewport.start, end: viewport.end, offset: displayStart - sourceStart },
          settings,
          signal
        );
        if (!depth) {
          depth = segment;
        } else {
          segment.alignedBases.forEach((count, index) => {
            depth.alignedBases[index] += count;
          });
        }
      }
      return depth;
    } catch (error) {
      signal?.throwIfAborted();
      console.warn('Could not load BAM alignment depth:', error.message);
      return null;
    }
  }

  /**
   * Create coverage visualization above reads
   */
  createCoverageVisualization(trackContent, reads, viewport, coverageHeight, settings, depth = null) {
    if (depth) viewport = { ...viewport, start: Math.floor(viewport.start), end: Math.ceil(viewport.end) };
    const range = viewport.end - viewport.start;
    const binSize = depth?.binSize ?? Math.max(1, Math.floor(range / 1000));
    const coverageData = depth
      ? depth.alignedBases.map((count, index) => count / Math.min(binSize, range - index * binSize))
      : this.calculateCoverage(reads, viewport.start, viewport.end);
    if (!coverageData.length) return;
    const maxCoverage = Math.max(...coverageData);
    const coverageLabel = depth
      ? 'Mean aligned depth per bin'
      : reads._sourceSamplingInfo
        ? 'Sampled read overlaps per bin'
        : 'Read overlaps per bin';

    // Create coverage container
    const coverageContainer = document.createElement('div');
    coverageContainer.className = 'coverage-visualization';
    coverageContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: ${coverageHeight}px;
            background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
            border-bottom: 1px solid #dee2e6;
            margin-bottom: 0;
            overflow: visible;
            z-index: 120;
        `;

    // Create SVG for coverage visualization
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', coverageHeight);
    svg.setAttribute('viewBox', `0 0 100 ${coverageHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'coverage-svg');
    svg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';

    // Create coverage path
    let pathData = `M 0 ${coverageHeight}`;
    for (let i = 0; i < coverageData.length; i++) {
      const left = (i * binSize * 100) / range;
      const right = Math.min(100, ((i + 1) * binSize * 100) / range);
      const y = coverageHeight - (coverageData[i] / (maxCoverage || 1)) * (coverageHeight - 5);
      pathData += ` L ${left} ${y} L ${right} ${y}`;
    }
    pathData += ` L 100 ${coverageHeight} Z`;

    const coveragePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    coveragePath.setAttribute('d', pathData);
    coveragePath.setAttribute('fill', settings.coverageColor || '#4a90e2');
    coveragePath.setAttribute('fill-opacity', '0.6');
    coveragePath.setAttribute('stroke', settings.coverageStrokeColor || '#2c5aa0');
    coveragePath.setAttribute('stroke-width', '1');
    coveragePath.setAttribute('vector-effect', 'non-scaling-stroke');

    svg.appendChild(coveragePath);
    coverageContainer.appendChild(svg);

    // Add coverage statistics
    const avgCoverage = depth
      ? (depth.alignedBases.reduce((sum, value) => sum + value, 0) / range).toFixed(1)
      : (coverageData.reduce((sum, value) => sum + value, 0) / coverageData.length).toFixed(1);
    const formatDepth = value => String(Number(value.toFixed(2)));
    const statsDiv = document.createElement('div');
    statsDiv.className = 'coverage-stats';
    statsDiv.style.cssText = `
            position: absolute;
            top: 5px;
            right: 10px;
            background: rgba(255,255,255,0.9);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            color: #666;
            border: 1px solid #ddd;
        `;
    statsDiv.textContent = `${coverageLabel} · Max: ${formatDepth(maxCoverage)} | Avg: ${avgCoverage}`;
    coverageContainer.appendChild(statsDiv);

    this.addCoverageTooltip(
      coverageContainer,
      svg,
      coverageData,
      viewport,
      binSize,
      formatDepth(maxCoverage),
      avgCoverage,
      coverageLabel
    );
    trackContent.appendChild(coverageContainer);
  }

  /**
   * Add position-specific hover information to the aligned-reads coverage band.
   */
  addCoverageTooltip(container, svg, coverageData, viewport, binSize, maxCoverage, avgCoverage, coverageLabel) {
    if (!coverageData.length) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'coverage-tooltip track-data-tooltip';
    container.appendChild(tooltip);

    svg.addEventListener('mousemove', e => {
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0) return;

      const relativeX = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
      const ratio = relativeX / rect.width;
      const range = viewport.end - viewport.start;
      const index = Math.min(Math.floor((ratio * range) / binSize), coverageData.length - 1);
      const binStart = Math.floor(viewport.start + index * binSize);
      const binEnd = Math.max(binStart, Math.min(viewport.end - 1, Math.ceil(binStart + binSize) - 1));
      const position = Math.min(viewport.end - 1, Math.floor(viewport.start + ratio * range));
      const sequenceLength = this.trackRenderer.getSequenceLength();
      const toDisplayPosition = sourcePosition => {
        const normalized =
          this.trackRenderer.isCircularModeEnabled() && sequenceLength > 0
            ? this.trackRenderer.normalizeCircularPosition(sourcePosition, sequenceLength)
            : sourcePosition;
        return normalized + 1;
      };

      tooltip.innerHTML = `
                <div class="track-data-tooltip__title">Position: ${toDisplayPosition(position).toLocaleString()}</div>
                <div><span class="track-data-tooltip__label">${coverageLabel}:</span> ${Number(coverageData[index].toFixed(2))}</div>
                <div class="track-data-tooltip__meta">
                    Bin: ${toDisplayPosition(binStart).toLocaleString()}-${toDisplayPosition(binEnd).toLocaleString()}<br>
                    Max: ${maxCoverage} · Avg: ${avgCoverage}
                </div>
            `;
      tooltip.style.display = 'block';

      const containerRect = container.getBoundingClientRect();
      const tooltipWidth = tooltip.offsetWidth || 190;
      const tooltipHeight = tooltip.offsetHeight || 70;
      const tooltipX = Math.min(Math.max(relativeX + 10, 8), Math.max(8, containerRect.width - tooltipWidth - 8));
      const tooltipY = Math.max(
        6,
        Math.min(e.clientY - containerRect.top - tooltipHeight - 8, containerRect.height - tooltipHeight - 6)
      );

      tooltip.style.left = `${tooltipX}px`;
      tooltip.style.top = `${tooltipY}px`;
    });

    svg.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }

  /**
   * Calculate coverage data for visualization
   */
  calculateCoverage(reads, start, end) {
    const range = end - start;
    const binSize = Math.max(1, Math.floor(range / 1000)); // 1000 bins max
    const numBins = Math.ceil(range / binSize);
    const coverage = new Array(numBins).fill(0);

    // Each read changes the coverage at just two boundaries. A prefix
    // sum then restores the existing inclusive bin counts.
    reads.forEach(read => {
      const readStart = Math.max(read.start, start);
      const readEnd = Math.min(read.end, end);

      if (readStart <= readEnd) {
        const startBin = Math.floor((readStart - start) / binSize);
        const endBin = Math.min(Math.floor((readEnd - start) / binSize), numBins - 1);
        if (startBin <= endBin) {
          coverage[startBin]++;
          if (endBin + 1 < numBins) coverage[endBin + 1]--;
        }
      }
    });

    for (let bin = 1; bin < numBins; bin++) {
      coverage[bin] += coverage[bin - 1];
    }
    return coverage;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AlignmentCoverageRenderer;
} else {
  window.AlignmentCoverageRenderer = AlignmentCoverageRenderer;
}
