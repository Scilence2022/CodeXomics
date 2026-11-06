import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  collectLlmPolicyNames,
  KNOWN_EXCEPTIONS,
  validateToolAliases,
  validateToolRegistryConsistency,
} = require('../../scripts/validate-tool-registry-consistency');

describe('tool registry consistency validation', () => {
  it('keeps registry surfaces aligned except for documented legacy exceptions', async () => {
    const report = await validateToolRegistryConsistency();

    expect(report.success).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.comparisons['LLMContextService.shouldAllowToolExecution'].checked).toBe(
      collectLlmPolicyNames().length
    );
    expect(collectLlmPolicyNames()).toContain('load_genome_file');
    expect(collectLlmPolicyNames().length).toBeGreaterThan(190);
    expect(report.comparisons['LLMContextService.shouldAllowToolExecution'].staleExceptions).toEqual([]);
    expect(report.counts.registryTools).toBeGreaterThanOrEqual(178);
    expect(report.comparisons['ToolNames.js'].allowedExceptions).toEqual(KNOWN_EXCEPTIONS.toolNamesMissingRegistry);
    expect(report.comparisons['src/mcp-tools schemas'].allowedExceptions).toEqual(KNOWN_EXCEPTIONS.mcpMissingRegistry);
    expect(report.comparisons.builtInToolsMap.allowedExceptions).not.toContain('find_gene');
    expect(report.comparisons['src/mcp-tools schemas'].allowedExceptions).not.toContain('find_gene');
  });

  it('requires aliases to resolve to one canonical target across YAML and runtime', () => {
    const tools = [
      { name: 'first_tool', aliases: ['compatible', 'duplicate'] },
      { name: 'second_tool', aliases: ['duplicate'] },
    ];
    const { aliases, errors } = validateToolAliases(tools, {
      compatible: 'first_tool',
      duplicate: 'second_tool',
      first_tool: 'second_tool',
      broken: 'missing_tool',
      chained: 'compatible',
      constructor: 'first_tool',
    });

    expect(aliases.get('compatible')).toBe('first_tool');
    expect(errors).toEqual([
      expect.objectContaining({ alias: 'duplicate', existingTarget: 'first_tool', target: 'second_tool' }),
      expect.objectContaining({ alias: 'duplicate', existingTarget: 'first_tool', target: 'second_tool' }),
      expect.objectContaining({ alias: 'first_tool', message: expect.stringContaining('shadows') }),
      expect.objectContaining({ alias: 'broken', message: expect.stringContaining('missing') }),
      expect.objectContaining({ alias: 'chained', message: expect.stringContaining('missing') }),
      expect.objectContaining({ alias: 'constructor', message: expect.stringContaining('Invalid') }),
    ]);
  });
});
