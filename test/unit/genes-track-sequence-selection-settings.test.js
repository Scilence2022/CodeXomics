import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import TrackRenderer from '../../src/renderer/modules/TrackRenderer.js';

const CM_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
const MCP_TRACK_SETTINGS_PATH = path.join(process.cwd(), 'src/mcp-tools/track/TrackSettingsTools.js');

describe('Genes track sequence selection settings', () => {
  it('enables sequence highlighting and direct bottom sequence navigation by default', () => {
    const trackRenderer = new TrackRenderer({});
    const defaults = trackRenderer._getDefaultTrackSettings('genes');

    expect(defaults.autoHighlightSequence).toBe(true);
    expect(defaults.autoScrollBottomSequenceOnGeneSelect).toBe(true);
    expect(defaults.bottomSequenceScrollMode).toBe('instant');
  });

  it.each([
    [{}, 'instant', true, 'instant'],
    [{ autoScrollBottomSequenceOnGeneSelect: true }, 'instant', true, 'instant'],
    [{ autoScrollBottomSequenceOnGeneSelect: false }, 'off', false, 'instant'],
    [{ bottomSequenceScrollMode: 'smooth-nearby' }, 'smooth-nearby', true, 'smooth-nearby'],
  ])('loads and collects bottom sequence navigation for saved settings %j', (saved, value, enabled, mode) => {
    const trackRenderer = new TrackRenderer({ configManager: { get: () => saved } });
    const modal = document.createElement('div');
    modal.innerHTML = trackRenderer.createGenesSettingsContent(trackRenderer.getTrackSettings('genes'));

    expect(modal.querySelector('#genesBottomSequenceNavigation').value).toBe(value);
    expect(trackRenderer.collectSettingsFromModal('genes', modal)).toMatchObject({
      autoScrollBottomSequenceOnGeneSelect: enabled,
      bottomSequenceScrollMode: mode,
    });
  });

  it('does not scroll the bottom sequence panel when the Genes setting is disabled', () => {
    const genomeBrowser = {
      selectGene: vi.fn(),
      showGeneDetailsPanel: vi.fn(),
      populateGeneDetails: vi.fn(),
      scrollBottomSequenceToGene: vi.fn(),
    };
    const trackRenderer = new TrackRenderer(genomeBrowser);
    trackRenderer.trackSettings.genes = {
      ...trackRenderer._getDefaultTrackSettings('genes'),
      autoScrollBottomSequenceOnGeneSelect: false,
    };

    const gene = { type: 'CDS', start: 2, end: 4, strand: 1, qualifiers: { gene: 'lacZ' } };
    trackRenderer.showGeneDetails(gene, null);

    expect(genomeBrowser.selectGene).toHaveBeenCalledWith(gene, null);
    expect(genomeBrowser.populateGeneDetails).toHaveBeenCalledWith(gene, null);
    expect(genomeBrowser.scrollBottomSequenceToGene).not.toHaveBeenCalled();
  });

  it.each(['instant', 'smooth-nearby'])(
    'passes %s for Genes & Features track clicks unless the caller opts out',
    mode => {
      const genomeBrowser = {
        selectGene: vi.fn(),
        showGeneDetailsPanel: vi.fn(),
        populateGeneDetails: vi.fn(),
        scrollBottomSequenceToGene: vi.fn(),
      };
      const trackRenderer = new TrackRenderer(genomeBrowser);
      trackRenderer.trackSettings.genes = { bottomSequenceScrollMode: mode };
      const gene = { type: 'CDS', start: 2, end: 4, strand: 1, qualifiers: { gene: 'lacZ' } };

      trackRenderer.showGeneDetails(gene, null);

      expect(genomeBrowser.selectGene).toHaveBeenCalledWith(gene, null);
      expect(genomeBrowser.showGeneDetailsPanel).toHaveBeenCalledTimes(1);
      expect(genomeBrowser.populateGeneDetails).toHaveBeenCalledWith(gene, null);
      expect(genomeBrowser.scrollBottomSequenceToGene).toHaveBeenCalledWith(gene, mode);

      genomeBrowser.scrollBottomSequenceToGene.mockClear();
      trackRenderer.showGeneDetails(gene, null, { scrollBottomSequence: false });

      expect(genomeBrowser.scrollBottomSequenceToGene).not.toHaveBeenCalled();
    }
  );

  it('queues expensive Gene Details rendering when the app scheduler is available', () => {
    const genomeBrowser = {
      selectGene: vi.fn(),
      scheduleGeneDetailsPanelUpdate: vi.fn(),
      showGeneDetailsPanel: vi.fn(),
      populateGeneDetails: vi.fn(),
      scrollBottomSequenceToGene: vi.fn(),
    };
    const trackRenderer = new TrackRenderer(genomeBrowser);
    const gene = { type: 'CDS', start: 2, end: 4, strand: 1, qualifiers: { gene: 'lacZ' } };

    trackRenderer.showGeneDetails(gene, null, { scrollBottomSequence: false });

    expect(genomeBrowser.selectGene).toHaveBeenCalledWith(gene, null);
    expect(genomeBrowser.scheduleGeneDetailsPanelUpdate).toHaveBeenCalledWith(gene, null);
    expect(genomeBrowser.populateGeneDetails).not.toHaveBeenCalled();
    expect(genomeBrowser.showGeneDetailsPanel).not.toHaveBeenCalled();
  });

  it('canonicalizes an overlapping gene feature to the qualifier-rich CDS for Gene Details', () => {
    const gene = { type: 'gene', start: 12, end: 120, strand: 1, qualifiers: { gene: 'thrA', locus_tag: 'b0002' } };
    const cds = {
      type: 'CDS',
      start: 12,
      end: 120,
      strand: 1,
      qualifiers: { gene: 'thrA', locus_tag: 'b0002', note: 'Evidence-backed annotation note.' },
    };
    const genomeBrowser = {
      currentChromosome: 'U00096',
      currentAnnotations: { U00096: [gene, cds] },
      selectGene: vi.fn(),
      showGeneDetailsPanel: vi.fn(),
      populateGeneDetails: vi.fn(),
      scrollBottomSequenceToGene: vi.fn(),
    };
    const trackRenderer = new TrackRenderer(genomeBrowser);

    trackRenderer.showGeneDetails(gene, null, { scrollBottomSequence: false });

    expect(genomeBrowser.selectGene).toHaveBeenCalledWith(cds, null);
    expect(genomeBrowser.populateGeneDetails).toHaveBeenCalledWith(cds, null);
  });

  it('canonicalizes a gene feature to a co-located ncRNA when no CDS exists', () => {
    const gene = { type: 'gene', start: 500, end: 580, strand: -1, qualifiers: { gene: 'ffs', locus_tag: 'b0002' } };
    const ncRna = {
      type: 'ncRNA',
      start: 500,
      end: 580,
      strand: -1,
      qualifiers: { gene: 'ffs', locus_tag: 'b0002', product: '4.5S RNA' },
    };
    const genomeBrowser = {
      currentChromosome: 'U00096',
      currentAnnotations: { U00096: [gene, ncRna] },
      selectGene: vi.fn(),
      showGeneDetailsPanel: vi.fn(),
      populateGeneDetails: vi.fn(),
      scrollBottomSequenceToGene: vi.fn(),
    };
    const trackRenderer = new TrackRenderer(genomeBrowser);

    trackRenderer.showGeneDetails(gene, null, { scrollBottomSequence: false });

    expect(genomeBrowser.selectGene).toHaveBeenCalledWith(ncRna, null);
    expect(genomeBrowser.populateGeneDetails).toHaveBeenCalledWith(ncRna, null);
  });

  it('keeps AI-facing track settings schemas in sync', () => {
    const chatManagerContent = fs.readFileSync(CM_PATH, 'utf-8');
    const mcpTrackSettingsContent = fs.readFileSync(MCP_TRACK_SETTINGS_PATH, 'utf-8');

    expect(chatManagerContent).toContain('autoHighlightSequence:');
    expect(chatManagerContent).toContain('autoScrollBottomSequenceOnGeneSelect:');
    expect(chatManagerContent).toContain('bottomSequenceScrollMode:');
    expect(chatManagerContent).toContain("description: 'Auto-scroll Bottom Sequence Track to the selected gene");

    expect(mcpTrackSettingsContent).toContain('autoHighlightSequence:');
    expect(mcpTrackSettingsContent).toContain('autoScrollBottomSequenceOnGeneSelect:');
    expect(mcpTrackSettingsContent).toContain('bottomSequenceScrollMode:');
    expect(mcpTrackSettingsContent).toContain("description: 'Auto-scroll Bottom Sequence Track to the selected gene");
  });
});
