/**
 * "navigate to 2M" regression coverage.
 *
 * With E. coli (single sequence "U00096") loaded, the agent answered
 * `navigate_to_position(chromosome='chr1', start=2, end=4)`: it invented a
 * chromosome name that the tool examples suggested, and truncated "2M" to its
 * leading digit. The navigation then failed but reported the misleading
 * "Navigated to chr1:2-4", leaving the model with nothing to correct.
 *
 * These tests pin the four halves of the fix: coordinate shorthand is expanded,
 * unknown chromosome names are rejected with the real names attached, the tool
 * result carries the actual error, and the generated system prompt states the
 * loaded names plus the naming/coordinate rules.
 */
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ChatManager = require('../../src/renderer/modules/ChatManager.js');
const NavigationManager = require('../../src/renderer/modules/NavigationManager.js');
const DynamicToolsSnapshotAdapter = require('../../src/renderer/modules/DynamicToolsSnapshotAdapter.js');

function createNavigationManager(sequences, selectedChromosome = Object.keys(sequences)[0] || '') {
  document.body.innerHTML = `<select id="chromosomeSelect"><option value="${selectedChromosome}" selected></option></select>`;
  const genomeBrowser = {
    currentSequence: sequences,
    currentPosition: { start: 0, end: 1000 },
    currentChromosome: selectedChromosome,
    selectChromosome: vi.fn(),
    updateStatistics: vi.fn(),
    displayGenomeView: vi.fn(),
  };
  const nm = Object.create(NavigationManager.prototype);
  nm.genomeBrowser = genomeBrowser;
  return { nm, genomeBrowser };
}

function createChatManager(sequences) {
  const { nm, genomeBrowser } = createNavigationManager(sequences);
  const manager = Object.create(ChatManager.prototype);
  manager.app = {
    ...genomeBrowser,
    navigationManager: nm,
  };
  nm.genomeBrowser = manager.app;
  return manager;
}

describe('ChatManager.parseGenomicCoordinate', () => {
  const manager = Object.create(ChatManager.prototype);

  it('expands the shorthand a user types into base pairs', () => {
    expect(manager.parseGenomicCoordinate('2M')).toBe(2000000);
    expect(manager.parseGenomicCoordinate('2mb')).toBe(2000000);
    expect(manager.parseGenomicCoordinate('1.5Mb')).toBe(1500000);
    expect(manager.parseGenomicCoordinate('500k')).toBe(500000);
    expect(manager.parseGenomicCoordinate('500 kb')).toBe(500000);
    expect(manager.parseGenomicCoordinate('1,000,000')).toBe(1000000);
    expect(manager.parseGenomicCoordinate('2000000bp')).toBe(2000000);
  });

  it('passes plain numbers through and rejects unparsable values', () => {
    expect(manager.parseGenomicCoordinate(2000000)).toBe(2000000);
    expect(manager.parseGenomicCoordinate('2000000')).toBe(2000000);
    expect(manager.parseGenomicCoordinate(undefined)).toBeUndefined();
    expect(manager.parseGenomicCoordinate('')).toBeUndefined();
    expect(manager.parseGenomicCoordinate('two million')).toBeUndefined();
    expect(manager.parseGenomicCoordinate('2M-3M')).toBeUndefined();
    expect(manager.parseGenomicCoordinate(NaN)).toBeUndefined();
  });
});

