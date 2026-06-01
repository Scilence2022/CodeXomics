import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SequenceUtils = require(path.join(process.cwd(), 'src/renderer/modules/SequenceUtils.js'));

describe('SequenceUtils circular bottom sequence track', () => {
  let utils;
  let logSpy;

  function createGenomeBrowser() {
    return {
      currentChromosome: 'chr1',
      currentSequence: {
        chr1: `${'A'.repeat(95)}TTTTT`,
      },
      currentPosition: { start: 95, end: 105 },
      currentAnnotations: {
        chr1: [
          { type: 'gene', start: 97, end: 99, strand: 1, qualifiers: { gene: 'tail' } },
          { type: 'CDS', start: 3, end: 5, strand: 1, qualifiers: { gene: 'head' } },
        ],
      },
      navigationManager: { circularMode: false },
      trackRenderer: {
        getTrackSettings: name => (name === 'genes' ? { circularMode: true } : {}),
      },
      shouldShowGeneType: () => true,
      getGeneOperonInfo: () => null,
      getQualifierValue: (qualifiers, key) => qualifiers?.[key] || '',
    };
  }

  beforeEach(() => {
    document.body.innerHTML = '<div id="sequenceContent"></div>';
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    utils = new SequenceUtils(createGenomeBrowser());
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('extracts and labels sequence that crosses the circular junction', () => {
    const sequence = utils.genomeBrowser.currentSequence.chr1;

    expect(utils.getViewportSequence(sequence, 95, 105, 'chr1')).toBe('TTTTTAAAAA');
    expect(utils.formatSequenceRange('chr1', 95, 105)).toBe('chr1:96-100 / 1-5 (10 bp)');
    expect(utils.getLineDisplayLabel(100, 'chr1')).toBe('1');
  });

  it('renders wrapped bases with source positions for clicks and selection restore', () => {
    const annotations = utils.genomeBrowser.currentAnnotations.chr1;
    const subsequence = utils.getViewportSequence(utils.genomeBrowser.currentSequence.chr1, 95, 105, 'chr1');
    const featureLookup = utils.buildFeatureLookup(annotations, 95, 105, 'chr1');
    const lineElement = utils.renderSequenceLine(subsequence, 95, 'chr1', annotations, [], 10, {}, featureLookup);

    document.getElementById('sequenceContent').appendChild(lineElement);

    const positionLabel = lineElement.querySelector('.sequence-position');
    const bases = Array.from(lineElement.querySelectorAll('.sequence-bases span[data-position]'));

    expect(positionLabel.textContent).toBe('96');
    expect(bases.map(base => base.textContent).join('')).toBe('TTTTTAAAAA');
    expect(bases.map(base => Number(base.dataset.position))).toEqual([95, 96, 97, 98, 99, 0, 1, 2, 3, 4]);
    expect(utils.getSequencePosition(bases[5])).toBe(0);

    const headFeatureBase = bases.find(base => base.dataset.position === '2');
    expect(headFeatureBase.getAttribute('title')).toContain('head (3-5)');

    const restored = utils.findNodeAtGenomicPosition(2, document.getElementById('sequenceContent'));
    expect(restored.node.textContent).toBe('A');
    expect(restored.offset).toBe(0);
  });

  it('highlights source-coordinate search matches after the origin', () => {
    const featureLookup = new Map();
    const lineElement = utils.renderSequenceLine('TTTTTAAAAA', 95, 'chr1', [], [], 10, {}, featureLookup);
    const basesDiv = lineElement.querySelector('.sequence-bases');

    utils.searchHighlights = [{ start: 1, end: 3 }];
    utils.applySearchHighlightToLine(basesDiv, 95, 10);

    const highlightedBases = Array.from(basesDiv.querySelectorAll('span[data-position]')).filter(base =>
      base.innerHTML.includes(utils.highlightColor)
    );

    expect(highlightedBases.map(base => Number(base.dataset.position))).toEqual([1, 2, 3]);
    const highlightedText = highlightedBases[1].querySelector('span').firstChild;
    expect(utils.extractGenomicPositionFromNode(highlightedText, 0)).toBe(2);
  });

  it('indexes CDS rows and reuses protein translations across rendered lines', () => {
    const cds = { type: 'CDS', start: 1, end: 9, strand: 1, qualifiers: { gene: 'cached' } };
    utils.genomeBrowser.currentSequence.chr1 = 'ATGAAATGG';
    utils.genomeBrowser.navigationManager.circularMode = false;
    utils.genomeBrowser.trackRenderer.getTrackSettings = name => (name === 'genes' ? { circularMode: false } : {});
    utils.translateDNA = vi.fn(() => 'MKW');

    const index = utils.buildLineFeatureIndex([cds], 0, 9, 3, 'chr1', { showProteinSequence: true });

    expect(index).toHaveLength(3);
    expect(index.every(line => line.cds[0] === cds)).toBe(true);

    utils.createAlignedProteinRows(3, 0, 'chr1', [cds], 10, index[0].cds, utils.createRenderContext('chr1'));
    utils.createAlignedProteinRows(3, 3, 'chr1', [cds], 10, index[1].cds, utils.createRenderContext('chr1'));

    expect(utils.translateDNA).toHaveBeenCalledTimes(1);
  });

  it('keeps aligned protein rows in the same base column as the DNA strand', () => {
    const cds = { type: 'CDS', start: 1, end: 9, strand: 1, qualifiers: { gene: 'aligned' } };
    utils.genomeBrowser.currentSequence.chr1 = 'ATGAAATGG';
    utils.genomeBrowser.currentAnnotations.chr1 = [cds];
    utils.genomeBrowser.navigationManager.circularMode = false;
    utils.genomeBrowser.trackRenderer.getTrackSettings = name => (name === 'genes' ? { circularMode: false } : {});

    const lineElement = utils.renderSequenceLine(
      'ATGAAATGG',
      0,
      'chr1',
      [cds],
      [],
      10,
      { showProteinSequence: true },
      new Map()
    );

    const strandLabel = lineElement.querySelector('.main-strand-row > span');
    const spacer = lineElement.querySelector('.sequence-protein-row .sequence-aligned-strand-spacer');
    const proteinBases = lineElement.querySelector('.sequence-protein-row .sequence-aligned-bases');
    const firstMarker = proteinBases.querySelector('.sequence-aligned-marker');

    expect(strandLabel.style.width).toBe('20px');
    expect(spacer.style.width).toBe('20px');
    expect(proteinBases.style.width).toBe('90px');
    expect(firstMarker.textContent).toBe('M');
    expect(firstMarker.style.left).toBe('10px');
  });

  it('aligns gene indicator start and end to base edges', () => {
    const gene = { type: 'CDS', start: 2, end: 4, strand: 1, qualifiers: { gene: 'edge' } };
    utils.genomeBrowser.currentSequence.chr1 = 'AAAAAA';
    utils.genomeBrowser.currentAnnotations.chr1 = [gene];
    utils.genomeBrowser.navigationManager.circularMode = false;
    utils.genomeBrowser.trackRenderer.getTrackSettings = name => (name === 'genes' ? { circularMode: false } : {});

    const lineElement = utils.renderSequenceLine('AAAAAA', 0, 'chr1', [gene], [], 10, {}, new Map());

    const indicatorLine = lineElement.querySelector('.gene-indicator-line');
    const indicatorSvg = indicatorLine.querySelector('.gene-indicator-svg');

    expect(indicatorLine.style.marginLeft).toBe('135px');
    expect(indicatorSvg.innerHTML).toContain('x="10"');
    expect(indicatorSvg.innerHTML).toContain('width="30"');
    expect(indicatorSvg.innerHTML).toContain('x1="10"');
    expect(indicatorSvg.innerHTML).toContain('M 28 ');
  });

  it('renders primer manager bindings above and below the DNA rows by strand', () => {
    utils.genomeBrowser.currentSequence.chr1 = 'ATGAAATGGCCCAAA';
    utils.genomeBrowser.currentAnnotations.chr1 = [];
    utils.genomeBrowser.primerManager = {
      getRenderableBindingSites: () => [
        {
          type: 'primer_binding',
          name: 'F-primer',
          sequence: 'ATGAAA',
          primerSequence: 'ATGAAA',
          chromosome: 'chr1',
          start: 1,
          end: 6,
          strand: '+',
          mismatches: [],
        },
        {
          type: 'primer_binding',
          name: 'R-primer',
          sequence: 'TTTGGG',
          primerSequence: 'TTTGGG',
          chromosome: 'chr1',
          start: 10,
          end: 15,
          strand: '-',
          mismatches: [{ primerIndex: 2 }],
        },
      ],
    };

    const lineElement = utils.renderSequenceLine(
      'ATGAAATGGCCCAAA',
      0,
      'chr1',
      [],
      [],
      10,
      { showPrimers: true },
      new Map(),
      {
        indicators: [],
        cds: [],
        primers: utils.genomeBrowser.primerManager.getRenderableBindingSites(),
      }
    );

    const rows = Array.from(lineElement.children);
    const forwardRow = lineElement.querySelector('.sequence-primer-row.forward');
    const reverseRow = lineElement.querySelector('.sequence-primer-row.reverse');

    expect(rows.indexOf(forwardRow)).toBeLessThan(rows.indexOf(lineElement.querySelector('.sequence-line')));
    expect(rows.indexOf(reverseRow)).toBeGreaterThan(rows.indexOf(lineElement.querySelector('.sequence-line')));
    expect(forwardRow.querySelector('.sequence-primer-binding-segment').textContent).toContain('ATGAAA>');
    expect(reverseRow.querySelector('.sequence-primer-binding-segment').textContent).toContain('GGGTTT<');
    expect(reverseRow.querySelectorAll('.sequence-primer-binding-base.mismatch')).toHaveLength(1);
  });
});
