// @ts-check
/**
 * GelElectrophoresisService - Simulates agarose gel electrophoresis
 * Visualizes restriction fragment patterns from virtual_digest results.
 *
 * This tool is a pure visualization tool — it does NOT perform digestion.
 * Call virtual_digest first, then pass its fragmentDetails to this tool.
 *
 * Physics model:
 * Migration follows d = a - b * log10(MW), with coefficients based on gel
 * percentage. Voltage informs the run-time estimate. The supplied run time
 * is recorded with the simulation parameters.
 */
class GelElectrophoresisService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
    this._markerDb = null;
  }

  get markerDb() {
    if (!this._markerDb) {
      const DbClass = typeof window !== 'undefined' && window.DNAMarkerDatabase ? window.DNAMarkerDatabase : null;
      if (DbClass) {
        this._markerDb = new DbClass();
      }
    }
    return this._markerDb;
  }

  async simulateGelElectrophoresis(params = {}) {
    const {
      fragments,
      gelPercentage = 1.0,
      ladderType = '1kb',
      laneLabel = 'Digest',
      voltage = 100,
      runTime = 45,
      showLadder = true,
      bandColorScheme = 'ethidium_bromide',
    } = params;

    if (!fragments || !Array.isArray(fragments) || fragments.length === 0) {
      return {
        success: false,
        error: 'No fragment data provided. Run virtual_digest first and pass its fragmentDetails to this tool.',
        hint: 'Example: simulate_gel_electrophoresis(fragments=<virtual_digest_result>.fragmentDetails)',
        requiredParam: 'fragments',
      };
    }

    const fragmentSizes = [];
    for (const [index, fragment] of fragments.entries()) {
      const size = typeof fragment === 'number' ? fragment : fragment?.length;
      if (!Number.isSafeInteger(size) || size <= 0 || typeof fragment === 'string' || Array.isArray(fragment)) {
        return {
          success: false,
          error: `Fragment ${index + 1} must have a positive integer size in bp.`,
          requiredParam: 'fragments',
        };
      }
      fragmentSizes.push(size);
    }

    if (!Number.isFinite(gelPercentage) || gelPercentage < 0.5 || gelPercentage > 3) {
      return { success: false, error: 'Agarose percentage must be between 0.5 and 3.' };
    }

    const gelConfig = this._getGelConfig(gelPercentage);
    const ladderData = this._getLadderData(ladderType);

    const bands = this._calculateBands(fragmentSizes, gelConfig);

    const ladderBands = this._calculateBands(ladderData.sizes, gelConfig);

    const result = {
      laneLabel,
      gelPercentage,
      ladderType: ladderData.id,
      ladderName: ladderData.name,
      voltage,
      runTime,
      showLadder,
      bandColorScheme,
      gelConfig: {
        a: gelConfig.a,
        b: gelConfig.b,
        wellToBottomDistance: gelConfig.wellToBottom,
        effectiveRange: gelConfig.effectiveRange,
      },
      totalFragments: fragmentSizes.length,
      fragmentSizes: fragmentSizes.sort((a, b) => b - a),
      bands,
      ladderBands: showLadder ? ladderBands : [],
      ladderSizes: showLadder ? ladderData.sizes : [],
      estimatedRunTime: this._estimateRunTime(fragmentSizes, gelPercentage, voltage),
    };

    this._showGelVisualization(result, ladderBands);

    return result;
  }

  _getGelConfig(percentage) {
    const configs = {
      0.5: { a: 32.33, b: 7.11, wellToBottom: 12, effectiveRange: [1000, 30000], diffusionFactor: 0.8 },
      0.7: { a: 32.8, b: 7.51, wellToBottom: 12, effectiveRange: [800, 20000], diffusionFactor: 0.9 },
      0.8: { a: 31.86, b: 7.51, wellToBottom: 12, effectiveRange: [600, 15000], diffusionFactor: 0.95 },
      1.0: { a: 30.54, b: 7.51, wellToBottom: 12, effectiveRange: [400, 10000], diffusionFactor: 1.0 },
      1.2: { a: 30.03, b: 7.68, wellToBottom: 12, effectiveRange: [300, 7000], diffusionFactor: 1.1 },
      1.5: { a: 28.28, b: 7.51, wellToBottom: 12, effectiveRange: [200, 5000], diffusionFactor: 1.2 },
      2.0: { a: 25.22, b: 7.11, wellToBottom: 12, effectiveRange: [100, 3000], diffusionFactor: 1.4 },
      2.5: { a: 22.12, b: 6.55, wellToBottom: 12, effectiveRange: [50, 2000], diffusionFactor: 1.6 },
      3.0: { a: 21.17, b: 6.89, wellToBottom: 12, effectiveRange: [30, 1000], diffusionFactor: 1.8 },
    };

    if (configs[percentage]) return configs[percentage];

    const concentrations = Object.keys(configs)
      .map(Number)
      .sort((a, b) => a - b);
    const upperIndex = concentrations.findIndex(value => value > percentage);
    const lo = concentrations[upperIndex - 1];
    const hi = concentrations[upperIndex];
    const t = (percentage - lo) / (hi - lo);
    const cLo = configs[lo];
    const cHi = configs[hi];
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
    if (this.markerDb) {
      const marker = this.markerDb.get(type);
      if (marker && marker.sizes) {
        return { id: marker.id, name: marker.name, sizes: marker.sizes.filter(s => s > 0) };
      }
    }

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
      lambda_hindiii: {
        name: 'Lambda HindIII Ladder',
        sizes: [23130, 9416, 6557, 4361, 2322, 2027, 564, 125],
      },
      lambda_ecori: {
        name: 'Lambda EcoRI Ladder',
        sizes: [21226, 7421, 5804, 5643, 4878, 3530],
      },
    };

    const id = Object.hasOwn(ladders, type) ? type : '1kb';
    return { id, ...ladders[id] };
  }

  listMarkers(params = {}) {
    if (!this.markerDb) {
      return { markers: [], total: 0, error: 'Marker database not available' };
    }

    const { query, brand, category } = params;
    let results = this.markerDb.getAll();

    if (query) {
      results = this.markerDb.search(query);
    }
    if (brand) {
      results = results.filter(m => m.brand === brand);
    }
    if (category) {
      results = results.filter(m => m.category === category);
    }

    return {
      markers: results.map(m => ({
        id: m.id,
        name: m.name,
        brand: m.brand,
        category: m.category,
        sizeRange: m.sizeRange,
        bandCount: m.sizes.length,
        recommendedGel: m.recommendedGel,
        description: m.description,
        tags: m.tags,
      })),
      brands: this.markerDb.getBrands(),
      total: results.length,
    };
  }

  getMarkerInfo(params) {
    if (!this.markerDb) {
      return { error: 'Marker database not available' };
    }

    const { markerId } = params;
    const marker = this.markerDb.get(markerId);
    if (!marker) {
      return { error: `Marker not found: ${markerId}. Use list_dna_markers to browse available markers.` };
    }

    return {
      id: marker.id,
      name: marker.name,
      brand: marker.brand,
      category: marker.category,
      sizeRange: marker.sizeRange,
      sizes: marker.sizes,
      recommendedGel: marker.recommendedGel,
      description: marker.description,
      tags: marker.tags,
    };
  }

  _calculateBands(sizes, gelConfig) {
    const { a, b, wellToBottom, diffusionFactor } = gelConfig;

    return sizes.map((size, i) => {
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

  openGelWindow() {
    if (typeof document === 'undefined') return false;
    const modal = document.getElementById('gelElectrophoresisModal');
    if (!modal) return false;

    this._setGelModalCollapsed(modal, false);
    modal.classList.add('show');
    this._ensureDraggableResizable();
    window.modalDragManager?.raiseFloatingWindow(modal);
    this._fitGelWindow(modal);
    return true;
  }

  _showGelVisualization(result, ladderBands) {
    if (!this.openGelWindow()) return;

    const empty = document.getElementById('gelResultsEmpty');
    if (empty) empty.hidden = true;
    const container = document.getElementById('gelResultsContainer');
    const fallback = document.getElementById('gelResultsFallback');
    if (window.GelRenderer) {
      if (container) container.hidden = false;
      if (fallback) fallback.hidden = true;
      this._renderer ??= new window.GelRenderer();
      this._renderer.render(result, ladderBands);
    } else if (fallback) {
      if (container) container.hidden = true;
      fallback.hidden = false;
      fallback.textContent =
        `Gel viewer unavailable. ${result.totalFragments.toLocaleString()} fragments simulated. ` +
        `Sizes (bp): ${result.fragmentSizes.slice(0, 15).join(', ')}${result.totalFragments > 15 ? ', …' : ''}.`;
    }
    this._fitGelWindow(document.getElementById('gelElectrophoresisModal'));
  }

  _ensureDraggableResizable() {
    if (this._dragResizeInitialized) return;

    const selector = '#gelElectrophoresisModal';
    const modal = document.querySelector(selector);
    if (!modal) return;

    window.addEventListener('resize', () => this._fitGelWindow(modal));
    if (window.modalDragManager) {
      window.modalDragManager.makeDraggable(selector);
    }
    if (window.resizableModalManager) {
      window.resizableModalManager.makeResizable(selector);
      // Keep the CSS viewport cap when the application window shrinks after resizing the gel.
      modal.querySelector('.modal-content').style.removeProperty('max-width');
    }

    const resetBtn = modal.querySelector('.reset-position-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', e => {
        e.stopPropagation();
        window.modalDragManager?.resetPosition(selector);
      });
    }

    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        modal.classList.remove('show');
      });
    });

    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.stopPropagation();
        modal.classList.remove('show');
      }
    });

    const collapseBtn = modal.querySelector('.modal-collapse');
    if (collapseBtn) {
      collapseBtn.setAttribute('aria-expanded', 'true');
      collapseBtn.addEventListener('click', () => {
        const content = modal.querySelector('.modal-content');
        this._setGelModalCollapsed(modal, !content?.classList.contains('is-collapsed'));
        this._fitGelWindow(modal);
      });
    }

    this._dragResizeInitialized = true;
  }

  _fitGelWindow(modal) {
    if (!modal.classList.contains('show')) return;
    const content = modal.querySelector('.modal-content');
    if (content?.style.position !== 'fixed') return;

    const padding = 16;
    const maxLeft = window.innerWidth - content.offsetWidth - padding;
    const maxTop = window.innerHeight - content.offsetHeight - padding;
    const left = parseFloat(content.style.left) || 0;
    const top = parseFloat(content.style.top) || 0;
    content.style.left = `${Math.max(padding, Math.min(left, maxLeft))}px`;
    content.style.top = `${Math.max(padding, Math.min(top, maxTop))}px`;
  }

  _setGelModalCollapsed(modal, shouldCollapse) {
    const content = modal?.querySelector('.modal-content');
    const body = modal?.querySelector('.modal-body');
    const collapseBtn = modal?.querySelector('.modal-collapse');
    const icon = collapseBtn?.querySelector('i');

    if (!content || !body) return;

    if (shouldCollapse) {
      if (!content.classList.contains('is-collapsed')) {
        if (content.style.height) {
          content.setAttribute('data-expanded-height', content.style.height);
        } else {
          content.removeAttribute('data-expanded-height');
        }

        if (content.style.minHeight) {
          content.setAttribute('data-expanded-min-height', content.style.minHeight);
        } else {
          content.removeAttribute('data-expanded-min-height');
        }
      }

      body.hidden = true;
      content.classList.add('is-collapsed');
      collapseBtn?.setAttribute('aria-expanded', 'false');
      collapseBtn?.setAttribute('aria-label', 'Expand gel results');
      if (icon) {
        icon.className = 'fas fa-chevron-down';
      }
      return;
    }

    body.hidden = false;
    body.style.display = '';
    content.classList.remove('is-collapsed');

    if (content.hasAttribute('data-expanded-height')) {
      content.style.height = content.getAttribute('data-expanded-height') || '';
      content.removeAttribute('data-expanded-height');
    }

    if (content.hasAttribute('data-expanded-min-height')) {
      content.style.minHeight = content.getAttribute('data-expanded-min-height') || '';
      content.removeAttribute('data-expanded-min-height');
    }

    collapseBtn?.setAttribute('aria-expanded', 'true');
    collapseBtn?.setAttribute('aria-label', 'Collapse gel results');
    if (icon) {
      icon.className = 'fas fa-chevron-up';
    }
  }
}

if (typeof window !== 'undefined') {
  window.GelElectrophoresisService = GelElectrophoresisService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GelElectrophoresisService;
}
