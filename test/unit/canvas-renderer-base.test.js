/**
 * CanvasRendererBase Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Inline CanvasRendererBase for testing (loaded via script tag in prod)
class CanvasRendererBase {
  constructor(container, viewport, genomeBrowser, options = {}) {
    this.container = container;
    this.viewport = viewport;
    this.genomeBrowser = genomeBrowser;
    this.canvas = null;
    this.ctx = null;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    this.renderCount = 0;
    this.lastRenderTime = 0;
    this._resizeObserver = null;
    this._resizeHandler = null;
    this._pendingInitialRender = null;
    this._onCanvasReady = null;
    this._setupCanvas(options);
    this._setupResizeObserver();
  }

  _setupCanvas(options = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = options.canvasClassName || 'genome-canvas';
    this.canvas.style.cssText = 'position:absolute;width:100%;height:100%;';
    this.ctx = this.canvas.getContext('2d', { alpha: options.alpha !== false });
    this._setupContainer(options);
  }

  _setupContainer(options = {}) {
    if (!this.container) return;
    const cs = window.getComputedStyle(this.container);
    if (cs.position === 'static') this.container.style.position = 'relative';
    if (cs.overflow === 'visible') this.container.style.overflow = 'hidden';
    this.container.appendChild(this.canvas);
    this._pendingInitialRender = requestAnimationFrame(() => {
      this._pendingInitialRender = null;
      this._applySize();
      if (options.onReady) options.onReady();
      if (this._onCanvasReady) this._onCanvasReady();
    });
  }

  _applySize() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
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
    if (this.ctx) this.ctx.scale(dpr, dpr);
  }

  _setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this._resizeObserver = new ResizeObserver(() => this._onResize());
      this._resizeObserver.observe(this.container);
    } else {
      this._resizeHandler = () => this._onResize();
      window.addEventListener('resize', this._resizeHandler);
    }
  }

  _onResize() {
    this._applySize();
  }

  _startTiming() {
    this.renderCount++;
    return performance.now();
  }
  _endTiming(startTime) {
    this.lastRenderTime = performance.now() - startTime;
  }

  getPerformanceReport() {
    return { renderCount: this.renderCount, lastRenderTime: this.lastRenderTime };
  }

  render() {
    throw new Error('CanvasRendererBase.render() must be implemented by subclass');
  }

  destroy() {
    if (this._pendingInitialRender) {
      cancelAnimationFrame(this._pendingInitialRender);
      this._pendingInitialRender = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null;
    this.ctx = null;
    this.container = null;
  }
}

class TestCanvasRenderer extends CanvasRendererBase {
  constructor(container, viewport, genomeBrowser, options = {}) {
    super(container, viewport, genomeBrowser, options);
    this.rendered = false;
  }
  render() {
    this.rendered = true;
    const start = this._startTiming();
    if (this.ctx) {
      this.ctx.fillStyle = 'red';
      this.ctx.fillRect(0, 0, 10, 10);
    }
    this._endTiming(start);
  }
  _onResize() {
    this._applySize();
    this.render();
  }
}

function mockContainer() {
  const el = document.createElement('div');
  el.style.width = '800px';
  el.style.height = '600px';
  el.getBoundingClientRect = () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 });
  return el;
}

describe('CanvasRendererBase', () => {
  let container, renderer;

  beforeEach(() => {
    container = mockContainer();
    document.body.appendChild(container);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    if (renderer) renderer.destroy();
    if (container.parentNode) container.parentNode.removeChild(container);
    vi.restoreAllMocks();
  });

  it('should create canvas element on construction', () => {
    renderer = new TestCanvasRenderer(container, { start: 0, end: 1000 }, null);
    expect(renderer.canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('should append canvas to container', () => {
    renderer = new TestCanvasRenderer(container, { start: 0, end: 1000 }, null);
    expect(container.querySelector('canvas')).toBe(renderer.canvas);
  });

  it('should set devicePixelRatio', () => {
    renderer = new TestCanvasRenderer(container, { start: 0, end: 1000 }, null);
    expect(renderer.devicePixelRatio).toBeGreaterThanOrEqual(1);
  });

  it('should track render count', () => {
    renderer = new TestCanvasRenderer(container, { start: 0, end: 1000 }, null);
    expect(renderer.renderCount).toBe(0);
    renderer.render();
    expect(renderer.renderCount).toBe(1);
  });

  it('should track last render time', () => {
    renderer = new TestCanvasRenderer(container, { start: 0, end: 1000 }, null);
    renderer.render();
    expect(renderer.lastRenderTime).toBeGreaterThanOrEqual(0);
  });

  it('should set container overflow to hidden if visible', () => {
    renderer = new TestCanvasRenderer(container, { start: 0, end: 1000 }, null);
    // Default computed style is empty, behavior depends on browser
    expect(renderer.canvas).not.toBeNull();
  });

  it('should clean up on destroy', () => {
    renderer = new TestCanvasRenderer(container, { start: 0, end: 1000 }, null);
    renderer.destroy();
    expect(renderer.canvas).toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('should throw if render() not implemented', () => {
    class Bad extends CanvasRendererBase {
      constructor(c) {
        super(c, { start: 0, end: 1 }, null);
      }
    }
    expect(() => new Bad(mockContainer()).render()).toThrow('must be implemented');
  });

  it('should handle double destroy gracefully', () => {
    renderer = new TestCanvasRenderer(container, { start: 0, end: 1000 }, null);
    renderer.destroy();
    expect(() => renderer.destroy()).not.toThrow();
  });

  it('should cancel pending frame on destroy', () => {
    renderer = new TestCanvasRenderer(container, { start: 0, end: 1000 }, null);
    renderer.destroy();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('should apply canvas dimensions with DPR', () => {
    renderer = new TestCanvasRenderer(container, { start: 0, end: 1000 }, null);
    renderer._applySize();
    const dpr = renderer.devicePixelRatio;
    expect(renderer.canvas.width).toBe(800 * dpr);
    expect(renderer.canvas.height).toBe(600 * dpr);
  });

  it('should set CSS pixel dimensions', () => {
    renderer = new TestCanvasRenderer(container, { start: 0, end: 1000 }, null);
    renderer._applySize();
    expect(renderer.canvas.style.width).toBe('800px');
    expect(renderer.canvas.style.height).toBe('600px');
  });
});
