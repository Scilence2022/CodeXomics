/**
 * Tool selection runs once, before the first round, off keyword matching
 * against the user's opening message — and `analyzeLLMResponse` rejects any
 * call for a tool that selection did not advertise. Anything missed on round 1
 * was therefore unreachable for the rest of the turn: the model kept re-issuing
 * a call that could never succeed until the round budget ran out. A composite
 * request ("find the gene, then BLAST it") fails exactly this way when only the
 * first clause matched.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createAgentLoopHarness, openAiToolCall } = require('../helpers/agent-loop-harness.js');

const objectSchema = properties => ({
  type: 'object',
  properties: Object.fromEntries(properties.map(name => [name, { type: 'string' }])),
});

// Registry entries need real schemas: analyzeLLMResponse validates arguments
// against them, and a schemaless tool rejects every call as invalid.
const REGISTRY = [
  { name: 'find_gene_by_name', description: 'Find a gene', parameters: objectSchema(['name', 'geneName']) },
  { name: 'run_blast_search', description: 'Run BLAST', parameters: objectSchema(['sequence']) },
  { name: 'design_primers', description: 'Design primers', parameters: objectSchema(['name', 'geneName']) },
  { name: 'export_fasta_sequence', description: 'Export FASTA', parameters: objectSchema(['filePath']) },
];

describe('mid-turn tool expansion', () => {
  it('advertises a tool the first-round selection missed and lets the model retry', async () => {
    const harness = createAgentLoopHarness({
      advertisedTools: ['find_gene_by_name'],
      registryTools: REGISTRY,
      responses: [
        openAiToolCall('find_gene_by_name', { geneName: 'lysC' }, { id: 'c1' }),
        // The BLAST step was never advertised; before expansion this call was
        // dropped and the round counted as a protocol failure.
        openAiToolCall('run_blast_search', { sequence: 'ATGC' }, { id: 'c2' }),
        openAiToolCall('run_blast_search', { sequence: 'ATGC' }, { id: 'c3' }),
        'Found lysC and ran BLAST on it.',
      ],
      tools: {
        find_gene_by_name: () => ({ success: true, gene: 'lysC' }),
        run_blast_search: () => ({ success: true, hits: 3 }),
      },
    });

    const answer = await harness.send('find the lysC gene and then BLAST it');

    expect(harness.toolCalls.map(call => call.tool_name)).toEqual(['find_gene_by_name', 'run_blast_search']);
    expect(answer).toBe('Found lysC and ran BLAST on it.');
  });

  it('tells the model the tool is now callable', async () => {
    const harness = createAgentLoopHarness({
      advertisedTools: ['find_gene_by_name'],
      registryTools: REGISTRY,
      responses: [openAiToolCall('run_blast_search', { sequence: 'ATGC' }, { id: 'c1' }), 'Done.'],
      tools: { run_blast_search: () => ({ success: true }) },
    });

    await harness.send('run a BLAST search on this sequence');

    const notice = harness.requests[1].find(message => String(message.content).includes('[Tool Availability]'));
    expect(notice).toBeDefined();
    expect(notice.content).toContain('run_blast_search');
  });

  it('adds the tool to the schemas sent to the provider', async () => {
    const harness = createAgentLoopHarness({
      advertisedTools: ['find_gene_by_name'],
      registryTools: REGISTRY,
      responses: [openAiToolCall('run_blast_search', { sequence: 'ATGC' }, { id: 'c1' }), 'Done.'],
      tools: { run_blast_search: () => ({ success: true }) },
    });

    await harness.send('run a BLAST search on this sequence');

    const advertisedNames = harness.chatManager.currentNativeTools.map(tool => tool.function.name);
    expect(advertisedNames).toContain('run_blast_search');
  });

  it('appends rather than rebuilds, so the existing prefix order is preserved', async () => {
    const harness = createAgentLoopHarness({
      advertisedTools: ['find_gene_by_name'],
      registryTools: REGISTRY,
      responses: [openAiToolCall('run_blast_search', { sequence: 'ATGC' }, { id: 'c1' }), 'Done.'],
      tools: { run_blast_search: () => ({ success: true }) },
    });
    harness.chatManager.currentNativeTools = [
      { type: 'function', function: { name: 'find_gene_by_name', description: 'x', parameters: { type: 'object' } } },
    ];

    await harness.send('run a BLAST search on this sequence');

    expect(harness.chatManager.currentNativeTools.map(tool => tool.function.name)).toEqual([
      'find_gene_by_name',
      'run_blast_search',
    ]);
  });

  it('does not advertise a tool this build does not have', async () => {
    const harness = createAgentLoopHarness({
      advertisedTools: ['find_gene_by_name'],
      registryTools: REGISTRY,
      responses: [openAiToolCall('summon_a_unicorn', {}, { id: 'c1' }), 'I cannot do that.'],
      tools: {},
    });

    await harness.send('run summon_a_unicorn on this genome');

    expect(harness.chatManager.currentNativeTools.map(tool => tool.function?.name)).not.toContain('summon_a_unicorn');
    expect(harness.toolCalls).toEqual([]);
  });

  it('bounds how many times one turn may widen the tool set', () => {
    const harness = createAgentLoopHarness({ advertisedTools: ['find_gene_by_name'], registryTools: REGISTRY });
    const manager = harness.chatManager;
    const state = manager.createToolExecutionState('do everything');
    const rejected = tool => ({
      invalidToolCalls: [{ tool_name: tool, reason: `Tool was not advertised for the current request: ${tool}` }],
    });

    expect(manager.expandAdvertisedToolsForRejectedCalls(rejected('run_blast_search'), state).expanded).toBe(true);
    expect(manager.expandAdvertisedToolsForRejectedCalls(rejected('design_primers'), state).expanded).toBe(true);
    expect(manager.expandAdvertisedToolsForRejectedCalls(rejected('export_fasta_sequence'), state).expanded).toBe(true);
    // Fourth attempt is over the per-turn budget.
    expect(manager.expandAdvertisedToolsForRejectedCalls(rejected('export_fasta_sequence'), state).expanded).toBe(
      false
    );
    expect(state.toolExpansionAttempts).toBe(3);
  });

  it('does nothing when no call was rejected as unadvertised', () => {
    const harness = createAgentLoopHarness({ advertisedTools: ['find_gene_by_name'], registryTools: REGISTRY });
    const manager = harness.chatManager;

    const result = manager.expandAdvertisedToolsForRejectedCalls(
      { invalidToolCalls: [{ tool_name: 'find_gene_by_name', reason: 'Tool arguments failed schema validation' }] },
      manager.createToolExecutionState('find lysC')
    );

    expect(result.expanded).toBe(false);
  });

  it('does nothing when the dynamic registry is unavailable', () => {
    const harness = createAgentLoopHarness({ advertisedTools: ['find_gene_by_name'] });
    const manager = harness.chatManager;

    const result = manager.expandAdvertisedToolsForRejectedCalls(
      {
        invalidToolCalls: [
          {
            tool_name: 'run_blast_search',
            reason: 'Tool was not advertised for the current request: run_blast_search',
          },
        ],
      },
      manager.createToolExecutionState('blast it')
    );

    expect(result.expanded).toBe(false);
  });
});
