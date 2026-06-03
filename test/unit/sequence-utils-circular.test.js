import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SequenceUtils = require(path.join(process.cwd(), 'src/renderer/modules/SequenceUtils.js'));
const NavigationManager = require(path.join(process.cwd(), 'src/renderer/modules/NavigationManager.js'));

describe('SequenceUtils circular bottom sequence track', () => {
  let utils;
  let logSpy;
  let clipboardWriteTextSpy;

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
      sequenceSelection: null,
      currentSequenceSelection: null,
      navigationManager: { circularMode: false },
      trackRenderer: {
        getTrackSettings: name => (name === 'genes' ? { circularMode: true } : {}),
      },
      uiManager: { updateStatus: vi.fn() },
      shouldShowGeneType: () => true,
      getGeneOperonInfo: () => null,
      getQualifierValue: (qualifiers, key) => qualifiers?.[key] || '',
    };
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <select id="chromosomeSelect"><option value="chr1" selected>chr1</option></select>
      <div id="sequenceContent"></div>
    `;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    clipboardWriteTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteTextSpy },
    });
    window.getSelection = vi.fn(() => ({ toString: () => '' }));
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
    expect(indicatorLine.style.height).toBe('16px');
    expect(indicatorSvg.getAttribute('style')).toContain('height: 16px');
    expect(indicatorSvg.innerHTML).toContain('x="10"');
    expect(indicatorSvg.innerHTML).toContain('width="30"');
    expect(indicatorSvg.innerHTML).toContain('x1="10"');
    expect(indicatorSvg.innerHTML).toContain('M 28 ');
  });

  it('opens gene details when a bottom sequence indicator is clicked', () => {
    const gene = { type: 'CDS', start: 2, end: 4, strand: 1, qualifiers: { gene: 'clickable' } };
    const showGeneDetails = vi.fn();
    utils.genomeBrowser.currentSequence.chr1 = 'AAAAAA';
    utils.genomeBrowser.currentAnnotations.chr1 = [gene];
    utils.genomeBrowser.navigationManager.circularMode = false;
    utils.genomeBrowser.trackRenderer = {
      getTrackSettings: name => (name === 'genes' ? { circularMode: false } : {}),
      showGeneDetails,
    };

    const container = document.getElementById('sequenceContent');
    const lineElement = utils.renderSequenceLine('AAAAAA', 0, 'chr1', [gene], [], 10, {}, new Map());
    container.appendChild(lineElement);
    utils.attachSequenceClickHandlers(container);

    lineElement.querySelector('.gene-indicator-click-target').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(showGeneDetails).toHaveBeenCalledTimes(1);
    expect(showGeneDetails).toHaveBeenCalledWith(gene, null, { scrollBottomSequence: false });
  });

  it('scrolls the virtualized bottom sequence view when auto-scrolling to a selected gene', () => {
    document.body.innerHTML = `
      <div id="sequenceContent">
        <div class="detailed-sequence-view virtualized" data-bases-per-line="50" data-line-height="32">
          <div class="sequence-line-group">
            <div class="sequence-line">
              <div class="sequence-bases">ACG</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const virtualSequenceView = document.querySelector('.detailed-sequence-view.virtualized');
    const renderedBufferLine = document.querySelector('.sequence-line-group');
    const outerSequenceContent = document.getElementById('sequenceContent');
    renderedBufferLine.getBoundingClientRect = vi.fn(() => ({ height: 96 }));
    virtualSequenceView.scrollTo = vi.fn();
    outerSequenceContent.scrollTo = vi.fn();

    const navigationManager = Object.create(NavigationManager.prototype);
    navigationManager.genomeBrowser = {
      currentPosition: { start: 1000, end: 6000 },
    };

    navigationManager.scrollToMatchPosition({
      position: 3500,
      end: 3600,
      type: 'gene',
    });

    expect(virtualSequenceView.scrollTo).toHaveBeenCalledWith({
      top: 1600,
      behavior: 'smooth',
    });
    expect(outerSequenceContent.scrollTo).not.toHaveBeenCalled();
  });

  it('copies the reverse-complement gene sequence when Shift is pressed', async () => {
    utils.genomeBrowser.currentSequence.chr1 = 'AACCGGTT';
    utils.genomeBrowser.sequenceSelection = {
      active: true,
      source: 'gene',
      start: 2,
      end: 5,
      chromosome: 'chr1',
      geneName: 'shiftGene',
    };

    await utils.copySequence({ shiftKey: true });

    expect(clipboardWriteTextSpy).toHaveBeenCalledWith('CGGT');
    expect(utils.genomeBrowser.uiManager.updateStatus).toHaveBeenCalledWith(
      'Copied reverse-complement shiftGene sequence (4 bp) to clipboard',
      expect.objectContaining({ color: '#10b981' })
    );
  });

  it('includes copy mode in the visible-sequence prompt and copies forward sequence by default', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    utils.genomeBrowser.currentSequence.chr1 = 'AACCGGTT';
    utils.genomeBrowser.currentPosition = { start: 1, end: 5 };

    await utils.copySequence();

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Forward copy mode is active.'));
    expect(clipboardWriteTextSpy).toHaveBeenCalledWith('ACCG');
    expect(utils.genomeBrowser.uiManager.updateStatus).toHaveBeenCalledWith(
      'Copied forward visible sequence (4 bases) to clipboard',
      expect.objectContaining({ color: '#10b981' })
    );

    confirmSpy.mockRestore();
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
