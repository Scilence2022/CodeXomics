import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import TrackRenderer from '../../src/renderer/modules/TrackRenderer.js';

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
      start: 110,
      end: 175,
      coordinateSystem: 'zero-based-inclusive',
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
    expect(tooltip.textContent).toContain('Position: 5');
    expect(tooltip.textContent).toContain('Coverage: 1x');
  });

  it('styles track data tooltips with theme variables', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/renderer/css/legacy/01-main-interface.css'), 'utf8');
    const tooltipRule = css.slice(css.indexOf('.track-data-tooltip {'), css.indexOf('.track-data-tooltip__title'));

    expect(tooltipRule).toContain('background: var(--bg-primary)');
    expect(tooltipRule).toContain('color: var(--text-primary)');
    expect(tooltipRule).toContain('border: 1px solid var(--border-color)');
  });
});
