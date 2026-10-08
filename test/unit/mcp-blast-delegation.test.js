import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ToolsIntegrator = require('../../src/mcp-tools/ToolsIntegrator');

describe('MCP BLAST execution', () => {
  const parameters = { sequence: 'ACGTACGT', blastType: 'blastn', database: 'nt', maxTargets: 5 };
  it('returns the actual selected genome client result', async () => {
    const result = { success: true, hits: [{ accession: 'real-hit' }], source: 'NCBI' };
    const executeToolOnClient = vi.fn().mockResolvedValue(result);
    const integrator = new ToolsIntegrator({ mode: 'tools', executeToolOnClient });
    expect(await integrator.executeTool('blast_search', parameters, 'genome-2')).toBe(result);
    expect(executeToolOnClient).toHaveBeenCalledExactlyOnceWith('blast_search', parameters, 'genome-2');
  });
  it('fails when no real execution client is available', async () => {
    const executeToolOnClient = vi.fn().mockRejectedValue(new Error('No genome window available'));
    const integrator = new ToolsIntegrator({ mode: 'tools', executeToolOnClient });
    await expect(integrator.executeTool('blast_search', parameters)).rejects.toThrow('No genome window available');
  });
});
