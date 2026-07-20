import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

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

  it('keeps an explicit gene-selection request focused on select_gene', () => {
    const tools = [
      createTool('select_gene', 'Select and highlight a gene', ['select', 'highlight', 'gene']),
      createTool('find_gene_by_name', 'Find a gene by name or locus tag', ['find', 'search', 'gene']),
      createTool('jump_to_gene', 'Navigate to a gene', ['jump', 'navigate', 'gene']),
      createTool('load_genome_file', 'Load a genome file', ['load genome']),
      createTool('get_current_state', 'Get the current browser state', ['current state']),
    ];
    const adapter = new DynamicToolsSnapshotAdapter(
      {
        tools,
        builtInTools: tools.map(tool => ({ name: tool.name, category: tool.category, priority: tool.priority })),
        categories: { categories: {} },
        counts: { tools: tools.length, builtInTools: tools.length },
      },
      { agentSystemEnabled: false }
    );

    const selectedNames = adapter.selectRelevantTools('select lysC gene').map(tool => tool.name);

    expect(selectedNames).toContain('select_gene');
    expect(selectedNames).not.toContain('find_gene_by_name');
    expect(selectedNames).not.toContain('jump_to_gene');
    expect(selectedNames).not.toContain('load_genome_file');

    const themeNames = adapter.selectRelevantTools('select dark theme').map(tool => tool.name);
    expect(themeNames).not.toContain('select_gene');

    for (const nonGeneRequest of ['select dark mode', 'select blue color', 'select all primers']) {
      expect(adapter.selectRelevantTools(nonGeneRequest).map(tool => tool.name)).not.toContain('select_gene');
    }

    const modelForGene = adapter.selectRelevantTools('select a model for this gene').map(tool => tool.name);
    expect(modelForGene).not.toContain('select_gene');
  });

  it('selects select_gene for the exact lysC request against the generated registry', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'tools_registry/generated/tool-registry-manifest.json'), 'utf8')
    );
    const adapter = new DynamicToolsSnapshotAdapter(manifest, { agentSystemEnabled: false });

    const selectedNames = adapter.selectRelevantTools('select lysC gene').map(tool => tool.name);

    expect(selectedNames).toContain('select_gene');
    expect(selectedNames).not.toContain('find_gene_by_name');
    expect(selectedNames).not.toContain('jump_to_gene');
    expect(selectedNames).not.toContain('zoom_to_gene');

    const shorthandNames = adapter.selectRelevantTools('select lysC').map(tool => tool.name);
    expect(shorthandNames).toContain('select_gene');
    expect(shorthandNames).not.toContain('find_gene_by_name');

    const pluralNames = adapter.selectRelevantTools('select all genes').map(tool => tool.name);
    expect(pluralNames).not.toContain('select_gene');
  });

  it('renders mixed YAML samples as canonical JSON tool calls', () => {
    const adapter = createAdapter();
    const tool = {
      ...createTool('select_gene', 'Select a gene', ['select gene']),
      parameters: {
        type: 'object',
        properties: {
          geneName: { type: 'string', examples: ['lacZ'] },
        },
        required: ['geneName'],
      },
      sample_usages: [
        {
          user_query: 'select lysC gene',
          tool_call: "select_gene(geneName='lysC')",
        },
      ],
    };

    const rendered = adapter.formatSampleUsages([tool]);

    expect(rendered).toContain('{"tool_name":"select_gene","parameters":{"geneName":"lysC"}}');
    expect(rendered).not.toContain('select_gene(geneName=');
    expect(rendered).not.toContain('"geneName":"lacZ"');
  });

  it('canonicalizes nested Python-like sample arguments without inventing placeholders', () => {
    const adapter = createAdapter();
    const rendered = adapter.formatSampleUsages([
      {
        ...createTool('set_track_settings', 'Set track settings', ['track settings']),
        sample_usages: [
          {
            user_query: 'make the genes track taller',
            tool_call: "set_track_settings(track_type='genes', settings={'height': 150})",
          },
        ],
      },
    ]);

    expect(rendered).toContain(
      '{"tool_name":"set_track_settings","parameters":{"track_type":"genes","settings":{"height":150}}}'
    );
    expect(rendered).not.toContain('<track_type>');
  });

  it('selects the region BLAST tool for coordinate-based BLAST prompts', () => {
    const adapter = createAdapter();
    const selected = adapter.selectRelevantTools(
      'Run BLAST for the current genomic region from 100000 to 100400 against the nt database using blast_sequence_from_region.'
    );

    expect(selected.map(tool => tool.name)).toContain('blast_sequence_from_region');
  });

  it('selects connected MCP tools and includes them in the dynamic prompt', async () => {
    const registryTools = [
      createTool('load_genome_file', 'Load a genome file', ['load genome']),
      createTool('get_current_state', 'Get the current browser state', ['current state']),
    ];
    const adapter = new DynamicToolsSnapshotAdapter(
      {
        tools: registryTools,
        builtInTools: registryTools.map(tool => ({
          name: tool.name,
          category: tool.category,
          priority: tool.priority,
        })),
        categories: { categories: {} },
        counts: { tools: registryTools.length, builtInTools: registryTools.length },
      },
      {
        agentSystemEnabled: false,
        mcpServerManager: {
          getAllAvailableTools: () => [
            {
              name: 'deep-gene-research',
              description: 'Perform Deep Gene Research and produce report URLs for a selected gene.',
              inputSchema: {
                type: 'object',
                properties: {
                  gene: { type: 'string', description: 'Gene symbol or locus tag' },
                  organism: { type: 'string', description: 'Organism name' },
                },
                required: ['gene'],
              },
              serverId: 'deep-gene-research',
              serverName: 'Deep Gene Research',
              serverCategory: 'research',
              protocol: 'streamable-http',
            },
          ],
        },
      }
    );

    const query = 'Please perform a Deep Gene Research of thrA gene in Escherichia coli.';
    const selected = adapter.selectRelevantTools(query);
    const selectedNames = selected.map(tool => tool.name);

    expect(selectedNames).toContain('deep-gene-research');

    const promptData = await adapter.generateDynamicSystemPrompt(query, {});
    expect(promptData.systemPrompt).toContain('## MCP Server Tools');
    expect(promptData.systemPrompt).toContain('deep-gene-research');
    expect(promptData.mcpToolsIncluded).toBe(1);

    const allTools = await adapter.getAllTools();
    expect(allTools.map(tool => tool.name)).toContain('deep-gene-research');
  });

  it('advertises the known Deep Gene Research MCP tool when the server is connected but discovery is empty', () => {
    const registryTools = [
      createTool('load_genome_file', 'Load a genome file', ['load genome']),
      createTool('get_current_state', 'Get the current browser state', ['current state']),
    ];
    const adapter = new DynamicToolsSnapshotAdapter(
      {
        tools: registryTools,
        builtInTools: registryTools.map(tool => ({
          name: tool.name,
          category: tool.category,
          priority: tool.priority,
        })),
        categories: { categories: {} },
        counts: { tools: registryTools.length, builtInTools: registryTools.length },
      },
      {
        agentSystemEnabled: false,
        mcpServerManager: {
          getAllAvailableTools: () => [],
          getServerStatus: () => [
            {
              id: 'deep-gene-research',
              name: 'Deep Gene Research',
              category: 'research',
              protocol: 'streamable-http',
              connected: true,
              toolCount: 0,
            },
          ],
        },
      }
    );

    const selected = adapter.selectRelevantTools('Deep Gene Research thrA in Escherichia coli');
    const deepGeneTool = selected.find(tool => tool.name === 'deep-gene-research');

    expect(deepGeneTool).toBeTruthy();
    expect(deepGeneTool.source).toBe('mcp');
    expect(deepGeneTool.parameters.properties.geneSymbol).toBeTruthy();
    expect(deepGeneTool.parameters.properties.organism).toBeTruthy();
  });
});
