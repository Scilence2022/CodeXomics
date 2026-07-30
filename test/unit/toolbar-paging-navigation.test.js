/**
 * Toolbar paging controls (⏮ ◀ ▶ ⏭).
 *
 * The toolbar exposes previous/next page plus jump-to-start/end. All four keep
 * the current window width — the width is the user's zoom level, so paging into
 * either end of the sequence must slide the window, never shrink it.
 */
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const NavigationManager = require('../../src/renderer/modules/NavigationManager.js');

const SEQUENCE_LENGTH = 10500;

function createNavigationManager({ start, end, sequences, selectedChromosome = 'U00096' } = {}) {
  document.body.innerHTML = `<select id="chromosomeSelect"><option value="${selectedChromosome}" selected></option></select>`;
  const genomeBrowser = {
    currentSequence: sequences ?? { U00096: 'A'.repeat(SEQUENCE_LENGTH) },
    currentPosition: { start, end },
    currentChromosome: selectedChromosome,
    updateStatistics: vi.fn(),
    displayGenomeView: vi.fn(),
    genomeNavigationBar: { update: vi.fn() },
    tabManager: { updateCurrentTabPosition: vi.fn() },
  };
  const nm = Object.create(NavigationManager.prototype);
  nm.genomeBrowser = genomeBrowser;
  return { nm, genomeBrowser };
}

describe('toolbar paging controls', () => {
  it('pages forward and backward by exactly one window width', () => {
    const { nm, genomeBrowser } = createNavigationManager({ start: 1000, end: 2000 });

    nm.navigateNext();
    expect(genomeBrowser.currentPosition).toEqual({ start: 2000, end: 3000 });

    nm.navigatePrevious();
    expect(genomeBrowser.currentPosition).toEqual({ start: 1000, end: 2000 });
  });

  it('keeps the window width when paging into the tail of the sequence', () => {
    const { nm, genomeBrowser } = createNavigationManager({ start: 9000, end: 10000 });

    nm.navigateNext();

    // Clamping the start (not the end) leaves a full 1000 bp window.
    expect(genomeBrowser.currentPosition).toEqual({ start: 9500, end: SEQUENCE_LENGTH });
  });

  it('clamps at the first base when paging back past the start', () => {
    const { nm, genomeBrowser } = createNavigationManager({ start: 400, end: 1400 });

    nm.navigatePrevious();

    expect(genomeBrowser.currentPosition).toEqual({ start: 0, end: 1000 });
  });

  it('jumps to the first and last window at the current zoom level', () => {
    const { nm, genomeBrowser } = createNavigationManager({ start: 4000, end: 5000 });

    nm.navigateToStart();
    expect(genomeBrowser.currentPosition).toEqual({ start: 0, end: 1000 });

    nm.navigateToEnd();
    expect(genomeBrowser.currentPosition).toEqual({ start: SEQUENCE_LENGTH - 1000, end: SEQUENCE_LENGTH });
  });

  it('shows the whole sequence when it is shorter than the current window', () => {
    const { nm, genomeBrowser } = createNavigationManager({
      start: 0,
      end: 50000,
      sequences: { U00096: 'A'.repeat(800) },
    });

    nm.navigateToEnd();
    expect(genomeBrowser.currentPosition).toEqual({ start: 0, end: 800 });

    genomeBrowser.currentPosition = { start: 0, end: 50000 };
    nm.navigateToStart();
    expect(genomeBrowser.currentPosition).toEqual({ start: 0, end: 800 });
  });

  it('refreshes the view, nav bar and tab title on every committed move', () => {
    const { nm, genomeBrowser } = createNavigationManager({ start: 0, end: 1000 });

    nm.navigateNext();

    expect(genomeBrowser.updateStatistics).toHaveBeenCalledTimes(1);
    expect(genomeBrowser.displayGenomeView).toHaveBeenCalledTimes(1);
    expect(genomeBrowser.genomeNavigationBar.update).toHaveBeenCalledTimes(1);
    // Tab titles are 1-based while currentPosition is 0-based.
    expect(genomeBrowser.tabManager.updateCurrentTabPosition).toHaveBeenCalledWith('U00096', 1001, 2000, {
      source: 'navigation',
    });
  });

  it('skips the re-render when a button is clicked again at an edge', () => {
    const { nm, genomeBrowser } = createNavigationManager({ start: 0, end: 1000 });

    nm.navigateToStart();
    nm.navigatePrevious();

    expect(genomeBrowser.displayGenomeView).not.toHaveBeenCalled();
  });

  it('does nothing when no sequence is loaded', () => {
    const { nm, genomeBrowser } = createNavigationManager({ start: 0, end: 1000, sequences: {} });

    nm.navigateToStart();
    nm.navigatePrevious();
    nm.navigateNext();
    nm.navigateToEnd();

    expect(genomeBrowser.currentPosition).toEqual({ start: 0, end: 1000 });
    expect(genomeBrowser.displayGenomeView).not.toHaveBeenCalled();
  });
});
