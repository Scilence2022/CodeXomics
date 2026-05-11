// @ts-check
/**
 * GelElectrophoresisService - Simulates agarose gel electrophoresis
 * Works with virtual_digest results to visualize restriction fragment patterns.
 *
 * Physics model:
 * - Fragment migration distance follows: d = a - b * log10(MW)
 *   where a, b depend on gel percentage, voltage, and run time
 * - Band intensity proportional to fragment concentration (uniform by default)
 * - Band width broadens with diffusion (Gaussian spread)
 * - Smearing near well for very large fragments (>20kb at 1% gel)
 */
class GelElectrophoresisService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  async simulateGelElectrophoresis(params) {
    const {
      fragments,
      enzymes,
      gelPercentage = 1.0,
      ladderType = '1kb',
      chromosome,
      voltage = 100,
      runTime = 45,
      showLadder = true,
      label = null,
      bandColorScheme = 'ethidium_bromide',
    } = params;

    let resolvedFragments = fragments;

    if (!resolvedFragments || !Array.isArray(resolvedFragments) || resolvedFragments.length === 0) {
      if (enzymes && Array.isArray(enzymes) && enzymes.length > 0) {
        const digestResult = await this.chatManager.executeToolByName('virtual_digest', {
          enzymes,
          chromosome,
          start: params.start,
          end: params.end,
        });
        if (digestResult && digestResult.fragmentDetails) {
          resolvedFragments = digestResult.fragmentDetails;
        } else {
          throw new Error('virtual_digest did not return fragment data. Ensure a genome is loaded.');
        }
      } else {
        throw new Error('No fragment data or enzymes provided. Pass fragments from virtual_digest, or specify enzymes to auto-digest.');
      }
    }

    const fragmentSizes = resolvedFragments.map(f => f.length || f);

    const gelConfig = this._getGelConfig(gelPercentage);
    const ladderData = this._getLadderData(ladderType);

    const bands = this._calculateBands(fragmentSizes, gelConfig);

    const ladderBands = showLadder ? this._calculateBands(
      ladderData.sizes, gelConfig
    ) : [];

    const result = {
      enzymes: enzymes || [],
      chromosome: chromosome || this.app.currentChromosome || 'unknown',
      gelPercentage,
      ladderType,
      voltage,
      runTime,
      showLadder,
      label: label || (enzymes ? enzymes.join(' + ') : 'Digest'),
      bandColorScheme,
      gelConfig: {
        wellToBottomDistance: gelConfig.wellToBottom,
        effectiveRange: gelConfig.effectiveRange,
      },
      totalFragments: fragmentSizes.length,
      fragmentSizes: fragmentSizes.sort((a, b) => b - a),
      bands,
      ladderBands,
      ladderSizes: showLadder ? ladderData.sizes : [],
      estimatedRunTime: this._estimateRunTime(fragmentSizes, gelPercentage, voltage),
    };

    this._showGelVisualization(result);

