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
        </div>
      </div>
      <div id="sequenceDisplaySection" style="display: flex;">
        <div class="sequence-header"><h4>Sequence View</h4></div>
        <div id="sequenceContent"></div>
      </div>
    `;
    const genesTrack = document.querySelector('[data-track-type="genes"]');
    const sequencePanel = document.getElementById('sequenceDisplaySection');
    setRect(genesTrack, { left: 10, top: 20, right: 210, bottom: 120, width: 200, height: 100 });
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
    expect(result.tracks.map(track => track.trackType)).toEqual(['genes', 'sequence']);
    expect(manager.captureNativeScreenshot).toHaveBeenCalledTimes(2);
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
        rect: { x: 15, y: 300, width: 500, height: 200 },
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
    expect(result.filePaths).toEqual(['/screenshots/tracks-genes.png', '/screenshots/tracks-sequence.png']);
    expect(manager.captureElementScreenshot).toHaveBeenNthCalledWith(
      1,
      genesTrack,
      expect.objectContaining({
        target: 'track',
        mode: 'full',
        filePath: '/screenshots/tracks-genes.png',
      })
    );
    expect(manager.captureElementScreenshot).toHaveBeenNthCalledWith(
      2,
      sequencePanel,
      expect.objectContaining({
        target: 'track',
        mode: 'full',
        filePath: '/screenshots/tracks-sequence.png',
      })
    );
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
});
