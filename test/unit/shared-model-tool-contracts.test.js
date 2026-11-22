import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const manifest = require('../../tools_registry/generated/tool-registry-manifest.json');
const Adapter = require('../../src/renderer/modules/DynamicToolsSnapshotAdapter');
const Integrator = require('../../src/mcp-tools/ToolsIntegrator');
const ChatManager = require('../../src/renderer/modules/ChatManager');
const NavigationManager = require('../../src/renderer/modules/NavigationManager');
const FileManager = require('../../src/renderer/modules/FileManager');
const processing = require('../../src/renderer/modules/UnifiedSequenceProcessing');
require('../../src/renderer/modules/chat/services/GenomeAnalysisService');
require('../../src/renderer/modules/chat/services/ProteinService');
require('../../src/shared/protein-database');

const adapter = new Adapter(manifest, {});
const chat = Object.create(ChatManager.prototype);
const tools = new Integrator({});
const protein = new window.ProteinService({}, {});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('published ChatBox and MCP input contracts', () => {
  it('checks all overlapping names, excluding only the window routing fields', () => {
    const fields = schema =>
      Object.keys(schema.properties)
        .filter(key => key !== 'clientId')
        .sort();
    const fieldDrift = [];
    const requiredDrift = [];
    for (const tool of manifest.tools) {
      const mcp = tools.getToolByName(tool.name);
      if (!mcp) continue;
      const a = adapter.sanitizeNativeSchema(tool.parameters, true);
      const b = adapter.sanitizeNativeSchema(adapter.normalizeToolSchema(mcp), true);
      if (JSON.stringify(fields(a)) !== JSON.stringify(fields(b))) fieldDrift.push(tool.name);
      if (a.required.sort().join() !== b.required.sort().join()) requiredDrift.push(tool.name);
    }
    expect(fieldDrift).toEqual(['codon_usage_analysis']);
    expect(requiredDrift).toEqual(['codon_usage_analysis']);
    expect(tools.getToolByName('codon_usage_analysis').parameters.required).toContain('sequence');
  });

  it.each([
    ['get_coding_sequence', { gene_name: 'demo' }, { identifier: 'demo' }],
    ['get_interpro_entry_details', { interpro_id: 'IPR000719' }, { interproId: 'IPR000719' }],
    ['reverse_complement', { sequence: 'ACGT' }, { dna: 'ACGT' }],
    ['toggle_track', { track_name: 'genes', visible: false }, { trackName: 'genes', visible: false }],
    ['open_protein_viewer', { data_ref: 'cached' }, { dataRef: 'cached' }, { _dataRef: 'cached' }],
    ['load_wig_tracks', { filePaths: '/data/a.wig' }, { filePaths: ['/data/a.wig'] }],
    ['search_uniprot_database', { organism: 'Homo sapiens' }, { query: 'example' }],
    ['export_data', {}, { format: 'genbank' }],
  ])('accepts both call shapes for %s at both model boundaries', (name, ...cases) => {
    const schema = adapter.sanitizeNativeSchema(adapter.normalizeToolSchema(tools.getToolByName(name)), true);
    for (const args of cases) {
      expect(adapter.validateToolCall(name, args).errors).toEqual([]);
      expect(adapter.validateSchemaValue(args, schema)).toEqual([]);
      expect(tools.validateToolParameters(name, args)).toBe(true);
    }
  });

  it('reports missing identifiers before dispatch and preserves the legacy MCP track toggle', async () => {
    const executeToolOnClient = vi.fn();
    const mcp = new Integrator({ executeToolOnClient });
    await expect(mcp.executeTool('get_interpro_entry_details', {})).rejects.toThrow(/interpro_id.*interproId/);
    await expect(mcp.executeTool('load_wig_tracks', { filePaths: [false] })).rejects.toThrow(/filePaths/);
    await expect(mcp.executeTool('export_data', { start: 0.5 })).rejects.toThrow(/integer/);
    expect(executeToolOnClient).not.toHaveBeenCalled();
    await mcp.executeTool('toggle_track', { trackName: 'genes' }, 'first');
    expect(executeToolOnClient).toHaveBeenCalledWith('toggle_track', { trackName: 'genes' }, 'first');
    expect(adapter.validateToolCall('toggle_track', { trackName: 'genes' }).valid).toBe(false);
  });
});

