import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  sanitizeScreenshotRect,
  scaleScreenshotRectByZoom,
  getWebContentsZoomFactor,
  resolveCaptureRect,
} = require('../../src/main/screenshot-rect.js');

describe('screenshot rect conversion', () => {
  it('sanitizes renderer supplied rects', () => {
    expect(sanitizeScreenshotRect({ x: -5, y: 10.7, width: 100.2, height: 0 })).toEqual({
      x: 0,
      y: 10,
      width: 101,
      height: 1,
    });
    expect(sanitizeScreenshotRect(undefined)).toBeUndefined();
    expect(sanitizeScreenshotRect('nope')).toBeUndefined();
  });

  it('keeps CSS pixels unchanged while the page is not zoomed', () => {
    const rect = { x: 150, y: 200, width: 220, height: 90 };
    expect(scaleScreenshotRectByZoom(rect, 1)).toEqual(rect);
  });

  it('converts CSS pixels into the zoomed view pixels capturePage expects', () => {
    expect(scaleScreenshotRectByZoom({ x: 100, y: 120, width: 200, height: 80 }, 1.5)).toEqual({
      x: 150,
      y: 180,
      width: 300,
      height: 120,
    });
    expect(scaleScreenshotRectByZoom({ x: 100, y: 120, width: 200, height: 80 }, 0.75)).toEqual({
      x: 75,
      y: 90,
      width: 150,
      height: 60,
    });
  });

  it('rounds outward so a zoomed capture never crops the target', () => {
    const scaled = scaleScreenshotRectByZoom({ x: 10, y: 10, width: 101, height: 101 }, 1.1);
    expect(scaled.x).toBe(11);
    expect(scaled.y).toBe(11);
    expect(scaled.x + scaled.width).toBeGreaterThanOrEqual((10 + 101) * 1.1);
    expect(scaled.y + scaled.height).toBeGreaterThanOrEqual((10 + 101) * 1.1);
  });

  it('falls back to an unscaled rect for unusable zoom factors', () => {
    const rect = { x: 4, y: 6, width: 8, height: 10 };
    for (const factor of [0, -2, Number.NaN, undefined, null]) {
      expect(scaleScreenshotRectByZoom(rect, factor)).toEqual(rect);
    }
    expect(scaleScreenshotRectByZoom(undefined, 2)).toBeUndefined();
  });

  it('reads the zoom factor defensively', () => {
    expect(getWebContentsZoomFactor({ getZoomFactor: () => 2 })).toBe(2);
    expect(getWebContentsZoomFactor({ getZoomFactor: () => 0 })).toBe(1);
    expect(
      getWebContentsZoomFactor({
        getZoomFactor: () => {
          throw new Error('destroyed');
        },
      })
    ).toBe(1);
    expect(getWebContentsZoomFactor(null)).toBe(1);
  });

  it('resolves a capture rect for a zoomed webContents', () => {
    const webContents = { getZoomFactor: () => 1.25 };
    expect(resolveCaptureRect({ x: 40, y: 80, width: 200, height: 100 }, webContents)).toEqual({
      x: 50,
      y: 100,
      width: 250,
      height: 125,
    });
  });

  it('captures the whole page when no rect was requested', () => {
    expect(resolveCaptureRect(undefined, { getZoomFactor: () => 1.5 })).toBeUndefined();
  });
});
