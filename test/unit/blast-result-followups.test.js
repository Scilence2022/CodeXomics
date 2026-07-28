/**
 * BLAST result follow-up tools (filter / export)
 *
 * Both tools advertise that a caller can name a previous search - by searchId for export, by
 * results object for filter - but the implementation only ever read a full `results` payload
 * that no model can echo back, so every schema-conforming call failed. These tests pin the
 * resolution order, the zero-hit case, and the formats the schema promises.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

function loadMethods(relativePath, signatures) {
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const bodies = signatures.map(signature => {
    const start = source.indexOf(`\n  ${signature} {`);
    if (start === -1) throw new Error(`Unable to locate ${signature} in ${relativePath}`);
    const end = source.indexOf('\n  }\n', start);
    if (end === -1) throw new Error(`Unable to bound ${signature} in ${relativePath}`);
    return source.slice(start + 1, end + 4);
  });
  // eslint-disable-next-line no-new-func -- loads real source methods into an isolated class
  return new Function(`return class Extracted {\n${bodies.join('\n')}\n}`)();
}

const BlastFollowUpTools = loadMethods('src/renderer/modules/BlastFunctionTools.js', [
  'resolveBlastResults(params = {})',
  'normalizeBlastResultsShape(candidate)',
  'async filterBlastResults(params)',
  'async exportBlastResults(params)',
  'formatBlastResultsForExport(results, format)',
]);

const HITS = [
  {
    id: 'hit-1',
    accession: 'CP000001',
    description: 'E. coli, complete genome',
    evalue: '1e-40',
    score: 200,
    identity: 99.1,
    coverage: 100,
  },
  {
    id: 'hit-2',
    accession: 'CP000002',
    description: 'Related strain',
    evalue: '1e-20',
    score: 120,
    identity: 88.4,
    coverage: 92,
  },
  {
    id: 'hit-3',
    accession: 'CP000003',
    description: 'Distant homolog',
    evalue: '1e-05',
    score: 60,
    identity: 95.2,
    coverage: 41,
  },
];

function toolsWithSearch(results) {
  const tools = new BlastFollowUpTools();
  tools.blastManager = { searchResults: results, currentResults: results };
  return tools;
}

describe('BLAST result follow-up tools', () => {
  let writeFile;

  beforeEach(() => {
    writeFile = vi.fn(async (filePath, _content) => ({ success: true, filePath }));
    global.window = { electronAPI: { writeFile } };
  });

  afterEach(() => {
    delete global.window;
  });

  describe('filterBlastResults', () => {
    it('filters the most recent search when the caller passes only criteria', async () => {
      const tools = toolsWithSearch({ searchId: 'NCBI_1', hits: HITS });

      const result = await tools.filterBlastResults({ minIdentity: 90, maxHits: 5 });

      expect(result.success).toBe(true);
      expect(result.originalHits).toBe(3);
      expect(result.filteredHits).toBe(2);
      expect(result.results.hits.map(hit => hit.id)).toEqual(['hit-1', 'hit-3']);
    });

    it('unwraps the envelope a search tool returns around its results', async () => {
      const tools = toolsWithSearch(null);

      const result = await tools.filterBlastResults({
        results: { success: true, searchId: 'NCBI_2', results: { searchId: 'NCBI_2', hits: HITS } },
        maxHits: 1,
      });

      expect(result.filteredHits).toBe(1);
      expect(result.results.searchId).toBe('NCBI_2');
    });

    it('treats a search that matched nothing as an empty filter, not a failure', async () => {
      const tools = toolsWithSearch({ searchId: 'NCBI_3', queryInfo: { length: 21 } });

      const result = await tools.filterBlastResults({ minIdentity: 90, maxHits: 5 });

      expect(result.success).toBe(true);
      expect(result.originalHits).toBe(0);
      expect(result.filteredHits).toBe(0);
    });

    it('explains what to do when no search has been run', async () => {
      const tools = toolsWithSearch(null);

      await expect(tools.filterBlastResults({ minIdentity: 90 })).rejects.toThrow('Run a BLAST search first');
    });
  });

  describe('exportBlastResults', () => {
    it('exports the named search using only the parameters the schema declares', async () => {
      const tools = toolsWithSearch({ searchId: 'NCBI_1', hits: HITS });

      const result = await tools.exportBlastResults({
        searchId: 'NCBI_1',
        format: 'csv',
        outputPath: '/tmp/benchmark_blast_results.csv',
      });

      expect(result.success).toBe(true);
      expect(result.hitCount).toBe(3);
      expect(result.outputPath).toBe('/tmp/benchmark_blast_results.csv');

      const [, content] = writeFile.mock.calls[0];
      expect(content.split('\n')[0]).toBe('"Hit ID","Accession","Description","E-value","Score","Identity","Coverage"');
      expect(content).toContain('"hit-1","CP000001","E. coli, complete genome"');
    });

    it('writes a header-only file when the search matched nothing', async () => {
      const tools = toolsWithSearch({ searchId: 'NCBI_3', hits: [] });

      const result = await tools.exportBlastResults({ format: 'csv', outputPath: '/tmp/empty.csv' });

      expect(result.success).toBe(true);
      expect(result.hitCount).toBe(0);
      expect(writeFile.mock.calls[0][1]).toBe(
        '"Hit ID","Accession","Description","E-value","Score","Identity","Coverage"\n'
      );
    });

    it('produces content for the tsv default instead of an empty file', async () => {
      const tools = toolsWithSearch({ searchId: 'NCBI_1', hits: HITS });

      const result = await tools.exportBlastResults({ outputPath: '/tmp/hits.tsv' });

      expect(result.format).toBe('tsv');
      expect(result.size).toBeGreaterThan(0);
      expect(writeFile.mock.calls[0][1].split('\n')[0].split('\t')).toHaveLength(7);
    });

    it('refuses to export a different search than the one requested', async () => {
      const tools = toolsWithSearch({ searchId: 'NCBI_1', hits: HITS });

      await expect(tools.exportBlastResults({ searchId: 'NCBI_STALE', format: 'csv' })).rejects.toThrow(
        'No BLAST results found for searchId "NCBI_STALE"'
      );
    });

    it('reports an unsupported format rather than writing an empty file', async () => {
      const tools = toolsWithSearch({ searchId: 'NCBI_1', hits: HITS });

      const result = await tools.exportBlastResults({ format: 'pdf', outputPath: '/tmp/hits.pdf' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported export format');
      expect(writeFile).not.toHaveBeenCalled();
    });
  });

  describe('formatBlastResultsForExport', () => {
    it('escapes the delimiter of each tabular format', () => {
      const tools = toolsWithSearch(null);
      const results = { searchId: 'NCBI_1', hits: [{ ...HITS[0], description: 'quoted "name",\tand a tab' }] };

      expect(tools.formatBlastResultsForExport(results, 'csv')).toContain('"quoted ""name"",\tand a tab"');
      expect(tools.formatBlastResultsForExport(results, 'tsv').split('\n')[1].split('\t')).toHaveLength(7);
    });

    it('escapes XML markup in hit descriptions', () => {
      const tools = toolsWithSearch(null);
      const xml = tools.formatBlastResultsForExport(
        { searchId: 'NCBI_1', hits: [{ ...HITS[0], description: 'operon <thrL> & friends' }] },
        'xml'
      );

      expect(xml).toContain('<description>operon &lt;thrL&gt; &amp; friends</description>');
      expect(xml).toContain('<SearchId>NCBI_1</SearchId>');
    });
  });
});
