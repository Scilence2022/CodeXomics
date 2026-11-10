/**
 * Drag release and live drag rendering.
 *
 * 1. Release used to clear the drag transform before starting the (async)
 *    re-render. While the reads track awaited I/O, the old tracks sat back at
 *    their pre-drag place - offset by the whole drag - and then the new render
 *    landed on the target: the view appeared to land twice. The offset must
 *    stay until the new DOM replaces the old one.
 * 2. "Live-render new region while dragging" started a render per throttle
 *    tick; each one aborted the previous in-flight render, so with reads
 *    loaded nothing reached the screen until release. Renders must run one at
 *    a time, coalesce the moves that arrive meanwhile, and the live transform
 *    must be measured from the region actually on screen.
 * 3. The reads canvas sized itself on its first frame (which clears a canvas)
 *    without drawing, so the rows stayed blank until a debounced resize redraw.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import NavigationManager from '../../src/renderer/modules/NavigationManager.js';
import CanvasReadsRenderer from '../../src/renderer/modules/CanvasReadsRenderer.js';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// A genome view with a gene track (unified container) and a reads track, plus
// a stub browser whose displayGenomeView resolves when the test says so and,
// like the real one, swaps in a new DOM and bumps genomeViewRenderSeq.
function setup({ globalDragging = true } = {}) {
  const viewer = document.createElement('div');
  viewer.id = 'genomeViewer';
  document.body.appendChild(viewer);

  const buildDom = () => {
    const container = document.createElement('div');
    container.className = 'genome-browser-container';
    container.innerHTML = `
      <div class="gene-track"><div class="track-content"><div class="unified-gene-container"></div></div></div>
      <div class="reads-track"><div class="track-content"></div></div>`;
    viewer.replaceChildren(container);
    return container;
  };
  buildDom();

  const renders = [];
  const browser = {
    currentChromosome: 'chr1',
    currentSequence: { chr1: 'A'.repeat(100000) },
    currentPosition: { start: 10000, end: 20000 },
    genomeViewRenderSeq: 0,
    lastRenderedPosition: null,
    genomeViewRenderController: null,
    updateStatistics: vi.fn(),
    genomeNavigationBar: { update: vi.fn() },
    displayGenomeView: vi.fn(() => {
      const position = { ...browser.currentPosition };
      const d = deferred();
      const controller = { position };
      browser.genomeViewRenderController = controller;
      renders.push({
        position,
        // Land the render: swap the DOM like displayGenomeView does
        land() {
          buildDom();
          browser.lastRenderedPosition = position;
          browser.genomeViewRenderSeq++;
          if (browser.genomeViewRenderController === controller) browser.genomeViewRenderController = null;
          d.resolve();
        },
        fail(error) {
          if (browser.genomeViewRenderController === controller) browser.genomeViewRenderController = null;
          d.reject(error);
        },
      });
      return d.promise;
    }),
  };

  const nm = new NavigationManager(browser);
  nm.globalDraggingEnabled = globalDragging;
  nm.updateDetailedRulers = vi.fn();
  nm.showDragPositionFeedback = vi.fn();
  nm.hideDragPositionFeedback = vi.fn();
  nm.getEffectiveWidth = () => 1000; // 10 bp per px for a 10 kb view

  const geneContent = () => document.querySelector('.gene-track .track-content');
  const uc = () => document.querySelector('.unified-gene-container');
  const reads = () => document.querySelector('.reads-track .track-content');

  nm.makeDraggable(geneContent(), 'chr1');
  const mouse = (target, type, x) =>
    target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 10, button: 0, bubbles: true }));
  const move = x => nm.handleDocumentMouseMove({ clientX: x });
  const up = x => nm.handleDocumentMouseUp({ clientX: x });

  return { nm, browser, renders, geneContent, uc, reads, mouse, move, up };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('drag release render', () => {
  it('keeps the drag offset on screen until the release render replaces the DOM', async () => {
    const { nm, renders, geneContent, uc, reads, mouse, move, up } = setup();
    mouse(geneContent(), 'mousedown', 500);
    move(400); // 100 px left = 1000 bp right
    const oldUc = uc();
    const oldReads = reads();
    expect(oldUc.style.transform).toBe('translateX(-10%)');
    expect(oldReads.style.transform).toBe('translateX(-10%)');

    up(400);
    await flush();
    // Render still in flight (reads I/O): the old DOM must not snap back.
    expect(renders).toHaveLength(1);
    expect(oldUc.style.transform).toBe('translateX(-10%)');
    expect(oldReads.style.transform).toBe('translateX(-10%)');
    expect(renders[0].position).toEqual({ start: 11000, end: 21000 });

    renders[0].land();
    await flush();
    expect(oldUc.isConnected).toBe(false);
    expect(uc().style.transform).toBe('');
    expect(reads().style.transform).toBe('');
    expect(nm.pendingDragVisualReset).toBe(null);
  });

  it('undoes the offset when the release render fails and nothing replaces the DOM', async () => {
    const { renders, geneContent, uc, mouse, move, up } = setup();
    mouse(geneContent(), 'mousedown', 500);
    move(400);
    up(400);
    await flush();
    renders[0].fail(new Error('reads unavailable'));
    await flush();
    expect(uc().isConnected).toBe(true);
    expect(uc().style.transform).toBe('');
  });

  it('resets right away when the mouse never moved far enough to drag', () => {
    const { renders, geneContent, uc, mouse, move, up } = setup();
    mouse(geneContent(), 'mousedown', 500);
    move(498);
    up(498);
    expect(renders).toHaveLength(0);
    expect(uc().style.transform).toBe('');
  });

  it('keeps the offset on the dragged track only in single-track mode', async () => {
    const { renders, geneContent, uc, reads, mouse, move, up } = setup({ globalDragging: false });
    mouse(geneContent(), 'mousedown', 500);
    move(450);
    const oldUc = uc();
    up(450);
    await flush();
    expect(oldUc.style.transform).toBe('translateX(-5%)');
    expect(reads().style.transform).toBe('');
    renders[0].land();
    await flush();
    expect(uc().style.transform).toBe('');
  });
});

describe('live-render new region while dragging', () => {
  function liveSetup() {
    const env = setup();
    env.nm.setDragUpdateGeneFeatures(true);
    env.nm.dragRenderThrottle.intervalMs = 0;
    return env;
  }

  it('runs one render at a time and coalesces the moves made meanwhile', async () => {
    const { nm, renders, geneContent, mouse, move, up } = liveSetup();
    mouse(geneContent(), 'mousedown', 500);
    move(450);
    await flush();
    expect(renders).toHaveLength(1);
    expect(renders[0].position.start).toBe(10500);

    // More moves while the first render waits on reads: no new render, so
    // the first one is not aborted before it can reach the screen.
    move(400);
    move(350);
    await flush();
    expect(renders).toHaveLength(1);

    renders[0].land();
    await flush();
    await flush();
    // One follow-up render for the latest position.
    expect(renders).toHaveLength(2);
    expect(renders[1].position.start).toBe(11500);
    expect(nm.dragState.renderedStart).toBe(10500);

    renders[1].land();
    await flush();
    up(350);
    await flush();
    // Release render (the in-drag ones are done).
    expect(renders).toHaveLength(3);
  });

  it('offsets every track by the distance from the region on screen', async () => {
    const { nm, renders, geneContent, uc, reads, mouse, move } = liveSetup();
    mouse(geneContent(), 'mousedown', 500);
    move(450); // view at 10500, DOM still drawn for 10000
    expect(uc().style.transform).toBe('translateX(-5%)');
    expect(reads().style.transform).toBe('translateX(-5%)');
    await flush();

    move(400); // view at 11000 while the 10500 render is in flight
    renders[0].land();
    await flush();
    // New DOM is drawn for 10500 and the view is at 11000: -500 bp = -5%.
    expect(nm.dragState.renderedStart).toBe(10500);
    expect(uc().style.transform).toBe('translateX(-5%)');
    expect(reads().style.transform).toBe('translateX(-5%)');
  });

  it('leaves a late in-drag render alone once the drag has ended', async () => {
    const { nm, renders, geneContent, mouse, move, up } = liveSetup();
    mouse(geneContent(), 'mousedown', 500);
    move(450);
    await flush();
    up(450);
    await flush();
    const releaseRenders = renders.length;
    renders[0].land();
    await flush();
    expect(renders).toHaveLength(releaseRenders);
    expect(nm.liveDragRender.inFlight).toBe(false);
  });

  it('draws the last position even when the throttle drops the final move', async () => {
    vi.useFakeTimers();
    const { nm, renders, geneContent, mouse, move } = setup();
    nm.setDragUpdateGeneFeatures(true);
    nm.dragRenderThrottle.intervalMs = 80;
    mouse(geneContent(), 'mousedown', 500);
    move(450);
    await vi.advanceTimersByTimeAsync(0);
    renders[0].land();
    await vi.advanceTimersByTimeAsync(0);
    move(420); // inside the throttle window
    await vi.advanceTimersByTimeAsync(0);
    expect(renders).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(renders).toHaveLength(2);
    expect(renders[1].position.start).toBe(10800);
  });
});

describe('CanvasReadsRenderer first frame', () => {
  it('draws in the frame that sizes the canvas', () => {
    const rafs = [];
    vi.stubGlobal('requestAnimationFrame', cb => rafs.push(cb));
    const ctx = new Proxy({}, { get: () => () => ({ width: 0 }) });
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const setupCanvas = vi.spyOn(CanvasReadsRenderer.prototype, 'setupCanvas').mockImplementation(() => {});
    const render = vi.spyOn(CanvasReadsRenderer.prototype, 'render').mockImplementation(() => {});
    try {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const renderer = new CanvasReadsRenderer(container, [], { start: 0, end: 100 }, {});
      expect(render).not.toHaveBeenCalled();
      rafs.forEach(cb => cb());
      expect(setupCanvas).toHaveBeenCalled();
      expect(render).toHaveBeenCalledTimes(1);
      expect(renderer.canvas.style.opacity).toBe('1');
      expect(renderer.canvas.style.transition).toBe('');
      renderer.resizeObserver?.disconnect();
    } finally {
      getContext.mockRestore();
      setupCanvas.mockRestore();
      render.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('skips the debounced redraw when the width has not changed', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    document.body.appendChild(container);
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ width: 800 });
    const renderer = Object.create(CanvasReadsRenderer.prototype);
    Object.assign(renderer, { container, canvasWidth: 800, options: {} });
    renderer.setupCanvas = vi.fn();
    renderer.render = vi.fn();

    renderer.handleResize();
    vi.advanceTimersByTime(150);
    expect(renderer.render).not.toHaveBeenCalled();

    container.getBoundingClientRect.mockReturnValue({ width: 900 });
    renderer.handleResize();
    vi.advanceTimersByTime(150);
    expect(renderer.setupCanvas).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });
});
