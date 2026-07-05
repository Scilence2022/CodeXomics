import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ScreenshotManager = require('../../src/renderer/modules/ScreenshotManager.js');

describe('ScreenshotManager', () => {
  function createManager() {
    const manager = new ScreenshotManager({
      showNotification: vi.fn(),
      currentChromosome: 'chr1',
      currentPosition: { start: 0, end: 100 },
    });
    manager.waitForPaint = vi.fn().mockResolvedValue(undefined);
    return manager;
  }

  function setRect(element, rect) {
    element.getBoundingClientRect = () => rect;
  }

  it('captures each visible track when target=track and trackType=all', async () => {
    const manager = createManager();
    document.body.innerHTML = `
      <div id="genomeViewerSection"></div>
      <div id="genomeViewer">
        <div class="genome-browser-container">
          <div class="gene-track" data-track-type="genes"><span class="track-title">Genes</span></div>
          <div class="reads-track">
            <div class="track-header"><span class="track-title">Sample reads</span></div>
            <div class="track-content"><canvas class="reads-canvas" width="600" height="120"></canvas></div>
          </div>
        </div>
      </div>
      <div id="sequenceDisplaySection" style="display: flex;">
        <div class="sequence-header"><h4>Sequence View</h4></div>
        <div id="sequenceContent"></div>
      </div>
    `;
    const genesTrack = document.querySelector('[data-track-type="genes"]');
    const readsCanvas = document.querySelector('.reads-canvas');
    const sequencePanel = document.getElementById('sequenceDisplaySection');
    setRect(genesTrack, { left: 10, top: 20, right: 210, bottom: 120, width: 200, height: 100 });
    setRect(readsCanvas, { left: 30, top: 150, right: 630, bottom: 270, width: 600, height: 120 });
    setRect(sequencePanel, { left: 15, top: 300, right: 515, bottom: 500, width: 500, height: 200 });

    manager.captureNativeScreenshot = vi.fn(async options => ({
      success: true,
      target: options.target,
      mode: options.mode,
      filePath: options.filePath,
    }));

    const result = await manager.captureScreenshot({
      target: 'track',
      trackType: 'all',
      mode: 'visible',
      auto_save: true,
    });

    expect(result.success).toBe(true);
    expect(result.trackType).toBe('all');
    expect(result.tracks.map(track => track.trackType)).toEqual(['genes', 'reads', 'sequence']);
    expect(manager.captureNativeScreenshot).toHaveBeenCalledTimes(3);
    expect(manager.captureNativeScreenshot).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        target: 'track',
        mode: 'visible',
        rect: { x: 10, y: 20, width: 200, height: 100 },
      })
    );
    expect(manager.captureNativeScreenshot).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: 'track',
        mode: 'visible',
        rect: { x: 30, y: 150, width: 600, height: 120 },
      })
    );
    expect(manager.captureNativeScreenshot).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        target: 'track',
        mode: 'visible',
        rect: { x: 15, y: 300, width: 500, height: 200 },
      })
    );
  });

  it('captures the reads drawing element instead of the reads track header', async () => {
    const manager = createManager();
    document.body.innerHTML = `
      <div class="reads-track">
        <div class="track-header"><span class="track-title">Sample reads</span></div>
        <div class="track-content"><canvas class="reads-canvas" width="800" height="180"></canvas></div>
      </div>
    `;
    const readsCanvas = document.querySelector('.reads-canvas');
    setRect(readsCanvas, { left: 40, top: 80, right: 840, bottom: 260, width: 800, height: 180 });
    manager.renderElementToDataUrl = vi.fn().mockResolvedValue('data:image/png;base64,AAAA');
    manager.saveRenderedScreenshot = vi.fn(async options => ({
      success: true,
      target: options.target,
      mode: options.mode,
      filePath: options.filePath,
    }));

    const result = await manager.captureScreenshot({
      target: 'track',
      trackType: 'reads',
      auto_save: true,
    });

    expect(result.success).toBe(true);
    expect(manager.renderElementToDataUrl).toHaveBeenCalledWith(
      readsCanvas,
      expect.objectContaining({
        target: 'track',
        mode: 'full',
      })
    );
  });

  it('waits for reads rendering before selecting the capture element', async () => {
    const manager = createManager();
    document.body.innerHTML = `
      <div class="reads-track">
        <div class="track-header"><span class="track-title">Sample reads</span></div>
        <div class="track-content"></div>
      </div>
    `;

    const trackContent = document.querySelector('.track-content');
    let paintCalls = 0;
    manager.waitForPaint = vi.fn(async () => {
      paintCalls += 1;
      if (paintCalls === 2) {
        const canvas = document.createElement('canvas');
        canvas.className = 'reads-canvas';
        canvas.width = 700;
        canvas.height = 140;
        setRect(canvas, { left: 50, top: 90, right: 750, bottom: 230, width: 700, height: 140 });
        trackContent.appendChild(canvas);
      }
    });
    manager.renderElementToDataUrl = vi.fn().mockResolvedValue('data:image/png;base64,AAAA');
    manager.saveRenderedScreenshot = vi.fn(async options => ({
      success: true,
      target: options.target,
      mode: options.mode,
      filePath: options.filePath,
    }));

    const result = await manager.captureScreenshot({
      target: 'track',
      trackType: 'reads',
      renderWaitMs: 500,
      auto_save: true,
    });

    expect(result.success).toBe(true);
    expect(manager.renderElementToDataUrl).toHaveBeenCalledWith(
      document.querySelector('.reads-canvas'),
      expect.objectContaining({
        target: 'track',
        mode: 'full',
      })
    );
  });

  it('adds per-track suffixes when capturing all tracks to an explicit path', async () => {
    const manager = createManager();
    const genesTrack = document.createElement('div');
    const sequencePanel = document.createElement('div');
    manager.getCapturableTrackElements = vi.fn(() => [
      { type: 'genes', label: 'Genes', element: genesTrack },
      { type: 'sequence', label: 'Bottom Sequence Panel', element: sequencePanel },
    ]);
    manager.captureElementScreenshot = vi.fn(async (element, options) => ({
      success: true,
      target: options.target,
      mode: options.mode,
      filePath: options.filePath,
      fileSize: 10,
    }));

    const result = await manager.captureScreenshot({
      target: 'track',
      trackType: 'all',
      filePath: 'screenshots/tracks.png',
      auto_save: true,
    });

    expect(result.success).toBe(true);
    expect(result.filePaths).toEqual(['screenshots/tracks-genes.png', 'screenshots/tracks-sequence.png']);
    expect(manager.captureElementScreenshot).toHaveBeenNthCalledWith(
      1,
      genesTrack,
      expect.objectContaining({
        target: 'track',
        mode: 'full',
        filePath: 'screenshots/tracks-genes.png',
      })
    );
    expect(manager.captureElementScreenshot).toHaveBeenNthCalledWith(
      2,
      sequencePanel,
      expect.objectContaining({
        target: 'track',
        mode: 'full',
        filePath: 'screenshots/tracks-sequence.png',
      })
    );
  });

  it('keeps auto-save default screenshot names relative when the renderer has no writable cwd', async () => {
    const manager = createManager();
    manager.captureNativeScreenshot = vi.fn(async options => ({
      success: true,
      target: options.target,
      mode: options.mode,
      filePath: options.filePath,
    }));

    const result = await manager.captureScreenshot({
      target: 'full_application',
      auto_save: true,
      aiInitiated: true,
    });

    expect(result.success).toBe(true);
    const captureOptions = manager.captureNativeScreenshot.mock.calls[0][0];
    expect(captureOptions.filePath).toMatch(/^codexomics-full-application-chr1-1-100-\d{8}-\d{6}\.png$/);
    expect(captureOptions.filePath).not.toMatch(/^(?:\/|[A-Za-z]:[\\/])/);
  });

  it('falls back to native visible capture when full track composition is blocked', async () => {
    const manager = createManager();
    const trackElement = document.createElement('div');
    setRect(trackElement, { left: 25, top: 40, right: 225, bottom: 140, width: 200, height: 100 });
    manager.renderElementToDataUrl = vi
      .fn()
      .mockRejectedValue(new Error("Failed to execute 'toDataURL': Tainted canvases may not be exported."));
    manager.captureNativeScreenshot = vi.fn(async options => ({
      success: true,
      target: options.target,
      mode: options.mode,
      filePath: options.filePath,
    }));

    const result = await manager.captureElementScreenshot(trackElement, {
      target: 'track',
      mode: 'full',
      format: 'png',
      quality: 92,
      filePath: '/screenshots/track.png',
    });

    expect(result.success).toBe(true);
    expect(manager.captureNativeScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'track',
        mode: 'full',
        rect: { x: 25, y: 40, width: 200, height: 100 },
        fallback: 'native_visible',
      })
    );
  });

  it('passes autoOpen and AI initiation flags to native captures', async () => {
    const manager = createManager();
    manager.captureNativeScreenshot = vi.fn(async options => ({
      success: true,
      target: options.target,
      mode: options.mode,
    }));

    const result = await manager.captureScreenshot({
      target: 'full_application',
      autoOpen: true,
      aiInitiated: true,
      auto_save: true,
    });

    expect(result.success).toBe(true);
    expect(manager.captureNativeScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        autoOpen: true,
        aiInitiated: true,
      })
    );
  });

  it('returns image data without forcing a file save', async () => {
    const manager = createManager();
    const previousElectronAPI = window.electronAPI;
    window.electronAPI = {
      captureScreenshot: vi.fn(async options => ({
        success: true,
        target: options.target,
        mode: options.mode,
        format: 'png',
        mimeType: 'image/png',
        width: 320,
        height: 200,
        imageSizeBytes: 4,
        imageData: 'AAAA',
        imageDataEncoding: 'base64',
        maxImageBytes: options.maxImageBytes,
      })),
    };

    try {
      const result = await manager.captureScreenshot({
        target: 'full_application',
        returnImageData: true,
        maxImageBytes: 12345,
      });

      expect(result.success).toBe(true);
      expect(result.imageData).toBe('AAAA');
      expect(result.mimeType).toBe('image/png');
      expect(window.electronAPI.captureScreenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'full_application',
          returnImageData: true,
          maxImageBytes: 12345,
          filePath: null,
          save: false,
        })
      );
    } finally {
      window.electronAPI = previousElectronAPI;
    }
  });
});
