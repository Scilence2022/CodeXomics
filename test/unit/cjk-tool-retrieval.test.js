/**
 * The app ships a zh-CN locale, but retrieval tokenized on /[^a-z0-9]+/ and so
 * dropped CJK entirely: a Chinese query produced zero tokens, scored no tool
 * above threshold, and fell back to the ten generic tools out of 216. These run
 * against the real generated registry so the assertions are about the tools
 * users actually have.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const DynamicToolsSnapshotAdapter = require('../../src/renderer/modules/DynamicToolsSnapshotAdapter.js');

const snapshot = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tools_registry/generated/tool-registry-manifest.json'), 'utf8')
);

const createAdapter = () => new DynamicToolsSnapshotAdapter(snapshot, {});
const select = (query, limit = 8) =>
  createAdapter()
    .selectRelevantTools(query, {}, limit)
    .map(tool => tool.name);

describe('tokenizer', () => {
  const tokenize = query => createAdapter().tokenizeSearchText(query);

  it('keeps CJK text instead of discarding it', () => {
    expect(tokenize('打开基因组文件')).toContain('基因');
    expect(tokenize('打开基因组文件')).toContain('基因组');
    expect(tokenize('打开基因组文件')).toContain('打开');
  });

  it('keeps the unsplit spelling of a trailing-capital gene symbol', () => {
    // camelCase splitting is what lets `jumpToGene` match "jump gene", but it
    // also turns `lysC` into `lys`.
    const tokens = tokenize('jump to lysC');
    expect(tokens).toContain('lysc');
  });

  it('leaves plain English tokenization unchanged', () => {
    expect(tokenize('load genome file')).toEqual(['load', 'genome', 'file']);
  });

  it('translates Chinese terms into the registry vocabulary', () => {
    const adapter = createAdapter();
    const terms = adapter.expandSearchTerms(adapter.tokenizeSearchText('打开基因组文件'));
    expect(terms).toEqual(expect.arrayContaining(['open', 'load', 'genome', 'file']));
  });
});

describe('Chinese query retrieval', () => {
  it.each([
    ['打开基因组文件', 'load_genome_file'],
    ['跳转到 lysC 基因', 'jump_to_gene'],
    ['设计引物', 'design_primers'],
    ['导出当前区域的序列', 'export_fasta_sequence'],
    ['搜索基因 rpoB', 'find_gene_by_name'],
  ])('selects the right tool for %s', (query, expectedTool) => {
    expect(select(query)).toContain(expectedTool);
  });

  it('does not collapse to the generic fallback set', () => {
    const fallback = createAdapter().getFallbackToolNames();
    const selected = select('设计引物');
    expect(selected.length).toBeGreaterThan(0);
    expect(selected).not.toEqual(fallback.slice(0, selected.length));
  });

  it('still retrieves the same tools for the English phrasing', () => {
    expect(select('load genome file')).toContain('load_genome_file');
    expect(select('design primers')).toContain('design_primers');
    expect(select('jump to the lysC gene')).toContain('jump_to_gene');
  });
});