    return result;
  }

  _getGelConfig(percentage) {
    const configs = {
      0.5: { a: 11.5, b: 3.8, wellToBottom: 12, effectiveRange: [1000, 30000], diffusionFactor: 0.8 },
      0.7: { a: 10.5, b: 3.2, wellToBottom: 12, effectiveRange: [800, 20000], diffusionFactor: 0.9 },
      0.8: { a: 10.0, b: 3.0, wellToBottom: 12, effectiveRange: [600, 15000], diffusionFactor: 0.95 },
      1.0: { a: 9.5, b: 2.7, wellToBottom: 12, effectiveRange: [400, 10000], diffusionFactor: 1.0 },
      1.2: { a: 9.0, b: 2.4, wellToBottom: 12, effectiveRange: [300, 7000], diffusionFactor: 1.1 },
      1.5: { a: 8.5, b: 2.1, wellToBottom: 12, effectiveRange: [200, 5000], diffusionFactor: 1.2 },
      2.0: { a: 8.0, b: 1.8, wellToBottom: 12, effectiveRange: [100, 3000], diffusionFactor: 1.4 },
      2.5: { a: 7.5, b: 1.5, wellToBottom: 12, effectiveRange: [50, 2000], diffusionFactor: 1.6 },
      3.0: { a: 7.0, b: 1.3, wellToBottom: 12, effectiveRange: [30, 1000], diffusionFactor: 1.8 },
    };

    if (configs[percentage]) return configs[percentage];

    const p = Math.max(0.5, Math.min(3.0, percentage));
    const lo = Math.floor(p * 2) / 2;
    const hi = Math.ceil(p * 2) / 2;
    if (lo === hi) return configs[lo] || configs[1.0];

    const t = (p - lo) / (hi - lo);
    const cLo = configs[lo] || configs[1.0];
    const cHi = configs[hi] || configs[1.0];
    return {
      a: cLo.a + t * (cHi.a - cLo.a),
      b: cLo.b + t * (cHi.b - cLo.b),
      wellToBottom: cLo.wellToBottom + t * (cHi.wellToBottom - cLo.wellToBottom),
      effectiveRange: [
        Math.round(cLo.effectiveRange[0] + t * (cHi.effectiveRange[0] - cLo.effectiveRange[0])),
        Math.round(cLo.effectiveRange[1] + t * (cHi.effectiveRange[1] - cLo.effectiveRange[1])),
      ],
      diffusionFactor: cLo.diffusionFactor + t * (cHi.diffusionFactor - cLo.diffusionFactor),
    };
  }

  _getLadderData(type) {
    const ladders = {
      '1kb': {
        name: '1 kb DNA Ladder',
        sizes: [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 700, 500, 400, 300, 200, 100],
      },
      '100bp': {
        name: '100 bp DNA Ladder',
        sizes: [2000, 1500, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100],
      },
      '2log': {
        name: '2-Log DNA Ladder',
        sizes: [10000, 8000, 6000, 5000, 4000, 3000, 2500, 2000, 1500, 1000, 750, 500, 250, 100],
      },
      'lambda_hindiii': {
        name: 'Lambda HindIII Ladder',
        sizes: [23130, 9416, 6557, 4361, 2322, 2027, 564, 125],
      },
      'lambda_ecori': {
        name: 'Lambda EcoRI Ladder',
        sizes: [21226, 7421, 5804, 5643, 4878, 3530, 0],
      },
    };

    const ladder = ladders[type];
    if (ladder) return ladder;
    return ladders['1kb'];
  }

  _calculateBands(sizes, gelConfig) {
    const { a, b, wellToBottom, diffusionFactor } = gelConfig;

    return sizes.map((size, i) => {
      if (size <= 0) {
        return { index: i, size: 0, migrationDistance: 0, isSmear: true, intensity: 0.3, bandWidth: 3.0 };
      }

      const logMW = Math.log10(size);
      const migration = a - b * logMW;

      const clampedMigration = Math.max(0, Math.min(wellToBottom, migration));

      const isSmear = size > gelConfig.effectiveRange[1];
      const isInWell = clampedMigration <= 0.1;

      const normalizedIntensity = isSmear ? 0.3 : 1.0;

      const baseWidth = 0.15 + 0.05 * Math.log10(Math.max(1, size));
      const bandWidth = baseWidth * diffusionFactor;

      return {
        index: i,
        size,
        migrationDistance: clampedMigration,
        normalizedPosition: clampedMigration / wellToBottom,
        isSmear,
        isInWell,
        intensity: normalizedIntensity,
        bandWidth,
      };
    });
  }

  _estimateRunTime(fragmentSizes, gelPercentage, voltage) {
    const medianSize = fragmentSizes.slice().sort((a, b) => a - b)[Math.floor(fragmentSizes.length / 2)] || 1000;
    const sizeFactor = Math.max(0.5, Math.min(2.0, Math.log10(medianSize) / 3));
    const gelFactor = gelPercentage / 1.0;
    const voltageFactor = 100 / Math.max(50, voltage);

    return Math.round(30 * sizeFactor * gelFactor * voltageFactor);
  }

  _showGelVisualization(result) {
    this._ensureDraggableResizable();

    const GelRendererClass = (typeof window !== 'undefined' && window.GelRenderer)
      ? window.GelRenderer
      : null;

    if (GelRendererClass) {
      const renderer = new GelRendererClass();
      renderer.render(result);
      return;
    }

    const modal = document.getElementById('gelElectrophoresisModal');
    if (modal) {
      const container = document.getElementById('gelResultsContainer');
      if (container) {
        this._renderFallbackHTML(container, result);
      }
      modal.classList.add('show');
    }
  }

  _ensureDraggableResizable() {
    if (this._dragResizeInitialized) return;

    const selector = '#gelElectrophoresisModal';
    const modal = document.querySelector(selector);
    if (!modal) return;

    if (window.modalDragManager) {
      window.modalDragManager.makeDraggable(selector);
    }
    if (window.resizableModalManager) {
      window.resizableModalManager.makeResizable(selector);
    }

    const resetBtn = modal.querySelector('.reset-position-btn');
    if (resetBtn && window.modalDragManager) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.modalDragManager.resetPosition(selector);
      });
    }

    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        modal.classList.remove('show');
      });
    });

    const collapseBtn = modal.querySelector('.modal-collapse');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        const body = modal.querySelector('.modal-body');
        const icon = collapseBtn.querySelector('i');
        if (body) {
          const isCollapsed = body.style.display === 'none';
          body.style.display = isCollapsed ? '' : 'none';
          if (icon) {
            icon.className = isCollapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
          }
        }
      });
    }

    this._dragResizeInitialized = true;
  }

  _renderFallbackHTML(container, result) {
    const fragmentRows = result.fragmentSizes.map((size, i) => {
      const band = result.bands[i];
      const pos = band ? (band.normalizedPosition * 100).toFixed(1) : '?';
      return `<tr><td>${i + 1}</td><td>${size.toLocaleString()} bp</td><td>${pos}%</td></tr>`;
    }).join('');

    container.innerHTML = `
      <div class="gel-results-summary">
        <h4>Gel Electrophoresis Simulation</h4>
        <p><strong>Enzymes:</strong> ${result.enzymes.join(', ') || 'N/A'}</p>
        <p><strong>Gel:</strong> ${result.gelPercentage}% agarose</p>
        <p><strong>Ladder:</strong> ${result.ladderType}</p>
        <p><strong>Fragments:</strong> ${result.totalFragments}</p>
        <p><strong>Effective range:</strong> ${result.gelConfig.effectiveRange[0].toLocaleString()} - ${result.gelConfig.effectiveRange[1].toLocaleString()} bp</p>
      </div>
      <div class="gel-results-table">
        <table>
          <thead><tr><th>#</th><th>Size</th><th>Migration</th></tr></thead>
          <tbody>${fragmentRows}</tbody>
        </table>
      </div>
      <p class="gel-note">Canvas renderer (GelRenderer.js) provides full gel visualization. Load it for enhanced display.</p>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.GelElectrophoresisService = GelElectrophoresisService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GelElectrophoresisService;
}
