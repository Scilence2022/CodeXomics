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

  it('treats target=track with trackType=all as visible tracks when mode is visible', async () => {
    const manager = createManager();
    const tracksElement = document.createElement('div');
    tracksElement.getBoundingClientRect = () => ({ left: 10, top: 20, right: 210, bottom: 120 });
    manager.getTracksElement = vi.fn(() => tracksElement);
    manager.captureNativeScreenshot = vi.fn(async options => ({
      success: true,
      target: options.target,
      mode: options.mode,
    }));

    const result = await manager.captureScreenshot({
      target: 'track',
      trackType: 'all',
      mode: 'visible',
      auto_save: true,
    });

    expect(result.success).toBe(true);
    expect(manager.getTracksElement).toHaveBeenCalled();
    expect(manager.captureNativeScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'visible_tracks',
        mode: 'visible',
        rect: { x: 10, y: 20, width: 200, height: 100 },
      })
    );
  });

  it('treats target=track with trackType=all as full all-tracks capture by default', async () => {
    const manager = createManager();
    const tracksElement = document.createElement('div');
    manager.getTracksElement = vi.fn(() => tracksElement);
    manager.renderElementToDataUrl = vi.fn().mockResolvedValue('data:image/png;base64,AAAA');
    manager.saveRenderedScreenshot = vi.fn(async options => ({
      success: true,
      target: options.target,
      mode: options.mode,
    }));

    const result = await manager.captureScreenshot({
      target: 'track',
      trackType: 'all',
      auto_save: true,
    });

    expect(result.success).toBe(true);
    expect(manager.renderElementToDataUrl).toHaveBeenCalledWith(
      tracksElement,
      expect.objectContaining({
        target: 'tracks',
        mode: 'full',
      })
    );
    expect(manager.saveRenderedScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'tracks',
        mode: 'full',
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
