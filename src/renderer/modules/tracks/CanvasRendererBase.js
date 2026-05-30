/**
 * CanvasRendererBase — Abstract base class for canvas-based genome track renderers
 *
 * Eliminates ~300 lines of duplicated boilerplate shared across 3 subclasses:
 * - CanvasSequenceRenderer (732 lines)
 * - CanvasGenesRenderer   (868 lines)
 * - CanvasReadsRenderer   (1240 lines)
 *
 * Common functionality extracted:
 * - Canvas/context creation with devicePixelRatio support
 * - Container setup and cleanup
 * - Resize observer (ResizeObserver with window resize fallback)
 * - Render timing and performance metrics tracking
 * - Destroy lifecycle (cancel pending rAF, disconnect observer, remove canvas)
 *
 * Subclasses must implement: render()
 *
 * @abstract
 */
class CanvasRendererBase {
  /**
   * @param {HTMLElement} container - The DOM container element
   * @param {Object} viewport - Viewport state { start, end }
   * @param {Object} genomeBrowser - Reference to GenomeExplorer instance
   * @param {Object} [options={}] - Renderer-specific options
   */
  constructor(container, viewport, genomeBrowser, options = {}) {
    /** @type {HTMLElement} */
    this.container = container;
    /** @type {Object} */
    this.viewport = viewport;
    /** @type {Object} */
    this.genomeBrowser = genomeBrowser;

    // Canvas and context
    /** @type {?HTMLCanvasElement} */
    this.canvas = null;
    /** @type {?CanvasRenderingContext2D} */
    this.ctx = null;
    /** @type {number} */
    this.devicePixelRatio = window.devicePixelRatio || 1;

    // Rendering metrics
    /** @type {number} */
    this.canvasWidth = 0;
    /** @type {number} */
    this.canvasHeight = 0;

    // Performance tracking
    /** @type {number} */
    this.renderCount = 0;
    /** @type {number} */
    this.lastRenderTime = 0;

    // Resize handling
    /** @type {?ResizeObserver} */
    this._resizeObserver = null;
    /** @type {?Function} */
    this._resizeHandler = null;
    /** @type {?number} */
    this._pendingInitialRender = null;

    // Subclass callbacks — set by subclasses if they need custom setup steps
    /** @type {?Function} */
    this._onCanvasReady = null;

    this._setupCanvas(options);
    this._setupResizeObserver();
  }

  // =========================================================================
  // Canvas Lifecycle
  // =========================================================================

  /**
   * Create canvas element with proper attributes and append to container
   * @param {Object} options - Renderer-specific options
   * @protected
   */
  _setupCanvas(options = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = options.canvasClassName || 'genome-canvas';
    this.canvas.style.cssText =
      options.canvasStyle ||
      `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: block;
      image-rendering: crisp-edges;
      pointer-events: auto;
      opacity: 0;
      transition: opacity 0.1s ease-out;
    `;

    this.ctx = this.canvas.getContext('2d', {
      alpha: options.alpha !== false,
      ...options.contextOptions,
    });

    this._setupContainer(options);
  }

  /**
   * Configure container and canvas sizing
   * @protected
   */
  _setupContainer(options = {}) {
    if (!this.container) return;

    // Ensure container has position context for absolute positioning
    const containerStyle = window.getComputedStyle(this.container);
    if (containerStyle.position === 'static') {
      this.container.style.position = 'relative';
    }

    // Add overflow hidden if not already set
    if (containerStyle.overflow === 'visible') {
      this.container.style.overflow = 'hidden';
    }

    this.container.appendChild(this.canvas);

    // Defer initial sizing to next frame so the container is in the DOM
    this._pendingInitialRender = requestAnimationFrame(() => {
      this._pendingInitialRender = null;
      this._applySize();
      if (options.onReady) options.onReady();
      if (this._onCanvasReady) this._onCanvasReady();
    });
  }

  /**
   * Apply canvas size accounting for devicePixelRatio
   * @protected
   */
  _applySize() {
    if (!this.canvas || !this.container) return;

    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      // Container not in DOM yet, defer
      this._pendingInitialRender = requestAnimationFrame(() => this._applySize());
      return;
    }

    const dpr = this.devicePixelRatio;
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';

    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  // =========================================================================
  // Resize Handling
  // =========================================================================

  /**
   * Set up resize detection (ResizeObserver preferred, window.resize fallback)
   * @protected
   */
  _setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this._resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.target === this.container) {
            this._onResize();
          }
        }
      });
      this._resizeObserver.observe(this.container);
    } else {
      // Fallback to window resize
      this._resizeHandler = () => this._onResize();
      window.addEventListener('resize', this._resizeHandler);
    }
  }

  /**
   * Called when container is resized
   * @protected
   */
  _onResize() {
    this._applySize();
    // Subclasses should call this.render() in their _onResize override
  }

  // =========================================================================
  // Performance Metrics
  // =========================================================================

  /**
   * Start render timing
   * @protected
   * @returns {number} Start timestamp
   */
  _startTiming() {
    this.renderCount++;
    return performance.now();
  }

  /**
   * End render timing
   * @protected
   * @param {number} startTime - Timestamp from _startTiming()
   */
  _endTiming(startTime) {
    this.lastRenderTime = performance.now() - startTime;
  }

  /**
   * Get render performance report
   * @returns {{renderCount: number, lastRenderTime: number}}
   */
  getPerformanceReport() {
    return {
      renderCount: this.renderCount,
      lastRenderTime: this.lastRenderTime,
    };
  }

  // =========================================================================
  // Abstract / override methods
  // =========================================================================

  /**
   * Render the track content. Subclasses MUST implement this.
   * @abstract
   */
  render() {
    throw new Error('CanvasRendererBase.render() must be implemented by subclass');
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /**
   * Destroy the renderer — cleanup all resources
   */
  destroy() {
    // Cancel pending initial render
    if (this._pendingInitialRender) {
      cancelAnimationFrame(this._pendingInitialRender);
      this._pendingInitialRender = null;
    }

    // Disconnect resize observer
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    // Remove window resize handler
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }

    // Remove canvas from DOM
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    // Release references for GC
    this.canvas = null;
    this.ctx = null;
    this.container = null;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CanvasRendererBase;
}

// Also expose globally for script tag loading
if (typeof window !== 'undefined') {
  window.CanvasRendererBase = CanvasRendererBase;
}
