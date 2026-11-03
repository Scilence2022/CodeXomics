import { describe, it, expect, afterEach } from 'vitest';
import TrackRenderer from '../../src/renderer/modules/TrackRenderer.js';

const renderer = () => Object.create(TrackRenderer.prototype);

// 100 bp G-rich then 100 bp C-rich: skew +1 on the left, -1 on the right.
const G_THEN_C = 'G'.repeat(50) + 'A'.repeat(50) + 'C'.repeat(50) + 'T'.repeat(50);

describe('GC content & skew track data', () => {
  it('scales skew symmetrically about zero', () => {
    const data = renderer().calculateDynamicGCData('GGGA'.repeat(50) + 'GCAT'.repeat(50), 20, 5);
    expect(data.skewMin).toBeCloseTo(-data.skewMax);
    expect(data.skewMax).toBeGreaterThan(0);
  });

  it('adds a final window flush with the end of the sequence', () => {
    const data = renderer().calculateDynamicGCData('ACGT'.repeat(26), 20, 8); // 104 bp; steps stop at 80
    const last = data.detailedData.at(-1);
    expect(last.windowEnd).toBe(104);
  });

  it('breaks the line at windows that contain no A/C/G/T', () => {
    const sequence = 'ACGT'.repeat(10) + 'N'.repeat(40) + 'GGCC'.repeat(10);
    const data = renderer().calculateDynamicGCData(sequence, 10, 10);
    expect(data.segmentStarts).toEqual([0, 4]);
  });

  it('plots positions against the viewport span, not the sequence length', () => {
    const data = renderer().calculateDynamicGCData('ACGT'.repeat(25), 10, 10, 200);
    expect(data.domainLength).toBe(200);
  });
});

describe('GC content & skew track layout', () => {
  it('puts the skew zero line mid-panel with positive skew above it', () => {
    const r = renderer();
    const data = r.calculateDynamicGCData(G_THEN_C, 50, 50);
    const { geometry, skewSegments } = r.computeGCSkewLayout(data, 400, 140);

    expect(geometry.zeroY).toBeCloseTo((geometry.skewTop + geometry.skewBottom) / 2);
    // Skip the flat extension point prepended before the first window centre.
    const [gRich, , cRich] = skewSegments[0].slice(1);
    expect(gRich[1]).toBeLessThan(geometry.zeroY);
    expect(cRich[1]).toBeGreaterThan(geometry.zeroY);
    for (const [, y] of skewSegments[0]) {
      expect(y).toBeGreaterThanOrEqual(geometry.skewTop);
      expect(y).toBeLessThanOrEqual(geometry.skewBottom);
    }
  });

  it('keeps GC% inside the upper panel', () => {
    const r = renderer();
    const data = r.calculateDynamicGCData(G_THEN_C, 50, 25);
    const { geometry, gcSegments } = r.computeGCSkewLayout(data, 400, 140);
    for (const [, y] of gcSegments[0]) {
      expect(y).toBeGreaterThanOrEqual(geometry.gcTop);
      expect(y).toBeLessThanOrEqual(geometry.gcBottom);
    }
  });

  it('extends the plot flush with both edges of the view', () => {
    const r = renderer();
    const data = r.calculateDynamicGCData(G_THEN_C, 50, 25);
    const { geometry, gcSegments, skewSegments } = r.computeGCSkewLayout(data, 400, 140);

    for (const segments of [gcSegments, skewSegments]) {
      const [firstX] = segments[0][0];
      const [lastX] = segments.at(-1).at(-1);
      expect(firstX).toBeCloseTo(geometry.plotLeft);
      expect(lastX).toBeCloseTo(geometry.plotRight);
    }
  });

  it('holds the edge windows flat out to their boundaries', () => {
    const r = renderer();
    const data = r.calculateDynamicGCData(G_THEN_C, 50, 25);
    const { gcSegments } = r.computeGCSkewLayout(data, 400, 140);

    // Extension points share the y of the window centre they extend.
    expect(gcSegments[0][0][1]).toBeCloseTo(gcSegments[0][1][1]);
    expect(gcSegments[0].at(-1)[1]).toBeCloseTo(gcSegments[0].at(-2)[1]);
  });

  it('stops the plot at the sequence end when the view runs past it', () => {
    const r = renderer();
    // 100 bp of sequence inside a 200 bp view.
    const data = r.calculateDynamicGCData(
      'G'.repeat(25) + 'A'.repeat(25) + 'C'.repeat(25) + 'T'.repeat(25),
      50,
      50,
      200
    );
    const { geometry, gcSegments } = r.computeGCSkewLayout(data, 400, 140);

    expect(gcSegments[0][0][0]).toBeCloseTo(geometry.plotLeft);
    expect(gcSegments[0].at(-1)[0]).toBeCloseTo(geometry.plotLeft + 0.5 * (geometry.plotRight - geometry.plotLeft));
    expect(gcSegments[0].at(-1)[0]).toBeLessThan(geometry.plotRight);
  });
});

describe('GC content & skew track rendering', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const render = r => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    r.renderSVGGCVisualization(svg, r.calculateDynamicGCData(G_THEN_C, 50, 25), 400, {});
    document.body.appendChild(svg);
    return svg;
  };

  it('clips the skew fill at zero and gives each plot unique ids', () => {
    const r = renderer();
    const first = render(r);
    const second = render(r);

    expect(first.querySelectorAll('clipPath')).toHaveLength(2);
    const firstIds = [...first.querySelectorAll('[id]')].map(el => el.id);
    const secondIds = [...second.querySelectorAll('[id]')].map(el => el.id);
    expect(firstIds.some(id => secondIds.includes(id))).toBe(false);
  });

  it('labels both panels with the scale they were drawn at', () => {
    const labels = [...render(renderer()).querySelectorAll('.axis-labels text')].map(t => t.textContent);
    expect(labels.some(text => text.startsWith('GC '))).toBe(true);
    expect(labels.some(text => text.startsWith('Skew +'))).toBe(true);
    expect(labels).toContain('0');
  });

  it('uses the configured plot colours in the legend', () => {
    const legend = renderer().createGCLegend({ contentColor: '#123456' });
    expect(legend.textContent).toContain('GC Content');
    expect(legend.querySelector(':scope > div > div').style.background).toMatch(/#123456|rgb\(18, 52, 86\)/);
  });
});
