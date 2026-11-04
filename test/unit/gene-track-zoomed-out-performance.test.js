/**
 * Zoomed-out gene track performance regressions.
 *
 * 1. The detailed (secondary) ruler's interval ladder used to stop at 100 kb.
 *    Any view wider than ~800 kb found no interval that fit and fell back to a
 *    1 bp interval: one tick, label and measureText per base (~930k per redraw
 *    at a 933 kb view), redrawn on every drag frame — the UI froze for seconds.
 * 2. getGeneOperonInfo() scanned every operon for every gene. OperonLookupIndex
 *    replaces the scan and must return exactly the operon the scan returned.
 */
import { describe, it, expect } from 'vitest';
import TrackRenderer from '../../src/renderer/modules/TrackRenderer.js';
import OperonLookupIndex from '../../src/renderer/modules/OperonLookupIndex.js';

const renderer = () => Object.create(TrackRenderer.prototype);

describe('detailed ruler tick spacing', () => {
  const widths = [300, 800, 1300, 2400];
  const ranges = [10, 500, 5000, 120000, 800000, 933516, 4641652, 250000000];

  it('never exceeds the target tick count, however wide the view', () => {
    for (const width of widths) {
      const target = Math.max(3, Math.min(8, width / 100));
      for (const range of ranges) {
        const { majorInterval } = renderer().calculateDetailedTickSpacing(range, width);
        expect(range / majorInterval).toBeLessThanOrEqual(target);
      }
    }
  });

  it('picks round intervals for the zoom levels that used to fall back to 1 bp', () => {
    expect(renderer().calculateDetailedTickSpacing(933516, 1300)).toEqual({
      majorInterval: 200000,
      minorInterval: 20000,
    });
    expect(renderer().calculateDetailedTickSpacing(4641652, 1300).majorInterval).toBe(1000000);
  });

  it('keeps the original intervals below 800 kb', () => {
    expect(renderer().calculateDetailedTickSpacing(5000, 1300)).toEqual({ majorInterval: 1000, minorInterval: 100 });
    expect(renderer().calculateDetailedTickSpacing(180, 1300).majorInterval).toBe(25);
    expect(renderer().calculateDetailedTickSpacing(5, 1300).majorInterval).toBe(1);
  });

  it('draws a bounded number of ticks for a whole-genome view', () => {
    let strokes = 0;
    let labels = 0;
    const ctx = {
      clearRect() {},
      fillRect() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke: () => strokes++,
      fillText: () => labels++,
      measureText: text => ({ width: text.length * 6 }),
      save() {},
      restore() {},
    };
    const r = renderer();
    r.genomeBrowser = { currentSequence: { chr: 'A'.repeat(10) } };
    r.getTrackSettings = () => ({});
    r.isCircularModeEnabled = () => false;

    r.drawDetailedRulerWithPosition(ctx, 1300, 'chr', { start: 0, end: 4641652 });

    expect(labels).toBeGreaterThan(2);
    expect(labels).toBeLessThanOrEqual(8);
    expect(strokes).toBeLessThanOrEqual(3); // major ticks, minor ticks, bottom border
  });
});

describe('OperonLookupIndex', () => {
  const nameOf = g => g.qualifiers?.gene || g.qualifiers?.locus_tag || '';

  // The linear scan getGeneOperonInfo() performed before the index existed.
  const scan = (gene, operons) => {
    for (const operon of operons) {
      if (operon.genes.some(g => g === gene)) return operon;
      if (operon.genes.some(g => g.start === gene.start && g.end === gene.end)) return operon;
      if (gene.start >= operon.start && gene.end <= operon.end && gene.strand === operon.strand) {
        const geneName = nameOf(gene);
        if (geneName && operon.genes.some(g => nameOf(g) === geneName)) return operon;
      }
    }
    return null;
  };

  const gene = (start, end, strand, name) => ({
    start,
    end,
    strand,
    type: 'CDS',
    qualifiers: name ? { gene: name } : {},
  });

  it('matches the linear scan on every precedence case', () => {
    const a = gene(100, 200, 1, 'abcA');
    const b = gene(250, 400, 1, 'abcB');
    const c = gene(1000, 1200, -1, 'xyzC');
    const shared = gene(5000, 5100, 1, 'dup');
    const operons = [
      { name: 'abc_operon', start: 100, end: 400, strand: 1, genes: [a, b] },
      { name: 'xyz_operon', start: 900, end: 1300, strand: -1, genes: [c] },
      { name: 'first_dup', start: 4000, end: 6000, strand: 1, genes: [shared] },
      { name: 'second_dup', start: 4000, end: 6000, strand: 1, genes: [shared] },
      // Name-only match: copy of xyzC that is a different object at other coordinates.
      { name: 'late_name', start: 2000, end: 3000, strand: 1, genes: [gene(2100, 2200, 1, 'late')] },
    ];
    const index = new OperonLookupIndex(operons, nameOf);

    const probes = [
      a, // identity
      b,
      gene(100, 200, 1), // position only (different object, no name)
      gene(950, 1050, -1, 'xyzC'), // name + inside span + same strand
      gene(950, 1050, 1, 'xyzC'), // wrong strand -> no match
      gene(800, 1050, -1, 'xyzC'), // outside span -> no match
      shared, // identity in two operons -> first wins
      gene(2500, 2600, 1, 'late'), // name match in a later operon
      gene(7000, 7100, 1, 'none'), // no operon
      gene(250, 400, -1), // position match regardless of strand
    ];
    for (const probe of probes) {
      expect(index.find(probe)).toBe(scan(probe, operons));
    }
  });

  it('matches the linear scan on a randomised genome', () => {
    let seed = 7;
    const rand = n => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const genes = [];
    for (let i = 0; i < 600; i++) {
      const start = rand(200000);
      genes.push(gene(start, start + 100 + rand(2000), rand(2) ? 1 : -1, rand(4) ? `g${rand(300)}` : ''));
    }
    const operons = [];
    for (let i = 0; i < 120; i++) {
      const members = Array.from({ length: 1 + rand(4) }, () => genes[rand(genes.length)]);
      const start = Math.min(...members.map(g => g.start)) - rand(500);
      const end = Math.max(...members.map(g => g.end)) + rand(500);
      operons.push({ name: `op${i}`, start, end, strand: members[0].strand, genes: members });
    }
    const index = new OperonLookupIndex(operons, nameOf);
    const probes = [...genes, ...genes.map(g => ({ ...g }))]; // originals + position/name-only copies
    for (const probe of probes) {
      expect(index.find(probe)).toBe(scan(probe, operons));
    }
  });
});
