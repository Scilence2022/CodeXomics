import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import TrackRenderer from '../../src/renderer/modules/TrackRenderer.js';

const TR_PATH = path.join(process.cwd(), 'src/renderer/modules/TrackRenderer.js');
const CM_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
const MCP_TRACK_SETTINGS_PATH = path.join(process.cwd(), 'src/mcp-tools/track/TrackSettingsTools.js');

describe('Genes track sequence selection settings', () => {
  it('enables sequence highlighting and bottom sequence auto-scroll by default', () => {
    const trackRenderer = new TrackRenderer({});
    const defaults = trackRenderer._getDefaultTrackSettings('genes');

    expect(defaults.autoHighlightSequence).toBe(true);
    expect(defaults.autoScrollBottomSequenceOnGeneSelect).toBe(true);
  });

  it('exposes and collects the bottom sequence auto-scroll setting in Track Settings', () => {
    const content = fs.readFileSync(TR_PATH, 'utf-8');

    expect(content).toContain('id="genesAutoScrollBottomSequence"');
    expect(content).toContain('autoScrollBottomSequenceOnGeneSelect');
    expect(content).toContain("modal.querySelector('#genesAutoScrollBottomSequence')");
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

  it('keeps Genes & Features track clicks scrolling unless the caller opts out', () => {
    const genomeBrowser = {
      selectGene: vi.fn(),
      showGeneDetailsPanel: vi.fn(),
      populateGeneDetails: vi.fn(),
      scrollBottomSequenceToGene: vi.fn(),
    };
    const trackRenderer = new TrackRenderer(genomeBrowser);
    const gene = { type: 'CDS', start: 2, end: 4, strand: 1, qualifiers: { gene: 'lacZ' } };

    trackRenderer.showGeneDetails(gene, null);

    expect(genomeBrowser.selectGene).toHaveBeenCalledWith(gene, null);
    expect(genomeBrowser.showGeneDetailsPanel).toHaveBeenCalledTimes(1);
    expect(genomeBrowser.populateGeneDetails).toHaveBeenCalledWith(gene, null);
    expect(genomeBrowser.scrollBottomSequenceToGene).toHaveBeenCalledWith(gene);

    genomeBrowser.scrollBottomSequenceToGene.mockClear();
    trackRenderer.showGeneDetails(gene, null, { scrollBottomSequence: false });

    expect(genomeBrowser.scrollBottomSequenceToGene).not.toHaveBeenCalled();
  });

  it('keeps AI-facing track settings schemas in sync', () => {
    const chatManagerContent = fs.readFileSync(CM_PATH, 'utf-8');
    const mcpTrackSettingsContent = fs.readFileSync(MCP_TRACK_SETTINGS_PATH, 'utf-8');

    expect(chatManagerContent).toContain('autoHighlightSequence:');
    expect(chatManagerContent).toContain('autoScrollBottomSequenceOnGeneSelect:');
    expect(chatManagerContent).toContain("description: 'Auto-scroll Bottom Sequence Track to the selected gene");

    expect(mcpTrackSettingsContent).toContain('autoHighlightSequence:');
    expect(mcpTrackSettingsContent).toContain('autoScrollBottomSequenceOnGeneSelect:');
    expect(mcpTrackSettingsContent).toContain("description: 'Auto-scroll Bottom Sequence Track to the selected gene");
  });
});
