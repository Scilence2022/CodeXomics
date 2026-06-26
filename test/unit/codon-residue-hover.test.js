/**
 * Codon <-> residue hover association.
 *
 * Validates the data contract that powers the hover highlight in the DOM
 * sequence view:
 *   - createAlignedProteinRows() tags each residue marker with the three
 *     display positions of its codon (correct for both strands), and
 *   - the selectors the hover handler uses (in initializeSequenceSelection)
 *     round-trip against that markup: base -> residue and residue -> codon.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SequenceUtils = require(path.join(process.cwd(), 'src/renderer/modules/SequenceUtils.js'));

function buildSequence() {
  const seq = Array(45).fill('A');
  // Forward CDS at source 10..18 (1-based) -> display 9..17 -> "ATGAAACCC" -> M K P
  'ATGAAACCC'.split('').forEach((c, k) => (seq[9 + k] = c));
  // Reverse CDS at source 30..38 (1-based) -> display 29..37 -> "TTTGGGCCC"
  // revcomp("TTTGGGCCC") = "GGGCCCAAA" -> G P K (protein order)
  'TTTGGGCCC'.split('').forEach((c, k) => (seq[29 + k] = c));
  return seq.join('');
}

function makeUtils() {
  const fullSequence = buildSequence();
  const genomeBrowser = {
    currentChromosome: 'chr1',
    currentSequence: { chr1: fullSequence },
    navigationManager: { circularMode: false },
    trackRenderer: { getTrackSettings: () => ({}) },
    shouldShowGeneType: () => true,
    getGeneOperonInfo: () => null,
    getQualifierValue: (qualifiers, key) => qualifiers?.[key] || '',
  };
  return new SequenceUtils(genomeBrowser);
}

const FWD = { type: 'CDS', start: 10, end: 18, strand: 1, qualifiers: { gene: 'fwdGene' } };
const REV = { type: 'CDS', start: 30, end: 38, strand: -1, qualifiers: { gene: 'revGene' } };

function markersOf(row) {
  return Array.from(row.querySelectorAll('.sequence-aligned-marker')).map(m => ({
    text: m.textContent,
    codon: m.dataset.codonPositions,
    aa: m.dataset.aa,
  }));
}

describe('codon <-> residue hover association', () => {
  let utils;
  beforeEach(() => {
    utils = makeUtils();
  });

  it('tags forward-strand residues with their codon display positions', () => {
    const rows = utils.createAlignedProteinRows(45, 0, 'chr1', [FWD], 10, [FWD], null);
    expect(rows).toHaveLength(1);
    expect(markersOf(rows[0])).toEqual([
      { text: 'M', codon: '9 10 11', aa: 'M' },
      { text: 'K', codon: '12 13 14', aa: 'K' },
      { text: 'P', codon: '15 16 17', aa: 'P' },
    ]);
  });

  it('tags reverse-strand residues with their codon display positions', () => {
    const rows = utils.createAlignedProteinRows(45, 0, 'chr1', [REV], 10, [REV], null);
    expect(rows).toHaveLength(1);
    // Reverse protein is G P K; residues are anchored at the codon's middle base,
    // laid out left-to-right by genomic position (so aaIndex descends).
    expect(markersOf(rows[0])).toEqual([
      { text: 'K', codon: '29 30 31', aa: 'K' },
      { text: 'P', codon: '32 33 34', aa: 'P' },
      { text: 'G', codon: '35 36 37', aa: 'G' },
    ]);
  });

  it('real base spans carry data-display-position for the contract', () => {
    const html = utils.colorizeSequenceWithFeaturesOptimized('ATGAAACCC', 9, new Map(), null, 'chr1');
    expect(html).toContain('data-display-position="9"');
    expect(html).toContain('data-display-position="17"');
  });

  describe('hover round-trip against real markup', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      container.id = 'sequenceContent';

      // DNA bases (main + complementary strands share data-display-position)
      for (const cls of ['sequence-bases', 'sequence-bases complement-bases']) {
        const basesDiv = document.createElement('div');
        basesDiv.className = cls;
        for (let d = 0; d < 45; d++) {
          const span = document.createElement('span');
          span.className = 'base-a';
          span.dataset.displayPosition = String(d);
          span.dataset.position = String(d);
          span.textContent = 'A';
          basesDiv.appendChild(span);
        }
        container.appendChild(basesDiv);
      }

      // Real protein rows
      utils.createAlignedProteinRows(45, 0, 'chr1', [FWD, REV], 10, [FWD, REV], null).forEach(row => {
        row.classList.add('sequence-protein-row'); // matches what createAlignedProteinRows sets
        container.appendChild(row);
      });
      document.body.appendChild(container);
    });

    // Mirror the shipped handler's base -> residue lookup
    const markersForBase = (root, displayPos) =>
      root.querySelectorAll(`.sequence-aligned-marker[data-codon-positions~="${displayPos}"]`);

    it('base -> residue: hovering a codon base finds its residue', () => {
      expect(markersForBase(container, '10')[0].textContent).toBe('M'); // middle of M codon
      expect(markersForBase(container, '9')[0].textContent).toBe('M'); // first base of M codon
      expect(markersForBase(container, '11')[0].textContent).toBe('M'); // last base of M codon
      expect(markersForBase(container, '12')[0].textContent).toBe('K'); // next codon
      expect(markersForBase(container, '30')[0].textContent).toBe('K'); // reverse strand
      expect(markersForBase(container, '37')[0].textContent).toBe('G'); // reverse strand
    });

    it('base -> residue: a non-coding base matches no residue', () => {
      expect(markersForBase(container, '20')).toHaveLength(0);
    });

    it('residue -> codon: hovering a residue finds its three codon bases on both strands', () => {
      const marker = markersForBase(container, '10')[0]; // the M residue
      const positions = marker.dataset.codonPositions.split(' ');
      expect(positions).toEqual(['9', '10', '11']);

      const found = [];
      positions.forEach(p => {
        container
          .querySelectorAll(`.sequence-bases span[data-display-position="${p}"]`)
          .forEach(span => found.push(span));
      });
      // 3 positions x 2 strands (main + complementary)
      expect(found).toHaveLength(6);
      expect(new Set(found.map(s => s.dataset.displayPosition))).toEqual(new Set(['9', '10', '11']));
    });

    it('applying/clearing draws one overlay box per strand row, not per base', () => {
      const marker = markersForBase(container, '10')[0];
      const codon = marker.dataset.codonPositions.split(' '); // ['9','10','11']

      // apply (mirrors applyCodonHover: group the codon's bases by their row and
      // draw a single overlay per row — one for the main strand, one for complement)
      const spansByRow = new Map();
      codon.forEach(p => {
        container.querySelectorAll(`.sequence-bases span[data-display-position="${p}"]`).forEach(span => {
          const row = span.parentElement;
          if (!spansByRow.has(row)) spansByRow.set(row, []);
          spansByRow.get(row).push(span);
        });
      });
      spansByRow.forEach((spans, row) => {
        const overlay = document.createElement('div');
        overlay.className = 'codon-hover-overlay';
        row.appendChild(overlay);
      });
      marker.classList.add('codon-hover-residue');

      // One box per codon per strand: 2 overlays (main + complementary), NOT 3 (per base) or 6
      expect(spansByRow.size).toBe(2);
      expect(container.querySelectorAll('.codon-hover-overlay')).toHaveLength(2);
      expect(container.querySelectorAll('.codon-hover-residue')).toHaveLength(1);

      // clear (mirrors clearCodonHover)
      container.querySelectorAll('.codon-hover-overlay').forEach(el => el.remove());
      container.querySelectorAll('.codon-hover-residue').forEach(el => el.classList.remove('codon-hover-residue'));
      expect(container.querySelectorAll('.codon-hover-overlay')).toHaveLength(0);
      expect(container.querySelectorAll('.codon-hover-residue')).toHaveLength(0);
    });
  });
});
