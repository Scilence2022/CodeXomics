import { describe, it, expect, vi, afterEach } from 'vitest';
import TrackRenderer from '../../src/renderer/modules/TrackRenderer.js';

describe('TrackRenderer reads resize handling', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('resizes the reads SVG without changing the coverage viewBox', () => {
    document.body.innerHTML = `
      <div class="reads-track">
        <div class="track-content">
          <svg class="coverage-svg" viewBox="0 0 100 50"></svg>
          <svg class="reads-svg-container" viewBox="0 0 800 150"></svg>
        </div>
      </div>
    `;

    const trackContent = document.querySelector('.track-content');
    const coverageSvg = document.querySelector('.coverage-svg');
    const readsSvg = document.querySelector('.reads-svg-container');

    vi.spyOn(trackContent, 'getBoundingClientRect').mockReturnValue({
      width: 1200,
      height: 150,
      top: 0,
      right: 1200,
      bottom: 150,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(readsSvg, 'getBoundingClientRect').mockReturnValue({
      width: 1200,
      height: 150,
      top: 0,
      right: 1200,
      bottom: 150,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    TrackRenderer.prototype.updateReadsTrackSVG.call({}, 'chr1');

    expect(coverageSvg.getAttribute('viewBox')).toBe('0 0 100 50');
    expect(readsSvg.getAttribute('viewBox')).toBe('0 0 1200 150');
  });
});
