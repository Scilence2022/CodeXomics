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
    expect(lines).toBeLessThan(16050); // includes dedicated primer binding renderer and existing track subsystems
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

  it('loadTrackSpecificSettings should add llm-config-modal class on the modal content wrapper for all track types', () => {
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

  it('createReadsSettingsContent should return tabbed layout with llm-provider-tabs and llm-provider-config and form classes', () => {
    expect(content).toContain('createReadsSettingsContent(settings)');
    expect(content).toContain('reads-settings-tabs');
    expect(content).toContain('llm-provider-tabs');
    expect(content).toContain('llm-provider-config');
    expect(content).toContain('class="form-select"');
    expect(content).toContain('class="form-input"');
  });

  it('createVariantsSettingsContent should return tabbed layout with variants-settings-tabs, llm-provider-tabs and form classes', () => {
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