describe('ChatManager.navigateToPosition', () => {
  it('navigates to 2,000,000 bp for "2M" instead of base pair 2', async () => {
    const manager = createChatManager({ U00096: 'A'.repeat(4641652) });
    const spy = vi.spyOn(manager.app.navigationManager, 'navigateToPosition');

    const result = await manager.navigateToPosition({ start: '2M' });

    expect(spy).toHaveBeenCalledWith('U00096', 1999000, 2001000);
    expect(result.success).toBe(true);
    expect(result.chromosome).toBe('U00096');
    expect(result.message).toBe('Navigated to U00096:1999000-2001000');
  });

  it('uses the displayed chromosome when the call omits one', async () => {
    const manager = createChatManager({ U00096: 'A'.repeat(4641652) });

    const result = await manager.navigateToPosition({ start: 1000, end: 2000 });

    expect(result.success).toBe(true);
    expect(result.chromosome).toBe('U00096');
  });

  it('reports the navigation error, not a "Navigated to ..." message, for an invented chromosome', async () => {
    const manager = createChatManager({ U00096: 'A'.repeat(4641652) });

    const result = await manager.navigateToPosition({ chromosome: 'chr1', start: 2, end: 4 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('chr1');
    expect(result.error).toContain('U00096');
    // executePendingToolExecutionQueue surfaces `error || message`; both must be actionable.
    expect(result.message).toBe(result.error);
    expect(result.availableChromosomes).toEqual(['U00096']);
  });

  it('rejects a coordinate it cannot interpret rather than guessing', async () => {
    const manager = createChatManager({ U00096: 'A'.repeat(4641652) });

    await expect(manager.navigateToPosition({ start: 'two million' })).rejects.toThrow(/Invalid start coordinate/);
  });
});

describe('ChatManager.zoomOut', () => {
  it('reports the failure instead of a "Zoomed out" success when nothing is loaded', async () => {
    const manager = createChatManager({});

    const result = await manager.zoomOut({ factor: 2 });

    // NavigationManager refuses the zoom, but the handler used to hardcode
    // success:true. The model saw a completed zoom that had changed nothing and
    // kept re-issuing the call for the rest of the round budget.
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/chromosome|sequence/i);
  });

  it('reports the applied factor and the widened region on success', async () => {
    const manager = createChatManager({ U00096: 'A'.repeat(4641652) });
    manager.app.genomeNavigationBar = { update: vi.fn() };
    manager.getCurrentState = () => ({
      viewingRegion: { chromosome: 'U00096', ...manager.app.currentPosition },
    });

    const result = await manager.zoomOut({ factor: 4 });

    expect(result.success).toBe(true);
    expect(result.factor).toBe(4);
    expect(result.message).toBe('Zoomed out by 4x');
    expect(manager.app.currentPosition.end - manager.app.currentPosition.start).toBe(4000);
    expect(result.newRange).toEqual({ chromosome: 'U00096', start: 0, end: 4000 });
  });
});

describe('NavigationManager chromosome resolution', () => {
  it('refuses an unknown name and lists what is loaded', () => {
    const { nm } = createNavigationManager({ U00096: 'A'.repeat(1000) });

    const result = nm.navigateToPosition('chr1', 1, 500);

    expect(result.success).toBe(false);
    expect(result.availableChromosomes).toEqual(['U00096']);
    expect(result.error).toContain('Available chromosomes: U00096');
  });

  it('accepts a real name written with different case or a chr prefix', () => {
    const { nm } = createNavigationManager({ U00096: 'A'.repeat(1000) });

    expect(nm.resolveChromosomeName('u00096')).toEqual({ name: 'U00096', matchedBy: 'case' });
    expect(nm.resolveChromosomeName('chrU00096')).toEqual({ name: 'U00096', matchedBy: 'prefix' });
    // Accessions are cited with and without their version suffix.
    expect(nm.resolveChromosomeName('U00096.3')).toEqual({ name: 'U00096', matchedBy: 'accession' });
    expect(nm.resolveChromosomeName('U00096')).toEqual({ name: 'U00096', matchedBy: 'exact' });
  });

  it('does not guess when a normalized name matches several sequences', () => {
    const { nm } = createNavigationManager({ 'contig-1': 'A'.repeat(100), CONTIG_1: 'A'.repeat(100) });

    expect(nm.resolveChromosomeName('chr1')).toBeNull();
  });

  it('explains an out-of-range position with the sequence length', () => {
    const { nm } = createNavigationManager({ U00096: 'A'.repeat(1000) });

    const result = nm.navigateToPosition('U00096', 5000, 6000);

    expect(result.success).toBe(false);
    expect(result.error).toContain('past the end of U00096');
    expect(result.error).toContain('1000');
  });
});

describe('dynamic system prompt grounding', () => {
  function buildPrompt(genomeBrowser) {
    const tools = [
      {
        name: 'navigate_to_position',
        description: 'Navigate to coordinates',
        category: 'navigation',
        priority: 1,
        isBuiltIn: true,
        parameters: { properties: { chromosome: { type: 'string', description: 'Chromosome name' } } },
      },
    ];
    const adapter = new DynamicToolsSnapshotAdapter(
      {
        tools,
        builtInTools: tools.map(tool => ({ name: tool.name, category: tool.category, priority: tool.priority })),
        categories: { categories: {} },
        counts: { tools: tools.length, builtInTools: tools.length },
      },
      {}
    );
    return adapter.buildPrompt(tools, { genomeBrowser });
  }

  it('lists the loaded chromosome names and forbids inventing one', () => {
    const prompt = buildPrompt({ currentChromosome: 'U00096', availableChromosomes: ['U00096'] });

    expect(prompt).toContain('Loaded Chromosome/Contig Names: U00096');
    expect(prompt).toMatch(/copied verbatim from the loaded names/);
    expect(prompt).toContain('2000000');
  });

  it('caps a long contig list instead of dumping every name', () => {
    const names = Array.from({ length: 40 }, (_, index) => `contig_${index}`);
    const prompt = buildPrompt({ currentChromosome: 'contig_0', availableChromosomes: names });

    expect(prompt).toContain('contig_24');
    expect(prompt).not.toContain('contig_25,');
    expect(prompt).toContain('(+15 more)');
  });

  it('says so when no genome is loaded', () => {
    const prompt = buildPrompt({ availableChromosomes: [] });

    expect(prompt).toContain('Loaded Chromosome/Contig Names: None (no genome loaded)');
  });
});

describe('ChatManager genome state for prompts', () => {
  it('reports the loaded chromosome names alongside the current one', () => {
    const manager = Object.create(ChatManager.prototype);
    manager.app = {
      currentChromosome: 'U00096',
      currentPosition: { start: 0, end: 10000 },
      currentSequence: { U00096: 'A'.repeat(100) },
      loadedFiles: [],
    };
    manager.getVisibleTracks = () => [];
    manager.getCurrentWorkingDirectory = () => null;
    manager.getOpenTabsInfo = () => [];

    const state = manager.getCurrentState();

    expect(state.availableChromosomes).toEqual(['U00096']);
    expect(state.availableChromosomeCount).toBe(1);
  });

  it('caps the prompt rendering of a fragmented assembly and points at the full list', () => {
    const manager = Object.create(ChatManager.prototype);
    const names = Array.from({ length: 120 }, (_, index) => `contig_${index}`);

    const rendered = manager.formatAvailableChromosomesForPrompt(names);

    expect(rendered).toContain('contig_0');
    expect(rendered).toContain('(+95 more, use get_chromosome_list for the full list)');
    expect(manager.formatAvailableChromosomesForPrompt([])).toBe('None loaded');
  });
});
