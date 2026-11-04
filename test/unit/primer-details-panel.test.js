import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PrimerDetailsPanel = require(path.join(process.cwd(), 'src/renderer/modules/PrimerDetailsPanel.js'));
const PrimerDesigner = require(path.join(process.cwd(), 'src/renderer/modules/PrimerDesigner.js'));
const TabManager = require(path.join(process.cwd(), 'src/renderer/modules/TabManager.js'));

const TAIL = 'CCCGATCGCCAGGACC';
const ANNEAL = 'GGGCATTTTCAGGAAGGTTA';

function renderableSite(overrides = {}) {
  return {
    id: 'primer_1:site_1',
    type: 'primer_binding',
    origin: 'predicted',
    name: 'test111',
    sequence: `${TAIL}${ANNEAL}`,
    primerSequence: ANNEAL,
    fivePrimeTail: TAIL,
    bindingSequence: ANNEAL,
    chromosome: 'U00096',
    start: 3134855,
    end: 3134874,
    strand: '+',
    fivePrimePhosphate: false,
    qualifiers: {
      gene: 'test111',
      label: 'test111',
      sequence: `${TAIL}${ANNEAL}`,
      binding_sequence: ANNEAL,
      five_prime_phosphate: false,
      note: '',
    },
    ...overrides,
  };
}

describe('PrimerDetailsPanel.buildModel', () => {
  const panel = new PrimerDetailsPanel(null, { designer: PrimerDesigner });

  it('separates the 5-prime tail and compares only the annealing region to the genome', () => {
    const model = panel.buildModel(renderableSite());
    expect(model.tailLength).toBe(TAIL.length);
    expect(model.annealing).toBe(ANNEAL);
    expect(model.comparable).toBe(true);
    expect(model.mismatchPositions).toEqual([]);
    expect(model.quality.tm).toBeCloseTo(57.91, 1);
    expect(model.quality.fullTm).toBeGreaterThan(model.quality.tm);
  });

  it('hides internal qualifiers from Additional Information', () => {
    const model = panel.buildModel(
      renderableSite({ qualifiers: { ...renderableSite().qualifiers, color: '#a21caf' } })
    );
    const labels = model.infoItems.map(item => item.label.toLowerCase());
    expect(labels).not.toContain('binding sequence');
    expect(labels).not.toContain('five prime phosphate');
    expect(labels).not.toContain('color');
  });

  it('numbers mismatches from the oligo 5-prime end and estimates the site Tm', () => {
    const genome = `${ANNEAL.slice(0, -2)}C${ANNEAL.slice(-1)}`; // mismatch 2 nt from the 3' end
    const model = panel.buildModel(renderableSite({ bindingSequence: genome }));
    expect(model.mismatchPositions).toEqual([ANNEAL.length - 2]);
    expect(model.threePrimeMismatches).toBe(1);
    expect(model.siteBinding.tm).toBeLessThan(model.quality.tm);
    document.body.innerHTML = panel.renderHtml(model);
    const summary = document.querySelector('.primer-mismatch-summary').textContent;
    expect(summary).toContain(`oligo position ${TAIL.length + ANNEAL.length - 1}`);
    expect(summary).toContain("within 5 nt of the 3' end");
  });

  it('reads the genome window from the chromosome when the site has none, reverse strand included', () => {
    const chromosomeSequence = `AAAA${PrimerDetailsPanel.reverseComplement(ANNEAL)}AAAA`;
    const model = panel.buildModel(
      { name: 'R1', sequence: ANNEAL, start: 5, end: 24, strand: -1, qualifiers: {} },
      { chromosome: 'chr1', chromosomeSequence }
    );
    expect(model.genomeWindow).toBe(ANNEAL);
    expect(model.mismatchPositions).toEqual([]);
  });

  it('falls back to Tm/GC parsed from the note when no designer is available', () => {
    const bare = new PrimerDetailsPanel(null, { designer: { notADesigner: true } });
    const model = bare.buildModel({
      name: 'legacy',
      start: 1,
      end: 20,
      strand: 1,
      description: 'Tm: 61.2 GC: 50',
      qualifiers: {},
    });
    expect(model.quality).toBeNull();
    expect(model.fallback).toEqual({ tm: 61.2, gcContent: 50 });
  });
});

