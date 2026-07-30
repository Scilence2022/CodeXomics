import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import TrackRenderer from '../../src/renderer/modules/TrackRenderer.js';

function createGenomeBrowser() {
  return {
    currentChromosome: 'chr1',
    currentSequence: { chr1: 'ACGT' },
    configManager: {
      get: vi.fn(() => ({})),
      set: vi.fn(),
      saveConfig: vi.fn(),
    },
    navigationManager: {
      updateAlignedReadsTrackOnly: vi.fn(),
    },
  };
}

describe('Track header controls', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('gives every generated track-title-bar button a visible hint and accessible name', () => {
    const renderer = new TrackRenderer(createGenomeBrowser());

    Object.entries(renderer.trackConfig).forEach(([trackType, config]) => {
      const header = renderer.createTrackHeader(config.header, trackType);
      const buttons = header.querySelectorAll('button');

      expect(buttons.length, `${trackType} should expose header controls`).toBeGreaterThan(0);
      buttons.forEach(button => {
        expect(button.title, `${trackType} button should keep a native hint`).not.toBe('');
        expect(button.dataset.tooltip, `${trackType} button should expose a visible tooltip`).toBe(button.title);
        expect(button.getAttribute('aria-label'), `${trackType} button should have an accessible name`).toBe(
          button.title
        );
      });
    });
  });

  it('labels the third reads control clearly and persists its per-track visibility', () => {
    const genomeBrowser = createGenomeBrowser();
    const renderer = new TrackRenderer(genomeBrowser);
    const track = document.createElement('div');
    track.className = 'reads-track';
    track.dataset.fileId = 'bam-1';
    track.appendChild(renderer.createTrackHeader('sample.bam', 'reads', 'bam-1'));
    document.body.appendChild(track);
    vi.stubGlobal('requestAnimationFrame', callback => {
      callback();
      return 1;
    });

    const readsButton = track.querySelector('.track-reads-toggle-btn[data-toggle-type="readsReads"]');
    expect(readsButton.title).toContain('coverage and reference remain visible');
    expect(readsButton.getAttribute('aria-pressed')).toBe('true');

    readsButton.click();

    expect(renderer.getTrackSettings('reads', 'bam-1').showReads).toBe(false);
    expect(readsButton.getAttribute('aria-pressed')).toBe('false');
    expect(readsButton.dataset.tooltip).toBe('Show aligned reads');
    expect(genomeBrowser.navigationManager.updateAlignedReadsTrackOnly).toHaveBeenCalledWith('chr1', 'ACGT');
  });

  it('does not render read rows in the dense scroll layout when reads are hidden', () => {
    const renderer = new TrackRenderer(createGenomeBrowser());
    renderer.ensureReadsScrollDragHandlers = vi.fn();
    renderer.renderVisibleRows = vi.fn();
    const trackContent = document.createElement('div');

    renderer.createScrollableReadsTrack(
      trackContent,
      [[{ id: 'read-1' }]],
      { start: 0, end: 100 },
      {
        readHeight: 4,
        rowSpacing: 2,
        topPadding: 75,
        bottomPadding: 10,
        trackHeight: 150,
      },
      { showReads: false, renderingMode: 'canvas' }
    );

    expect(trackContent.style.height).toBe('150px');
    expect(trackContent.querySelector('.reads-scroll-container')).toBeNull();
    expect(renderer.renderVisibleRows).not.toHaveBeenCalled();
    expect(renderer.ensureReadsScrollDragHandlers).not.toHaveBeenCalled();
  });

  it('keeps the static bottom-sequence title-bar buttons in the same tooltip system', () => {
    const html = fs.readFileSync(path.join(process.cwd(), 'src/renderer/index.html'), 'utf8');
    const fixture = document.createElement('div');
    fixture.innerHTML = html;

    const buttons = fixture.querySelectorAll('.sequence-header-btn');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(button => {
      expect(button.getAttribute('data-tooltip')).toBe(button.title);
      expect(button.getAttribute('aria-label')).toBe(button.title);
    });
  });
});
