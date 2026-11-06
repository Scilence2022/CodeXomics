import { describe, expect, it, vi } from 'vitest';
import NavigationManager from '../../src/renderer/modules/NavigationManager.js';

describe('aligned reads redraw', () => {
  it('cancels a superseded BAM render and keeps the latest content when the old work returns late', async () => {
    const bamFile = { metadata: { id: 'sample' } };
    let finishPrevious;
    let previousSignal;
    const createSingleReadsTrackContent = vi
      .fn()
      .mockImplementationOnce((_chromosome, _file, _viewport, signal) => {
        previousSignal = signal;
        return new Promise(resolve => {
          finishPrevious = resolve;
        });
      })
      .mockImplementation(async (_chromosome, _file, viewport) => {
        const content = document.createElement('div');
        content.className = 'track-content';
        content.textContent = `Range ${viewport.start}–${viewport.end}`;
        return content;
      });

    const track = document.createElement('div');
    track.className = 'reads-track';
    track.dataset.fileId = bamFile.metadata.id;
    const content = document.createElement('div');
    content.className = 'track-content';
    track.appendChild(content);
    document.body.appendChild(track);

    const navigation = Object.assign(Object.create(NavigationManager.prototype), {
      genomeBrowser: {
        currentChromosome: 'chr1',
        currentPosition: { start: 0, end: 100 },
        multiFileManager: { getBamFiles: () => [bamFile] },
        trackRenderer: { createSingleReadsTrackContent },
      },
    });

    try {
      const previous = navigation.updateAlignedReadsTrackOnly('chr1');
      navigation.genomeBrowser.currentPosition = { start: 50, end: 100 };
      await navigation.updateAlignedReadsTrackOnly('chr1');
      expect(previousSignal.aborted).toBe(true);

      const stale = document.createElement('span');
      stale.textContent = 'Obsolete range';
      finishPrevious(stale);
      await previous;
      expect(content.textContent).toBe('Range 50–100');

      navigation.genomeBrowser.currentPosition = { start: 70, end: 100 };
      await navigation.updateAlignedReadsTrackOnly('chr1');
      expect(createSingleReadsTrackContent).toHaveBeenCalledTimes(3);
      expect(content.textContent).toBe('Range 70–100');
    } finally {
      track.remove();
    }
  });
});