describe('PrimerDetailsPanel.render', () => {
  let container;
  let genomeBrowser;

  beforeEach(() => {
    document.body.innerHTML = '<div id="primerDetailsContent"></div>';
    container = document.getElementById('primerDetailsContent');
    genomeBrowser = {
      showNotification: vi.fn(),
      navigationManager: { navigateToPosition: vi.fn(() => ({ success: true })) },
    };
  });

  it('shows QC cards, conditions, tail legend and no leaked fields', () => {
    new PrimerDetailsPanel(genomeBrowser, { designer: PrimerDesigner }).render(container, renderableSite());
    const text = container.textContent;
    expect(text).toContain('Tm (annealing)');
    expect(text).toContain('Tm (full oligo)');
    expect(text).toContain('Mg²⁺');
    expect(text).toContain("16 nt 5' tail");
    expect(text).toContain('Predicted site');
    expect(text).not.toContain('Five Prime Phosphate');
    expect(container.querySelectorAll('.primer-base.primer-base-tail')).toHaveLength(TAIL.length);
    expect(container.querySelector('[data-check="hairpin"]')).toBeTruthy();
    expect(container.querySelector('[data-check="selfDimer"]')).toBeTruthy();
  });

  it('zooms on the primer chromosome, not the selected one', () => {
    new PrimerDetailsPanel(genomeBrowser, { designer: PrimerDesigner }).render(container, renderableSite());
    container.querySelector('.primer-zoom-btn').click();
    expect(genomeBrowser.navigationManager.navigateToPosition).toHaveBeenCalledWith(
      'U00096',
      3134855 - 200,
      3134874 + 200
    );
  });

  it('copies the full oligo and reports clipboard failures', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    new PrimerDetailsPanel(genomeBrowser, { designer: PrimerDesigner }).render(container, renderableSite());
    container.querySelector('.primer-copy-btn').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(`${TAIL}${ANNEAL}`);
    expect(genomeBrowser.showNotification).toHaveBeenCalledWith('Could not copy sequence: denied', 'error');
  });
});

describe('TabManager primer panel restore', () => {
  it('re-renders the panel from the saved primer instead of restoring dead HTML', () => {
    document.body.innerHTML = `
      <div id="primerDetailsSection" style="display: block">
        <div id="primerDetailsContent"><button class="primer-zoom-btn"></button></div>
      </div>`;
    const site = renderableSite();
    const genomeBrowser = { selectedPrimer: site, populatePrimerDetails: vi.fn() };
    const context = { genomeBrowser, updateSidebarVisibilityForTab: vi.fn() };
    const tabState = { id: 'tab-1' };

    TabManager.prototype.saveSidebarPanelStates.call(context, tabState);
    expect(tabState.sidebarPanels.primerDetailsSection.primer).toBe(site);

    genomeBrowser.selectedPrimer = null;
    document.getElementById('primerDetailsSection').style.display = 'none';
    TabManager.prototype.restoreSidebarPanelStates.call(context, tabState);

    expect(genomeBrowser.populatePrimerDetails).toHaveBeenCalledWith(site);
    expect(genomeBrowser.selectedPrimer).toBe(site);
    expect(document.getElementById('primerDetailsSection').style.display).toBe('block');
  });

  it('hides the panel and clears the selection for a tab without a primer', () => {
    document.body.innerHTML = '<div id="primerDetailsSection" style="display: block"></div>';
    const genomeBrowser = { selectedPrimer: renderableSite(), populatePrimerDetails: vi.fn() };
    TabManager.prototype.restoreSidebarPanelStates.call(
      { genomeBrowser, updateSidebarVisibilityForTab: vi.fn() },
      { id: 'tab-2' }
    );
    expect(genomeBrowser.selectedPrimer).toBeNull();
    expect(genomeBrowser.populatePrimerDetails).not.toHaveBeenCalled();
    expect(document.getElementById('primerDetailsSection').style.display).toBe('none');
  });
});
