import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import TrackRenderer from '../../src/renderer/modules/TrackRenderer.js';
import PrimerLibraryUI from '../../src/renderer/modules/PrimerLibraryUI.js';

describe('Aligned reads reference and coverage interactions', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function createGenomeBrowser() {
    return {
      currentChromosome: 'chr1',
      currentSequenceSelection: null,
      sequenceSelection: { start: null, end: null, active: false },
      clearSequenceSelection: vi.fn(),
      updateCopyButtonState: vi.fn(),
      showNotification: vi.fn(),
      uiManager: {
        updateStatus: vi.fn(),
      },
    };
  }

  it('selects a partial reference interval by dragging across the reference band', () => {
    const genomeBrowser = createGenomeBrowser();
    const renderer = new TrackRenderer(genomeBrowser);
    const reference = document.createElement('div');
    document.body.appendChild(reference);

    vi.spyOn(reference, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 25,
      top: 0,
      right: 400,
      bottom: 25,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    renderer.setupReferenceSequenceSelection(reference, { start: 100, end: 200 });
    reference.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 40 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 }));
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 300 }));

    expect(genomeBrowser.currentSequenceSelection).toEqual({
      chromosome: 'chr1',
      start: 111,
      end: 176,
      active: true,
      coordinateSystem: 'one-based-inclusive',
      source: 'aligned-reads-reference',
      length: 66,
      wrapsOrigin: false,
      segments: [{ start: 111, end: 176 }],
    });
    expect(genomeBrowser.sequenceSelection.source).toBe('aligned-reads-reference');
    expect(genomeBrowser.updateCopyButtonState).toHaveBeenCalled();
    expect(reference.querySelector('.reads-reference-selection')).not.toBeNull();
  });

  it('shows position-specific coverage details on hover', () => {
    const renderer = new TrackRenderer(createGenomeBrowser());
    const trackContent = document.createElement('div');
    document.body.appendChild(trackContent);

    renderer.createCoverageVisualization(trackContent, [{ start: 0, end: 9 }], { start: 0, end: 10 }, 50, {
      coverageColor: '#4a90e2',
      coverageStrokeColor: '#2c5aa0',
    });

    const coverage = trackContent.querySelector('.coverage-visualization');
    const svg = coverage.querySelector('.coverage-svg');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      width: 100,
      height: 50,
      top: 0,
      right: 100,
      bottom: 50,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(coverage, 'getBoundingClientRect').mockReturnValue({
      width: 100,
      height: 50,
      top: 0,
      right: 100,
      bottom: 50,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 55, clientY: 25 }));

    const tooltip = coverage.querySelector('.coverage-tooltip');
    expect(tooltip.style.display).toBe('block');
    expect(tooltip.textContent).toContain('Position: 6');
    expect(tooltip.textContent).toContain('Coverage: 1x');
  });

  it('keeps the coverage hover panel above the reference and reads layers', () => {
    const renderer = new TrackRenderer(createGenomeBrowser());
    const trackContent = document.createElement('div');
    document.body.appendChild(trackContent);

    vi.spyOn(renderer, 'getReferenceSequence').mockReturnValue('ACGTACGTACGT');
    renderer.createCoverageVisualization(trackContent, [{ start: 0, end: 11 }], { start: 0, end: 12 }, 50, {});
    renderer.createReferenceVisualization(trackContent, { start: 0, end: 12 }, 20, {});

    const coverage = trackContent.querySelector('.coverage-visualization');
    const reference = trackContent.querySelector('.reference-sequence-visualization');

    expect(coverage.style.overflow).toBe('visible');
    expect(Number(coverage.style.zIndex)).toBeGreaterThan(Number(reference.style.zIndex));
    expect(Number(coverage.style.zIndex)).toBeGreaterThan(49);
  });

  it('represents a circular cross-origin reference selection as ordered one-based segments', () => {
    const genomeBrowser = createGenomeBrowser();
    genomeBrowser.currentSequence = { chr1: 'A'.repeat(100) };
    genomeBrowser.navigationManager = { circularMode: true };
    const renderer = new TrackRenderer(genomeBrowser);

    const selection = renderer.createManualSelectionFromDisplayRange(95, 104, 'aligned-reads-reference', 'chr1');

    expect(selection).toEqual({
      chromosome: 'chr1',
      start: 96,
      end: 5,
      active: true,
      coordinateSystem: 'one-based-inclusive',
      source: 'aligned-reads-reference',
      length: 10,
      wrapsOrigin: true,
      segments: [
        { start: 96, end: 100 },
        { start: 1, end: 5 },
      ],
    });
  });

  it('prefills primer sequence from canonical and legacy manual selections without shifting bases', () => {
    const genomeBrowser = {
      currentChromosome: 'chr1',
      currentSequence: { chr1: 'AACCGGTT' },
      currentSequenceSelection: {
        chromosome: 'chr1',
        start: 3,
        end: 6,
        coordinateSystem: 'one-based-inclusive',
      },
    };
    const primerLibrary = new PrimerLibraryUI(genomeBrowser);

    expect(primerLibrary._selectionSequence()).toBe('CCGG');

    genomeBrowser.currentSequenceSelection = {
      chromosome: 'chr1',
      start: 2,
      end: 5,
      coordinateSystem: 'zero-based-inclusive',
    };
    expect(primerLibrary._selectionSequence()).toBe('CCGG');
  });

  it('styles track data tooltips with theme variables', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/renderer/css/legacy/01-main-interface.css'), 'utf8');
    const tooltipRule = css.slice(css.indexOf('.track-data-tooltip {'), css.indexOf('.track-data-tooltip__title'));

    expect(tooltipRule).toContain('background: var(--bg-primary)');
    expect(tooltipRule).toContain('color: var(--text-primary)');
    expect(tooltipRule).toContain('border: 1px solid var(--border-color)');
  });
});