describe('execution across tool entry points', () => {
  it('applies reverse-complement options and agrees on ambiguous bases in GC percentages', async () => {
    const args = { sequence: 'aCGn', preserve_case: true, validate_sequence: true };
    expect(chat.reverseComplement(args)).toBe('nCGt');
    expect(await tools.executeTool('reverse_complement', args)).toEqual({ reverseComplement: 'nCGt' });
    expect(chat.reverseComplement({ ...args, preserve_case: false })).toBe('NCGT');
    await expect(tools.executeTool('reverse_complement', { ...args, sequence: 'AC?' })).rejects.toThrow(/invalid/);
    const { gcContent } = await tools.executeTool('compute_gc', { sequence: 'GCNN' });
    expect(gcContent).toBe('100.00');
    expect(Number(gcContent)).toBe(processing.legacyComputeGC('GCNN'));
  });

  it('uses the results of a case-sensitive gene lookup directly in a strand-aware region call', async () => {
    const chromosome = 'demo';
    const feature = { type: 'CDS', start: 2, end: 4, strand: -1, qualifiers: { gene: ['DemoA'] } };
    vi.stubGlobal('genomeBrowser', { currentAnnotations: { [chromosome]: [feature] } });
    const manager = Object.create(ChatManager.prototype);
    manager.navigateToPosition = vi.fn().mockResolvedValue({ success: true });
    const opts = { name: 'DemoA', exact_match: true, case_sensitive: true, include_annotations: false };
    const hit = await manager.findGeneByName(opts);
    expect(hit.feature.qualifiers).toBeUndefined();
    expect(manager.navigateToPosition).not.toHaveBeenCalled();
    const service = new window.GenomeAnalysisService(
      { getSequenceForRegion: vi.fn().mockResolvedValue('AGT') },
      manager
    );
    expect(await service.getSequence(hit.genes[0])).toMatchObject({ sequence: 'ACT', strand: '-' });
    expect(await service.getSequence({ ...hit.genes[0], strand: 'both' })).toMatchObject({
      sequence: 'AGT',
      reverseComplement: 'ACT',
    });
    expect(await manager.findGeneByName({ ...opts, name: 'demoa' })).toMatchObject({ found: false, genes: [] });
    await manager.findGeneByName({ ...opts, navigate_to_gene: true });
    expect(manager.navigateToPosition).toHaveBeenCalledWith({ chromosome, start: 2, end: 4 });
    expect(
      await tools.executeRunOnWindows({ tool: 'find_gene_by_name', parameters: { ...opts, navigate_to_gene: true } })
    ).toMatchObject({ success: false, error: expect.stringContaining('read-only') });
  });

  it('passes search options into the actual feature search and bounds the sorted matches', async () => {
    document.body.innerHTML = '<select id="chromosomeSelect"><option selected>demo</option></select>';
    const features = [
      ['CDS', 'Demo', 15],
      ['gene', 'Demo', 3],
      ['CDS', 'Demo', 7],
      ['CDS', 'demo', 1],
      ['CDS', 'Demo2', 2],
    ];
    const nm = Object.create(NavigationManager.prototype);
    nm.genomeBrowser = {
      currentSequence: { demo: 'CAAA' },
      currentAnnotations: {
        demo: features.map(([type, gene, start]) => ({ type, start, end: start + 2, qualifiers: { gene } })),
      },
      getQualifierValue: (qualifiers, key) => qualifiers[key],
      updateStatus: vi.fn(),
    };
    nm.getCurrentSearchSettings = () => ({
      ...nm.getDefaultSearchSettings(),
      highlightMatches: false,
      saveHistory: false,
    });
    for (const method of [
      'clearSearchResults',
      'clearSearchHighlights',
      'populateSearchResults',
      'navigateToSearchResult',
    ]) {
      nm[method] = vi.fn();
    }
    const manager = Object.create(ChatManager.prototype);
    manager.app = { navigationManager: nm };
    const result = await manager.searchFeatures({
      query: 'Demo',
      feature_type: 'CDS',
      case_sensitive: true,
      exact_match: true,
      max_results: 1,
    });
    expect(result.count).toEqual(1);
    expect(result.results[0]).toMatchObject({ position: 7, annotation: { type: 'CDS' } });
  });

  it('applies WIG single-selection to native dialog options', () => {
    const manager = Object.create(FileManager.prototype);
    expect(manager.getOpenDialogOptions('tracks', { multiple: false }).properties).toEqual(['openFile']);
    expect(manager.getOpenDialogOptions('tracks').properties).toContain('multiSelections');
  });

  it('sends equivalent nested and flat UniProt criteria through the renderer and standalone MCP', async () => {
    const requests = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async url => {
        requests.push(new URL(url).searchParams);
        return { ok: true, json: async () => ({ results: [] }) };
      })
    );
    await protein.advancedUniprotSearch({
      query_fields: { protein_name: 'example' },
      filters: { reviewed_only: true },
      max_results: 3,
    });
    await tools.executeTool('advanced_uniprot_search', { proteinName: 'example', reviewedOnly: true, limit: 3 });
    expect(requests.map(p => [p.get('query'), p.get('size')])).toEqual(
      Array(2).fill(['(protein_name:"example") AND (reviewed:true)', '3'])
    );
    await protein.searchUniProtDatabase({ query: 'example', includeSequence: false, reviewedOnly: true, limit: 4 });
    await tools.executeTool('search_uniprot_database', {
      search_query: 'example',
      reviewed_only: true,
      max_results: 4,
    });
    expect(requests[2].get('query')).toBe(requests[3].get('query'));
    expect(requests[2].get('size')).toBe(requests[3].get('size'));
    expect(requests[3].get('fields').split(',')).not.toContain('sequence');
  });

  it('returns only the requested InterPro fields on both paths', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ metadata: { accession: 'IPR000719', name: { name: 'Example' }, type: 'family' } }),
      }))
    );
    const expected = { interproId: 'IPR000719', name: 'Example', type: 'family' };
    const mcp = await tools.executeTool('get_interpro_entry_details', {
      interpro_id: expected.interproId,
      output_format: 'minimal',
    });
    const local = await protein.getInterproEntryDetails({ interproId: expected.interproId, output_format: 'minimal' });
    expect(local.details).toEqual(expected);
    expect(mcp.details).toEqual(expected);
  });
});
