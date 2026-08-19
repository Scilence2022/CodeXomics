'use strict';

/**
 * Screenshot rects are measured in the renderer with getBoundingClientRect(), so they arrive
 * in CSS pixels. webContents.capturePage() expects device-independent pixels of the view, and
 * the two only agree while the page zoom factor is 1 — after the user zooms the interface
 * (View > Zoom In/Out) every CSS pixel covers `zoomFactor` device-independent pixels.
 */

function sanitizeScreenshotRect(rect) {
  if (!rect || typeof rect !== 'object') return undefined;

  const x = Math.max(0, Math.floor(Number(rect.x) || 0));
  const y = Math.max(0, Math.floor(Number(rect.y) || 0));
  const width = Math.max(1, Math.ceil(Number(rect.width) || 0));
  const height = Math.max(1, Math.ceil(Number(rect.height) || 0));

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return undefined;
  }

  return { x, y, width, height };
}

function normalizeZoomFactor(zoomFactor) {
  const factor = Number(zoomFactor);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function scaleScreenshotRectByZoom(rect, zoomFactor) {
  if (!rect) return undefined;

  const factor = normalizeZoomFactor(zoomFactor);
  if (factor === 1) return rect;

  // Scale the edges rather than the size so rounding never trims content off the far edge.
  const left = Math.max(0, Math.floor(rect.x * factor));
  const top = Math.max(0, Math.floor(rect.y * factor));
  const right = Math.ceil((rect.x + rect.width) * factor);
  const bottom = Math.ceil((rect.y + rect.height) * factor);

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function getWebContentsZoomFactor(webContents) {
  try {
    if (!webContents || typeof webContents.getZoomFactor !== 'function') return 1;
    return normalizeZoomFactor(webContents.getZoomFactor());
  } catch {
    return 1;
  }
}

/**
 * Convert a renderer-supplied CSS-pixel rect into the capture rect for a given webContents.
 * Returns undefined when no rect was requested so the whole page is captured.
 */
function resolveCaptureRect(rect, webContents) {
  return scaleScreenshotRectByZoom(sanitizeScreenshotRect(rect), getWebContentsZoomFactor(webContents));
}

module.exports = {
  sanitizeScreenshotRect,
  scaleScreenshotRectByZoom,
  getWebContentsZoomFactor,
  resolveCaptureRect,
};
