import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const DynamicToolsSnapshotAdapter = require('../../src/renderer/modules/DynamicToolsSnapshotAdapter.js');

function createTool(name, description, keywords = []) {
  return {
    name,
    description,
    keywords,
    category: 'analysis',
    priority: 1,
    isBuiltIn: true,
  };
}

function createAdapter() {
  const tools = [
    createTool('load_genome_file', 'Load a genome file', ['load genome']),
    createTool('get_current_state', 'Get the current browser state', ['current state']),
    createTool('design_primers', 'Design PCR primers for a target sequence', ['design primers', 'primer design']),
    createTool('run_blast_search', 'Run a BLAST sequence similarity search', ['blast search', 'run blast']),
    createTool('blast_sequence_from_region', 'Run BLAST on a loaded genomic region', [
      'blast_sequence_from_region',
      'region blast',
      'genomic region',
      'coordinates',
    ]),
    ...Array.from({ length: 20 }, (_, index) =>
      createTool(`unrelated_tool_${index}`, `Unrelated capability number ${index}`)
    ),
  ];

  return new DynamicToolsSnapshotAdapter(
    {
      tools,
      builtInTools: tools.map(tool => ({ name: tool.name, category: tool.category, priority: tool.priority })),
      categories: { categories: {} },
      counts: { tools: tools.length, builtInTools: tools.length },
    },
    { agentSystemEnabled: false }
  );
}

describe('DynamicToolsSnapshotAdapter relevance selection', () => {
  it('does not select every built-in tool when the prompt has no relevance matches', () => {
    const adapter = createAdapter();
    const selected = adapter.selectRelevantTools('tell me a joke');

    expect(selected.map(tool => tool.name)).toEqual(['load_genome_file', 'get_current_state']);
  });

  it('selects different relevant tools for different prompts', () => {
    const adapter = createAdapter();
    const primerTools = adapter.selectRelevantTools('please design primers for this sequence');
    const blastTools = adapter.selectRelevantTools('run a blast search for this sequence');

    expect(primerTools.map(tool => tool.name)).toContain('design_primers');
    expect(primerTools.map(tool => tool.name)).not.toContain('run_blast_search');
    expect(blastTools.map(tool => tool.name)).toContain('run_blast_search');
    expect(blastTools.map(tool => tool.name)).not.toContain('design_primers');
  });

  it('selects the region BLAST tool for coordinate-based BLAST prompts', () => {
    const adapter = createAdapter();
    const selected = adapter.selectRelevantTools(
      'Run BLAST for the current genomic region from 100000 to 100400 against the nt database using blast_sequence_from_region.'
    );

    expect(selected.map(tool => tool.name)).toContain('blast_sequence_from_region');
  });
});
