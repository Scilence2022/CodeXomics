import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  KNOWN_EXCEPTIONS,
  validateToolRegistryConsistency,
} = require('../../scripts/validate-tool-registry-consistency');

describe('tool registry consistency validation', () => {
  it('keeps registry surfaces aligned except for documented legacy exceptions', async () => {
    const report = await validateToolRegistryConsistency();

    expect(report.success).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.counts.registryTools).toBeGreaterThanOrEqual(180);
    expect(report.comparisons['ToolNames.js'].allowedExceptions).toEqual(
      KNOWN_EXCEPTIONS.toolNamesMissingRegistry
    );
    expect(report.comparisons['src/mcp-tools schemas'].allowedExceptions).toEqual(
      KNOWN_EXCEPTIONS.mcpMissingRegistry
    );
  });
});
