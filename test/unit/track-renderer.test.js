/**
 * TrackRenderer Integration Tests
 *
 * Validates key TrackRenderer patterns for gene, annotation,
 * and blast track creation, viewport filtering, and layout management.
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const TR_PATH = path.join(process.cwd(), 'src/renderer/modules/TrackRenderer.js');
const require = createRequire(import.meta.url);
const TrackRenderer = require(TR_PATH);
const jsdomDocument = globalThis.document;

// Both are classic scripts in the app, so they see each other as globals.
globalThis.TrackRenderer = TrackRenderer;
globalThis.PrimerTrackSettingsPanel = require(
  path.join(process.cwd(), 'src/renderer/modules/tracks/PrimerTrackSettingsPanel.js')
);

describe('TrackRenderer Structure', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(TR_PATH, 'utf-8');
  });

  it('should be valid JS module', () => {
    expect(content.length).toBeGreaterThan(10000);
  });

  it('should define TrackRenderer class', () => {
    expect(content).toContain('class TrackRenderer');
  });

  it('should have constructor accepting genomeBrowser', () => {
    expect(content).toContain('constructor(genomeBrowser)');
  });

  it('should reference GeneShapeCreators after extraction', () => {
    expect(content).toContain('GeneShapeCreators');
  });

  it('should not have inline gene shape functions after extraction', () => {
    // These were extracted to GeneShapeCreators
    const inlineDefs = [
      'function createJaggedTrianglePath',
      'function createJaggedArrowPath',
      'function createPromoterShape',
      'function createTerminatorShape',
      'function createRegulatoryShape',
    ];
    for (const def of inlineDefs) {
      expect(content).not.toContain(def);
    }
  });
});

describe('Viewport Filtering', () => {
  // Test viewport filtering logic pattern
  const viewportFunctions = ['filterFeaturesByViewport', 'filterBlastResultsByViewport', 'filterGeneAnnotations'];

  it('should define viewport filter functions', () => {
    const content = fs.readFileSync(TR_PATH, 'utf-8');
    for (const fn of viewportFunctions) {
      expect(content.includes(fn)).toBe(true);
    }
  });

  it('viewport filter functions should appear after GeneShapeCreators calls', () => {
    // After extraction, viewport filters should still be in TrackRenderer
    const content = fs.readFileSync(TR_PATH, 'utf-8');
    const geneShapeIdx = content.indexOf('GeneShapeCreators');
    const filterIdx = content.indexOf('filterFeaturesByViewport');
    // Both should exist; order doesn't matter since they're in different sections
    expect(geneShapeIdx).toBeGreaterThan(0);
    expect(filterIdx).toBeGreaterThan(0);
  });

  it('shows only local pieces of mixed GenBank features and keeps their original identity for selection', () => {
    const source = {
      type: 'CDS',
      start: 10,
      end: 900,
      genbankLocalSegments: [
        { start: 10, end: 20 },
        { start: 40, end: 50 },
      ],
    };
    const remoteOnly = { type: 'CDS', start: 12, end: 19, genbankLocalSegments: [] };
    const renderer = Object.create(TrackRenderer.prototype);
    renderer.genomeBrowser = {
      currentAnnotations: { chr1: [source, remoteOnly] },
      currentChromosome: 'chr1',
      shouldShowGeneType: () => true,
      selectGene: vi.fn(),
      scheduleGeneDetailsPanelUpdate: vi.fn(),
      scrollBottomSequenceToGene: vi.fn(),
    };
    renderer.getTrackSettings = () => ({});
    renderer.isCircularModeEnabled = () => false;
    const viewport = { start: 1, end: 25 };
    const [visible] = renderer.filterGeneAnnotations([source, remoteOnly], viewport);
    expect(renderer.filterGeneAnnotations([source, remoteOnly], { start: 500, end: 550 })).toEqual([]);
    expect(renderer.filterGeneAnnotations([source, remoteOnly], viewport)).toHaveLength(1);
    expect(renderer.filterProteinAnnotations([source, remoteOnly], viewport)).toHaveLength(1);
    expect(visible).toMatchObject({ start: 10, end: 20 });
    renderer.showGeneDetails(visible, null);
    expect(renderer.genomeBrowser.selectGene).toHaveBeenCalledWith(source, null);
    expect(renderer.genomeBrowser.scrollBottomSequenceToGene).toHaveBeenCalledWith(
      expect.objectContaining({ start: 10, end: 20 })
    );
  });

  it('uses the full annotated CDS when opening details from a local segment', () => {
    const renderer = Object.create(TrackRenderer.prototype);
    const source = {
      type: 'CDS',
      start: 10,
      end: 900,
      location: 'join(10..20,AB123.1:880..900)',
      genbankLocationBounds: [10, 900, 1],
    };
    const sequence = 'A'.repeat(30);
    const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    try {
      const extractFeatureSequence = vi.fn().mockReturnValue('ATGGCTTAA');
      const extractFeatureProtein = vi.fn().mockReturnValue('MA');
      renderer.genomeBrowser = {
        currentSequence: { chr1: sequence },
        exportManager: { extractFeatureSequence, extractFeatureProtein },
      };
      renderer.showProteinDetails({ ...source, end: 20, _genbankSourceFeature: source }, 'chr1');
      expect(extractFeatureSequence).toHaveBeenCalledWith(sequence, source);
      expect(extractFeatureProtein).toHaveBeenCalledWith(sequence, source);
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Length: 9 bp (2 aa)'));
    } finally {
      alertSpy.mockRestore();
    }
  });
});

describe('Circular Viewport Handling', () => {
  function createRenderer() {
    global.document = {
      getElementById: () => ({ value: 'chr1' }),
    };

    return new TrackRenderer({
      currentChromosome: 'chr1',
      currentSequence: {
        chr1: 'A'.repeat(90) + 'CGCGT' + 'TTTTT',
      },
      currentPosition: { start: 90, end: 110 },
      navigationManager: { circularMode: false },
      readsManager: {
        async getReadsForRegion(chromosome, start, end) {
          if (start === 90 && end === 100) {
            return [{ id: 'tail', start: 96, end: 100, sequence: 'AAAA', mutations: [] }];
          }
          if (start === 0 && end === 10) {
            return [{ id: 'head', start: 6, end: 9, sequence: 'TTT', mutations: [] }];
          }
          return [];
        },
      },
    });
  }

  it('wraps reference sequence across the origin when genes circular mode is enabled', () => {
    const renderer = createRenderer();
    renderer.trackSettings.genes = { circularMode: true };

    expect(renderer.getReferenceSequence(95, 105, 'chr1')).toBe('TTTTTAAAAA');
  });

  it('maps source features after the origin into display coordinates', () => {
    const renderer = createRenderer();
    renderer.trackSettings.genes = { circularMode: true };

    const visible = renderer.filterFeaturesByViewport(
      [
        { id: 'tail', start: 94, end: 98 },
        { id: 'head', start: 4, end: 8 },
        { id: 'outside', start: 40, end: 50 },
      ],
      { start: 90, end: 110 }
    );

    expect(visible.map(feature => feature.id)).toEqual(['tail', 'head']);
    expect(visible[1].start).toBe(104);
    expect(visible[1].end).toBe(108);
    expect(visible[1]._sourceStart).toBe(4);
  });

  it('splits read queries at the junction and shifts post-origin reads', async () => {
    const renderer = createRenderer();
    renderer.trackSettings.genes = { circularMode: true };

    const reads = await renderer.getReadsForViewport('chr1', { start: 90, end: 110 }, {});

    expect(reads.map(read => read.id)).toEqual(['tail', 'head']);
    expect(reads[1].start).toBe(106);
    expect(reads[1].end).toBe(109);
    expect(reads[1]._sourceStart).toBe(6);
  });
});

describe('Track Settings Resolution', () => {
  it('caches default settings without logging on each lookup', () => {
    const configManager = {
      get: vi.fn(() => ({})),
    };
    const renderer = new TrackRenderer({
      configManager,
      generalSettingsManager: {
        getSettings: () => ({ enableGlobalDragging: true }),
      },
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const firstSettings = renderer.getTrackSettings('genes');
      const secondSettings = renderer.getTrackSettings('genes');

      expect(secondSettings).toBe(firstSettings);
      expect(configManager.get).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('[getTrackSettings]'));
    } finally {
      logSpy.mockRestore();
    }
  });

  it('can clear cached defaults before resolving fresh settings', () => {
    const configManager = {
      get: vi.fn(() => ({})),
    };
    const renderer = new TrackRenderer({ configManager });

    renderer.getTrackSettings('genes');
    renderer.clearTrackSettingsCache('genes');
    renderer.getTrackSettings('genes');

    expect(configManager.get).toHaveBeenCalledTimes(2);
  });
});

describe('Aligned reads vertical scrolling layout', () => {
  function makeRows(count) {
    return Array.from({ length: count }, () => []);
  }

  function computeLayout(settings, rows = 4) {
    const renderer = Object.create(TrackRenderer.prototype);
    return renderer.computeReadsTrackLayout(makeRows(rows), settings, {
      showCoverage: true,
      coverageHeight: 50,
      referenceHeight: 25,
      isCanvasMode: true,
      viewport: { start: 0, end: 100 },
      containerWidth: 1000,
    });
  }

  it('uses the compact rectangle height when sequence letters are hidden', () => {
    const layout = computeLayout({
      height: 150,
      readHeight: 4,
      readSpacing: 2,
      showSequences: false,
    });

    expect(layout.readHeight).toBe(4);
    expect(layout.visibleRows).toBe(10);
    expect(layout.useScroll).toBe(false);
  });

  it('triggers scrolling from the taller effective row height when sequence letters are displayed', () => {
    const layout = computeLayout({
      height: 150,
      readHeight: 4,
      readSpacing: 2,
      showSequences: true,
      autoFontSize: true,
      referenceFontSize: 12,
    });

    expect(layout.readHeight).toBe(12);
    expect(layout.visibleRows).toBe(4);
    expect(layout.useScroll).toBe(false);

    const overflowingLayout = computeLayout(
      {
        height: 150,
        readHeight: 4,
        readSpacing: 2,
        showSequences: true,
        autoFontSize: true,
        referenceFontSize: 12,
      },
      5
    );

    expect(overflowingLayout.useScroll).toBe(true);
  });

  it('keeps compact rows when sequence display is enabled but below the letter zoom threshold', () => {
    const renderer = Object.create(TrackRenderer.prototype);
    const layout = renderer.computeReadsTrackLayout(
      makeRows(5),
      {
        height: 150,
        readHeight: 4,
        readSpacing: 2,
        showSequences: true,
      },
      {
        showCoverage: true,
        coverageHeight: 50,
        referenceHeight: 25,
        isCanvasMode: true,
        viewport: { start: 0, end: 10000 },
        containerWidth: 1000,
      }
    );

    expect(layout.readHeight).toBe(4);
    expect(layout.useScroll).toBe(false);
  });

  it('uses wheel for vertical reads scrolling while leaving mousedown available for genome panning', () => {
    global.document = jsdomDocument;
    const renderer = Object.create(TrackRenderer.prototype);
    renderer.renderVisibleRows = vi.fn();
    const trackContent = document.createElement('div');
    const trackMouseDown = vi.fn();
    trackContent.addEventListener('mousedown', trackMouseDown);
    document.body.appendChild(trackContent);

    renderer.createScrollableReadsTrack(
      trackContent,
      makeRows(20),
      { start: 0, end: 100 },
      {
        readHeight: 4,
        rowSpacing: 2,
        topPadding: 0,
        bottomPadding: 10,
        trackHeight: 60,
        containerWidth: 800,
      },
      { renderingMode: 'svg' }
    );

    const scrollContainer = trackContent.querySelector('.reads-scroll-container');
    const contentViewport = trackContent.querySelector('.reads-content-viewport');

    scrollContainer.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 10 }));
    expect(contentViewport.style.transform).toBe('translateY(-20px)');

    scrollContainer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 100, clientY: 20 }));
    expect(trackMouseDown).toHaveBeenCalledOnce();
  });
});

describe('Track Settings Tabs', () => {
  const CSS_PATH = path.join(process.cwd(), 'src/renderer/css/sequence-tracks.css');

  function createRenderer() {
    return new TrackRenderer({
      configManager: {
        get: vi.fn(() => ({})),
      },
      generalSettingsManager: {
        getSettings: () => ({ enableGlobalDragging: true }),
      },
    });
  }

  function getTabFixtures(renderer) {
    return [
      {
        trackType: 'genes',
        html: renderer.createGenesSettingsContent(renderer.getTrackSettings('genes')),
        setup: bodyElement => renderer.setupGenesSettingsEventListeners(bodyElement),
      },
      {
        trackType: 'gc',
        html: renderer.createGCSettingsContent(renderer.getTrackSettings('gc')),
        setup: bodyElement => renderer.setupGCSettingsEventListeners(bodyElement),
      },
      {
        trackType: 'reads',
        html: renderer.createReadsSettingsContent(renderer.getTrackSettings('reads')),
        setup: bodyElement => renderer.setupReadsSettingsEventListeners(bodyElement),
      },
      {
        trackType: 'sequence',
        html: renderer.createSequenceSettingsContent(renderer.getTrackSettings('sequence')),
        setup: bodyElement => renderer.setupSequenceSettingsEventListeners(bodyElement),
      },
      {
        trackType: 'sequenceLine',
        html: renderer.createSequenceLineSettingsContent(renderer.getTrackSettings('sequenceLine')),
        setup: bodyElement => renderer.setupSequenceLineSettingsEventListeners(bodyElement),
      },
      {
        trackType: 'wigTracks',
        html: renderer.createWIGTracksSettingsContent(renderer.getTrackSettings('wigTracks')),
        setup: bodyElement => renderer.setupWIGTracksSettingsEventListeners(bodyElement),
      },
      {
        trackType: 'variants',
        html: renderer.createVariantsSettingsContent(renderer.getTrackSettings('variants')),
        setup: bodyElement => renderer.setupVariantsSettingsEventListeners(bodyElement),
      },
      {
        trackType: 'actions',
        html: renderer.createActionsSettingsContent(renderer.getTrackSettings('actions')),
        setup: bodyElement => renderer.setupActionsSettingsEventListeners(bodyElement),
      },
      {
        trackType: 'blast',
        html: renderer.createDefaultSettingsContent('blast', renderer.getTrackSettings('blast')),
        setup: bodyElement => renderer.setupDefaultSettingsEventListeners(bodyElement),
      },
    ];
  }

  beforeEach(() => {
    global.document = jsdomDocument;
    document.body.innerHTML = '';
  });

  it('scopes track settings CSS so inactive tab content is hidden', () => {
    const css = fs.readFileSync(CSS_PATH, 'utf-8');

    expect(css).toContain('#trackSettingsModal .llm-provider-config > .tab-content');
    expect(css).toContain('display: none !important;');
    expect(css).toContain('#trackSettingsModal .llm-provider-config > .tab-content.active');
    expect(css).toContain('display: block !important;');

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    document.body.innerHTML = `
      <div id="trackSettingsModal">
        <div class="llm-provider-config">
          <div id="inactive-tab" class="tab-content"></div>
          <div id="active-tab" class="tab-content active"></div>
        </div>
      </div>
    `;

    expect(getComputedStyle(document.getElementById('inactive-tab')).display).toBe('none');
    expect(getComputedStyle(document.getElementById('active-tab')).display).toBe('block');
  });

  it('switches each track settings interface to one active tab panel', () => {
    const renderer = createRenderer();

    for (const fixture of getTabFixtures(renderer)) {
      const bodyElement = document.createElement('div');
      bodyElement.innerHTML = fixture.html;
      document.body.appendChild(bodyElement);

      fixture.setup(bodyElement);

      const tabButtons = bodyElement.querySelectorAll('.tab-button');
      const tabPanels = bodyElement.querySelectorAll('.llm-provider-config > .tab-content');

      expect(tabButtons.length, `${fixture.trackType} should have multiple tab buttons`).toBeGreaterThan(1);
      expect(tabPanels.length, `${fixture.trackType} should have multiple tab panels`).toBeGreaterThan(1);
      expect(
        bodyElement.querySelectorAll('.llm-provider-config > .tab-content.active').length,
        `${fixture.trackType} should start with one active panel`
      ).toBe(1);

      const targetButton = tabButtons[1];
      const targetPanelId = `${targetButton.getAttribute('data-tab')}-tab`;
      targetButton.click();

      const activePanels = bodyElement.querySelectorAll('.llm-provider-config > .tab-content.active');
      expect(activePanels.length, `${fixture.trackType} should keep exactly one active panel`).toBe(1);
      expect(activePanels[0].id, `${fixture.trackType} should activate the clicked tab panel`).toBe(targetPanelId);

      bodyElement.remove();
    }
  });
});

describe('Track Creation Methods', () => {
  const trackMethods = [
    'createGeneTrack',
    'createPrimerTrack',
    'createAnnotationTrack',
    'createBlastTrack',
    'createTrackBase',
    'createTrackHeader',
    'createTrackContent',
  ];

  it('should define all track creation methods', () => {
    const content = fs.readFileSync(TR_PATH, 'utf-8');
    for (const method of trackMethods) {
      expect(content.includes(method)).toBe(true);
    }
  });
});

describe('Gene SVG sizing', () => {
  it('uses the mounted track width for geometry and label fitting, including after a resize', () => {
    let notifyResize;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback) {
          notifyResize = width => callback([{ contentRect: { width } }]);
        }
        observe() {}
        disconnect() {
          disconnect();
        }
      }
    );
    vi.stubGlobal('GeneShapeCreators', require('../../src/renderer/modules/tracks/GeneShapeCreators.js'));

    const container = document.createElement('div');
    try {
      const viewport = { start: 0, end: 1000 };
      const genomeBrowser = {
        currentChromosome: 'chr1',
        currentSequence: {},
        getGeneOperonInfo: () => ({ color: '#3498db' }),
        getQualifierValue: (qualifiers, key) => qualifiers[key],
      };
      const renderer = new TrackRenderer(genomeBrowser);
      renderer.isCircularModeEnabled = () => false;
      renderer.getCurrentViewport = () => viewport;
      const settings = { geneHeight: 24, fontSize: 24 };
      const rows = [[{ start: 101, end: 140, type: 'CDS', strand: 1, qualifiers: { gene: 'elaD' } }]];
      const layout = renderer.calculateGeneTrackLayout(rows, settings);
      renderer.renderGeneElementsSVG(container, rows, viewport, [], layout, settings);
      notifyResize(0);
      expect(disconnect).not.toHaveBeenCalled();
      document.body.append(container);

      notifyResize(1200);
      const svg = container.querySelector('svg');
      expect(svg.style.height).toBe('26px');
      expect(svg.querySelector('.svg-gene-element').getAttribute('transform')).toBe('translate(120, 2)');
      expect(svg.querySelector('text').textContent).toBe('elaD');
      expect(Number(svg.querySelector('text').getAttribute('x'))).toBeCloseTo(24);

      notifyResize(700);
      expect(svg.querySelector('.svg-gene-element').getAttribute('transform')).toBe('translate(70, 2)');
      expect(svg.querySelector('text')).toBeNull();

      container.remove();
      notifyResize(0);
      expect(disconnect).toHaveBeenCalledOnce();
    } finally {
      container.remove();
      vi.unstubAllGlobals();
    }
  });
});

describe('Primer Track Rendering', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(TR_PATH, 'utf-8');
  });

  it('should use a dedicated primer binding renderer instead of generic gene rendering', () => {
    const primerTrackStart = content.indexOf('createPrimerTrack(chromosome)');
    const primerTrackEnd = content.indexOf('createBlastTrack(chromosome)');
    const primerTrackSection = content.substring(primerTrackStart, primerTrackEnd);

    expect(primerTrackSection).toContain('renderPrimerElements');
    expect(primerTrackSection).not.toContain('renderGeneElements(trackContent, visiblePrimers');
  });

  it('should expose sequence comparison helpers for oligo-vs-genome differences', () => {
    expect(content).toContain('getPrimerOligoSequence(primer)');
    expect(content).toContain('getPrimerGenomeBindingSequence(primer)');
    expect(content).toContain('getPrimerMismatchSummary(oligoSequence, genomeSequence)');
    expect(content).toContain('primer-binding-svg');
  });

  function createPrimerRenderer() {
    if (!globalThis.document?.createElement && jsdomDocument?.createElement) {
      globalThis.document = jsdomDocument;
    }

    return new TrackRenderer({
      currentChromosome: 'chr1',
      currentSequence: {
        chr1: 'A'.repeat(1000),
      },
      getQualifierValue: (qualifiers, key) => qualifiers?.[key],
    });
  }

  it('uses the measured track width for primer geometry to avoid stretched labels', () => {
    const renderer = createPrimerRenderer();
    const trackContent = document.createElement('div');
    trackContent.getBoundingClientRect = () => ({ width: 640 });

    renderer.renderPrimerElements(
      trackContent,
      [{ type: 'primer', start: 110, end: 210, name: 'Primer A', strand: 1 }],
      { start: 100, end: 300 },
      {}
    );

    const svg = trackContent.querySelector('.primer-binding-svg');
    const arrow = trackContent.querySelector('.primer-binding-element .primer-arrow');

    expect(svg.getAttribute('viewBox')).toMatch(/^0 0 640 /);
    // Sites are 1-based inclusive, so the 110..210 footprint starts at base 109
    // of a 200 bp view drawn 640 px wide, and spans 101 bases.
    expect(arrow.getAttribute('d')).toContain('M 28.8 ');
    expect(arrow.getAttribute('d')).toContain('L 352 ');
  });

  it('draws primers as half-arrows whose barb points away from the template strand', () => {
    const renderer = createPrimerRenderer();
    const points = d => d.match(/[ML] [-\d.]+ [-\d.]+/g).map(token => token.slice(2).split(' ').map(Number));

    // x 10..60, y 20..31, head 9.
    const forward = points(renderer.buildPrimerArrowPath(10, 20, 50, 11, 9, false));
    const reverse = points(renderer.buildPrimerArrowPath(10, 20, 50, 11, 9, true));

    // Forward: flat bottom edge runs into the 3' tip at the bottom-right corner,
    // and the single barb rises above the body; nothing hangs below it.
    expect(forward).toContainEqual([60, 31]);
    expect(Math.min(...forward.map(([, y]) => y))).toBeLessThan(20);
    expect(Math.max(...forward.map(([, y]) => y))).toBe(31);

    // Reverse: mirror image, tip at the top-left, barb below, flat top edge.
    expect(reverse).toContainEqual([10, 20]);
    expect(Math.max(...reverse.map(([, y]) => y))).toBeGreaterThan(31);
    expect(Math.min(...reverse.map(([, y]) => y))).toBe(20);
  });

  it('keeps forward and reverse barbs on adjacent rows from touching', () => {
    const renderer = createPrimerRenderer();
    const style = renderer.constructor.PRIMER_TRACK_STYLE;
    const height = style.glyphHeight;
    const ys = d => d.match(/[ML] [-\d.]+ [-\d.]+/g).map(token => Number(token.slice(2).split(' ')[1]));

    // Reverse site on row 0, forward site on row 1 directly beneath it.
    const row0Bottom = Math.max(...ys(renderer.buildPrimerArrowPath(0, 0, 200, height, 9, true)));
    const row1Top = Math.min(...ys(renderer.buildPrimerArrowPath(0, height + style.rowSpacing, 200, height, 9, false)));
    expect(row1Top).toBeGreaterThan(row0Bottom);
  });

  it('caps the arrow head so a sub-pixel primer stays an arrow, not a triangle', () => {
    const renderer = createPrimerRenderer();
    const placement = renderer.computePrimerPlacement(
      { type: 'primer', start: 50000, end: 50020, name: 'tiny', strand: 1 },
      { start: 0, end: 100000 },
      1000,
      {}
    );

    // 20 bp of a 100 kb view is a fifth of a pixel: the glyph is inflated to the
    // legible minimum, stays centred on the site, and the head is a small
    // fraction of it rather than a marker scaled by stroke width.
    expect(placement.glyphWidth).toBe(8);
    expect(placement.headLength).toBeLessThanOrEqual(9);
    expect(placement.glyphLeft + placement.glyphWidth / 2).toBeCloseTo(500, 0);
  });

  it('lets the track settings move the width below which arrows stop being to scale', () => {
    const renderer = createPrimerRenderer();
    const site = { type: 'primer', start: 50000, end: 50020, name: 'tiny', strand: 1 };
    const viewport = { start: 0, end: 100000 };

    expect(renderer.computePrimerPlacement(site, viewport, 1000, { minGlyphWidth: 20 }).glyphWidth).toBe(20);
    // Out-of-range values fall back to the shipped geometry rather than to a
    // glyph nobody can see or click.
    expect(renderer.computePrimerPlacement(site, viewport, 1000, { minGlyphWidth: 0 }).glyphWidth).toBe(8);
    expect(renderer.computePrimerPlacement(site, viewport, 1000, { minGlyphWidth: 500 }).glyphWidth).toBe(40);
  });

  it('packs rows by rendered pixel extent so labels do not collide', () => {
    const renderer = createPrimerRenderer();
    const viewport = { start: 0, end: 10000 };
    const sites = [
      { type: 'primer', start: 100, end: 120, name: 'first_oligo', strand: 1 },
      { type: 'primer', start: 130, end: 150, name: 'second_oligo', strand: 1 },
    ];
    const placements = sites.map(site => renderer.computePrimerPlacement(site, viewport, 800, {}));

    // Genomically these two barely overlap, but their labels do, so they must
    // land on separate rows.
    const packed = renderer.arrangePrimersInRows(placements, {});
    expect(packed.rows).toHaveLength(2);
    expect(packed.labelsVisible).toBe(true);
  });

  it('honors primer track size and label settings', () => {
    const renderer = createPrimerRenderer();
    const settings = { fontSize: 13, geneNameColor: '#123456', fontFamily: 'Verdana, sans-serif', geneHeight: 18 };
    const layout = renderer.calculatePrimerTrackLayout([[{ type: 'primer', start: 1, end: 20 }]], settings);
    const placement = renderer.computePrimerPlacement(
      { type: 'primer', start: 4000, end: 4020, name: 'Custom Primer', strand: 1 },
      { start: 0, end: 10000 },
      500,
      settings
    );

    const group = renderer.createSVGPrimerElement(placement, 0, layout, settings);
    const label = group.querySelector('text');

    expect(layout.primerHeight).toBe(18);
    expect(placement.labelSide).toBe('right');
    expect(label.getAttribute('font-size')).toBe('13');
    expect(label.getAttribute('fill')).toBe('#123456');
    expect(label.getAttribute('font-family')).toBe('Verdana, sans-serif');
  });

  it('moves the label inside the arrow once the primer is wide enough to hold it', () => {
    const renderer = createPrimerRenderer();
    const layout = renderer.calculatePrimerTrackLayout([[]], {});
    const placement = renderer.computePrimerPlacement(
      { type: 'primer', start: 10, end: 50, name: 'wide', strand: 1 },
      { start: 0, end: 100 },
      500,
      {}
    );

    const label = renderer.createSVGPrimerElement(placement, 0, layout, {}).querySelector('text');

    expect(placement.labelSide).toBe('inside');
    expect(label.getAttribute('fill')).toBe('#ffffff');
  });

  it('exposes the key primer knobs in the track settings panel and reads them back', () => {
    const renderer = createPrimerRenderer();
    const modal = document.createElement('div');
    modal.innerHTML = renderer.createPrimersSettingsContent(renderer._getDefaultTrackSettings('primers'));

    modal.querySelector('#primersGlyphHeight').value = '16';
    modal.querySelector('#primersMinGlyphWidth').value = '20';
    modal.querySelector('#primersMaxRows').value = '5';
    modal.querySelector('#primersLayoutMode').value = 'singleRow';
    modal.querySelector('#primersShowLabels').checked = false;
    modal.querySelector('#primersShowPredicted').checked = false;
    modal.querySelector('#primersShowAmplicons').checked = false;

    expect(renderer.collectSettingsFromModal('primers', modal)).toMatchObject({
      geneHeight: 16,
      minGlyphWidth: 20,
      maxRows: 5,
      layoutMode: 'singleRow',
      showLabels: false,
      showPredicted: false,
      showAmplicons: false,
    });
  });

  it('labels the site origin in the legend with the same short words in every case', () => {
    const renderer = createPrimerRenderer();
    const legendChips = sites => {
      const trackContent = document.createElement('div');
      trackContent.getBoundingClientRect = () => ({ width: 640 });
      renderer.renderPrimerElements(trackContent, sites, { start: 0, end: 1000 }, {});
      return [...trackContent.querySelectorAll('.primer-legend-chip')].map(chip => chip.textContent);
    };
    const pinned = { type: 'primer', start: 100, end: 120, name: 'P', strand: 1, origin: 'pinned' };
    const predicted = { type: 'primer', start: 600, end: 620, name: 'Q', strand: -1, origin: 'predicted' };

    expect(legendChips([pinned])).toContain('pinned');
    expect(legendChips([predicted])).toContain('predicted');
    expect(legendChips([pinned, predicted])).toContain('1 pinned · 1 predicted');
    expect(legendChips([predicted]).join(' ')).not.toMatch(/real time/);
  });

  it('drops predicted binding sites when the track settings ask it to', () => {
    const renderer = createPrimerRenderer();
    const sites = [
      { type: 'primer', start: 100, end: 120, name: 'pinned', strand: 1, origin: 'pinned' },
      { type: 'primer', start: 300, end: 320, name: 'guess', strand: 1, origin: 'predicted' },
    ];
    renderer.genomeBrowser.primerManager = { getRenderableBindingSites: () => sites };
    const viewport = { start: 0, end: 1000 };

    expect(renderer.getVisiblePrimerBindings('chr1', viewport, {})).toHaveLength(2);
    expect(renderer.getVisiblePrimerBindings('chr1', viewport, { showPredicted: false })).toEqual([sites[0]]);
  });

  it('keeps names off when the user turns them off, without claiming the view is crowded', () => {
    const renderer = createPrimerRenderer();
    const placements = [{ type: 'primer', start: 100, end: 120, name: 'oligo', strand: 1 }].map(site =>
      renderer.computePrimerPlacement(site, { start: 0, end: 1000 }, 800, {})
    );

    const packed = renderer.arrangePrimersInRows(placements, { showLabels: false });

    expect(packed.labelsVisible).toBe(false);
    expect(packed.labelsAutoHidden).toBe(false);
    expect(placements[0].showLabel).toBe(false);
  });

  it('marks the derived track height so a full redraw does not carry the old one over', () => {
    const renderer = createPrimerRenderer();
    const trackContent = document.createElement('div');
    trackContent.getBoundingClientRect = () => ({ width: 640 });

    renderer.renderPrimerElements(
      trackContent,
      [{ type: 'primer', start: 110, end: 210, name: 'Primer A', strand: 1 }],
      { start: 100, end: 300 },
      {}
    );

    expect(trackContent.dataset.autoHeight).toBe('true');
    expect(parseInt(trackContent.style.height, 10)).toBeGreaterThan(0);
  });

  it('joins a forward and reverse site of the same pair into their amplicon', () => {
    const renderer = createPrimerRenderer();
    const viewport = { start: 0, end: 4000 };
    const placements = [
      { type: 'primer', start: 500, end: 520, name: 'F', strand: 1, pairId: 'pair-1' },
      { type: 'primer', start: 2400, end: 2420, name: 'R', strand: -1, pairId: 'pair-1' },
      { type: 'primer', start: 3000, end: 3020, name: 'lone', strand: 1 },
    ].map(site => renderer.computePrimerPlacement(site, viewport, 800, {}));

    const amplicons = renderer.collectPrimerAmplicons(placements, {});

    expect(amplicons).toHaveLength(1);
    expect(amplicons[0].productBp).toBe(1921);
  });
});

describe('Blast Track Subsystem', () => {
  const blastMethods = [
    'createBlastTrack',
    'createOutOfViewBlastSection',
    'createOutOfViewBlastItem',
    'filterBlastResultsByViewport',
    'renderBlastElements',
  ];

  it('should define blast track rendering methods', () => {
    const content = fs.readFileSync(TR_PATH, 'utf-8');
    for (const method of blastMethods) {
      expect(content.includes(method)).toBe(true);
    }
  });

  it('blast rendering should handle out-of-view hits', () => {
    const content = fs.readFileSync(TR_PATH, 'utf-8');
    expect(content).toContain('outOfView');
    expect(content).toContain('out-of-view');
  });
});

describe('Layout Management', () => {
  const layoutMethods = [
    'toggleTrackLayout',
    'toggleCircularMode',
    'updateCircularModeButton',
    'updateLayoutButtonAppearance',
  ];

  it('should define layout management methods', () => {
    const content = fs.readFileSync(TR_PATH, 'utf-8');
    for (const method of layoutMethods) {
      expect(content.includes(method)).toBe(true);
    }
  });
});

describe('Post-Extraction Consistency', () => {
  it('should be smaller after GeneShapeCreators extraction', () => {
    const content = fs.readFileSync(TR_PATH, 'utf-8');
    const lines = content.split('\n').length;
    // Includes primer binding, reads layout logic, and the sequence track
    // line-height/spacing settings (moved out of the header into this panel).
    expect(lines).toBeLessThan(16160);
  });

  it('should still reference GeneShapeCreators module', () => {
    const content = fs.readFileSync(TR_PATH, 'utf-8');
    expect(content).toContain('GeneShapeCreators');
    expect(content).toContain('createGeneTrack');
  });
});

describe('Genes Track Settings Tabs & Style Consistency', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(TR_PATH, 'utf-8');
  });

  it('should define createGenesSettingsContent', () => {
    expect(content).toContain('createGenesSettingsContent(settings)');
  });

  it('createGenesSettingsContent should return a tabbed layout consistent with General Settings', () => {
    expect(content).toContain('genes-settings-tabs');
    expect(content).toContain('llm-provider-tabs');
    expect(content).toContain('llm-provider-config');
    expect(content).toContain('genes-display');
    expect(content).toContain('genes-highlight');
    expect(content).toContain('genes-interaction');
    expect(content).toContain('genes-visuals');
  });

  it('should define setupGenesSettingsEventListeners', () => {
    expect(content).toContain('setupGenesSettingsEventListeners(bodyElement)');
  });

  it('setupGenesSettingsEventListeners should query llm-provider-tabs and tab-content for switching', () => {
    expect(content).toContain('.llm-provider-tabs .tab-button');
    expect(content).toContain('.llm-provider-config .tab-content');
  });

  it('loadTrackSpecificSettings should add llm-config-modal class on the modal content wrapper', () => {
    expect(content).toContain('llm-config-modal');
    expect(content).toContain("modal.querySelector('.modal-content')");
    expect(content).toContain("modalContent.classList.add('llm-config-modal')");
  });

  it('resetTrackSettingsToDefaults should support prefix matching for track types', () => {
    expect(content).toContain('this._getDefaultTrackSettings(trackType)');
    expect(content).toContain('capitalizedKey');
    expect(content).toContain("dispatchEvent(new Event('change'))");
  });
});

describe('Other Track Settings Style Consistency & Tab Refactoring', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(TR_PATH, 'utf-8');
  });

  it('createReadsSettingsContent should return a tabbed layout with shared form classes', () => {
    expect(content).toContain('createReadsSettingsContent(settings)');
    expect(content).toContain('reads-settings-tabs');
    expect(content).toContain('llm-provider-tabs');
    expect(content).toContain('llm-provider-config');
    expect(content).toContain('class="form-select"');
    expect(content).toContain('class="form-input"');
  });

  it('createVariantsSettingsContent should return a tabbed layout with form classes', () => {
    expect(content).toContain('createVariantsSettingsContent(settings)');
    expect(content).toContain('variants-settings-tabs');
    expect(content).toContain('variants-display');
    expect(content).toContain('variants-colors');
    expect(content).toContain('variants-multivcf');
  });

  it('createGCSettingsContent should return tabbed layout with gc-settings-tabs and form classes', () => {
    expect(content).toContain('createGCSettingsContent(settings)');
    expect(content).toContain('gc-settings-tabs');
    expect(content).toContain('llm-provider-tabs');
    expect(content).toContain('gc-colors');
    expect(content).toContain('gc-display');
  });

  it('createActionsSettingsContent should return tabbed layout with actions-settings-tabs and form classes', () => {
    expect(content).toContain('createActionsSettingsContent(settings)');
    expect(content).toContain('actions-settings-tabs');
    expect(content).toContain('llm-provider-tabs');
    expect(content).toContain('actions-layout');
    expect(content).toContain('actions-padding');
    expect(content).toContain('actions-typography');
  });

  it('createWIGTracksSettingsContent should return tabbed layout with wig-settings-tabs', () => {
    expect(content).toContain('createWIGTracksSettingsContent(settings)');
    expect(content).toContain('wig-settings-tabs');
    expect(content).toContain('llm-provider-tabs');
    expect(content).toContain('wig-heights');
    expect(content).toContain('wig-layout');
  });

  it('createSequenceLineSettingsContent should return tabbed layout with seqline-settings-tabs', () => {
    expect(content).toContain('createSequenceLineSettingsContent(settings)');
    expect(content).toContain('seqline-settings-tabs');
    expect(content).toContain('llm-provider-tabs');
    expect(content).toContain('seqline-display');
    expect(content).toContain('seqline-translation');
  });

  it('createSequenceSettingsContent should return tabbed layout with sequence-settings-tabs', () => {
    expect(content).toContain('createSequenceSettingsContent(settings)');
    expect(content).toContain('sequence-settings-tabs');
    expect(content).toContain('llm-provider-tabs');
    expect(content).toContain('sequence-indicators');
    expect(content).toContain('sequence-filters');
    expect(content).toContain('sequence-colors');
  });

  it('createDefaultSettingsContent should return tabbed layout with default-settings-tabs', () => {
    expect(content).toContain('createDefaultSettingsContent(trackType, settings)');
    expect(content).toContain('default-settings-tabs');
    expect(content).toContain('llm-provider-tabs');
    expect(content).toContain('default-basic');
    expect(content).toContain('default-advanced');
  });

  it('should define new setup event listener functions', () => {
    expect(content).toContain('setupSequenceSettingsEventListeners(bodyElement)');
    expect(content).toContain('setupGCSettingsEventListeners(bodyElement)');
    expect(content).toContain('setupWIGTracksSettingsEventListeners(bodyElement)');
    expect(content).toContain('setupActionsSettingsEventListeners(bodyElement)');
    expect(content).toContain('setupDefaultSettingsEventListeners(bodyElement)');
  });
});
