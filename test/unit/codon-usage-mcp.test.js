// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ToolsIntegrator = require('../../src/mcp-tools/ToolsIntegrator');
const ToolCategoryManager = require('../../src/mcp-tools/ToolCategoryManager');
const ChatManager = require('../../src/renderer/modules/ChatManager');
const GenomeAnalysisService = require('../../src/renderer/modules/chat/services/GenomeAnalysisService');
const manifest = require('../../tools_registry/generated/tool-registry-manifest.json');
const tool = 'codon_usage_analysis';

function chatForGenome() {
  const chat = Object.create(ChatManager.prototype);
  const app = {
    currentChromosome: 'demo',
    currentAnnotations: {
      demo: [
        { type: 'CDS', start: 1, end: 6, qualifiers: { gene: 'Example', locus_tag: 'DEMO_1', transl_table: '11' } },
      ],
    },
    getSequenceForRegion: async () => 'GCTGCC',
  };
  chat.services = { analysis: new GenomeAnalysisService(app, chat) };
  return chat;
}

describe('codon usage on the standalone MCP server and in ChatBox', () => {
  it('publishes identical arguments, alternatives and defaults', () => {
    const mcp = new ToolsIntegrator({});
    expect(mcp.getToolByName(tool).parameters).toEqual(manifest.toolsByName[tool].parameters);
    expect(new ToolCategoryManager().getExecutionMode(tool)).toBe('hybrid');
    expect(() => mcp.validateToolParameters(tool, {})).toThrow(/sequence.*geneName.*locusTag/);
  });

  it('returns the same raw-sequence result offline and in a ChatBox with a genome loaded', async () => {
    const args = { sequence: 'gcu NNN GCC a', geneName: 'Example', organism: 'sample' };
    const mcp = new ToolsIntegrator({});
    const result = await mcp.executeTool(tool, args);
    expect(result).toEqual(await chatForGenome().codonUsageAnalysis(args));
    expect(result).toMatchObject({
      analysisType: 'sequence',
      geneticCode: { id: 1 },
      sequenceLength: 10,
      totalCodons: 2,
      organism: 'sample',
      codonCounts: { GCT: 1, GCC: 1 },
      codonFrequencies: { GCT: '500.00', GCC: '500.00' },
    });
    expect(result.codonUsage.map(row => row.frequency)).toEqual([50, 50]);
  });

  it('honors either statistics spelling and gives the canonical spelling precedence', async () => {
    const mcp = new ToolsIntegrator({});
    const args = { sequence: 'GCTGCC', includeStatistics: false };
    const summary = await mcp.executeTool(tool, args);
    expect(summary).toMatchObject({ totalCodons: 2, uniqueCodons: 2 });
    expect(summary).not.toHaveProperty('codonUsage');
    expect(summary).not.toHaveProperty('codonCounts');
    expect(summary).toEqual(
      await chatForGenome().codonUsageAnalysis({ sequence: args.sequence, include_statistics: false })
    );
    expect(await mcp.executeTool(tool, { ...args, include_statistics: true })).toHaveProperty('codonUsage');
  });

  it.each([{ geneName: 'Example' }, { locusTag: 'DEMO_1' }, { sequence: 'GCTGCC', chromosome: 'demo' }])(
    'uses the addressed genome context for %j',
    async input => {
      const chat = chatForGenome();
      const executeToolOnClient = vi.fn((name, args) => chat.codonUsageAnalysis(args));
      const mcp = new ToolsIntegrator({ executeToolOnClient });
      const args = { ...input, windowId: 'win_2', expected_genome: 'demo' };
      const context = { requestDeadline: 1234 };
      expect(await mcp.executeTool(tool, args, 'client', context)).toMatchObject({
        totalCodons: 2,
        geneticCode: { id: 11 },
      });
      expect(executeToolOnClient).toHaveBeenCalledWith(tool, args, 'client', context);
    }
  );

  it('preserves an explicit genome guard even for a literal sequence', async () => {
    const executeToolOnClient = vi.fn().mockRejectedValue(new Error('Genome mismatch'));
    const mcp = new ToolsIntegrator({ executeToolOnClient });
    await expect(mcp.executeTool(tool, { sequence: 'GCT', expected_genome: 'other' })).rejects.toThrow(
      'Genome mismatch'
    );
    expect(executeToolOnClient).toHaveBeenCalledOnce();
  });

  it('gives actionable errors for missing windows, unknown chromosomes and unsupported legacy switches', async () => {
    const mcp = new ToolsIntegrator({});
    await expect(chatForGenome().codonUsageAnalysis({ geneName: '   ' })).rejects.toThrow(/non-empty/);
    expect(await chatForGenome().codonUsageAnalysis({ locusTag: 'DEMO_1', chromosome: 'current' })).toMatchObject({
      totalCodons: 2,
    });
    await expect(mcp.executeTool(tool, { geneName: 'Example' })).rejects.toThrow(/connected genome window/);
    await expect(chatForGenome().codonUsageAnalysis({ sequence: 'GCT', chromosome: 'absent' })).rejects.toThrow(
      /not loaded/
    );
    await expect(mcp.executeTool(tool, { sequence: 'GCT', window_size: 3 })).rejects.toThrow(/Sliding windows/);
    await expect(mcp.executeTool(tool, { sequence: 'GCT', normalize_sequence: false })).rejects.toThrow(
      /normalization is automatic/
    );
    await expect(mcp.executeTool(tool, { sequence: 'GCT', genetic_code: 'invalid' })).rejects.toThrow(/genetic code/i);
  });
});
