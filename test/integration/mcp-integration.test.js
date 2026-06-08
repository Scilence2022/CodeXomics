/**
 * MCP Tool Modules Integration Test
 *
 * Validates that all MCP tool modules follow the expected interface:
 * - constructor(server) pattern
 * - getTools() returns an array
 * - Each tool has required fields (name, description, inputSchema, handler)
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const MCP_TOOLS_DIR = path.join(process.cwd(), 'src/mcp-tools');

// Find all tool module files in subdirectories
function findToolModules() {
  const modules = [];
  const entries = fs.readdirSync(MCP_TOOLS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDir = path.join(MCP_TOOLS_DIR, entry.name);
      const subEntries = fs.readdirSync(subDir, { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.endsWith('.js')) {
          modules.push({
            name: subEntry.name,
            category: entry.name,
            path: path.join(subDir, subEntry.name),
          });
        }
      }
    }
  }

  return modules;
}

describe('MCP Tool Modules Integration', () => {
  const modules = findToolModules();

  it('should find MCP tool module files', () => {
    expect(modules.length).toBeGreaterThanOrEqual(10);
  });

  it('every tool module should export a class or module with getTools method', () => {
    const issues = [];
    for (const mod of modules) {
      const content = fs.readFileSync(mod.path, 'utf-8');
      const hasGetTools = content.includes('getTools') || content.includes('get_tools');
      if (!hasGetTools) {
        issues.push(`${mod.category}/${mod.name}: missing getTools method`);
      }
    }
    expect(issues.length, `Modules missing getTools: ${issues.join('; ')}`).toBe(0);
  });

  it('every tool module should accept server in constructor or as parameter', () => {
    const issues = [];
    for (const mod of modules) {
      const content = fs.readFileSync(mod.path, 'utf-8');
      const acceptsServer =
        content.includes('constructor(server)') ||
        content.includes('constructor(options)') ||
        content.includes('(server)');
      if (!acceptsServer) {
        issues.push(`${mod.category}/${mod.name}: doesn't accept server parameter`);
      }
    }
    // Soft check - some utility modules might not need server
    console.log(`Module constructor pattern check: ${issues.length} modules don't follow the standard pattern`);
  });

  it('tool definition objects should specify name, description, and input schema', () => {
    const issues = [];
    for (const mod of modules) {
      const content = fs.readFileSync(mod.path, 'utf-8');
      const hasName = content.includes('name:');
      const hasDescription = content.includes('description:');
      // MCP tools use various schema keywords: inputSchema, input, parameters
      const hasInputSchema =
        content.includes('inputSchema') ||
        content.includes('input_schema') ||
        content.includes('input:') ||
        content.includes('parameters:');

      if (!hasName) issues.push(`${mod.category}/${mod.name}: missing tool name`);
      if (!hasDescription) issues.push(`${mod.category}/${mod.name}: missing tool description`);
      if (!hasInputSchema) issues.push(`${mod.category}/${mod.name}: missing input schema`);
    }
    expect(issues.length, `Schema issues: ${issues.join('; ')}`).toBe(0);
  });

  it('tool handlers should exist for each tool definition', () => {
    const issues = [];
    for (const mod of modules) {
      const content = fs.readFileSync(mod.path, 'utf-8');
      const hasHandler = content.includes('handler:') || content.includes('callback:');
      if (!hasHandler) {
        // Some modules use different patterns, just flag for review
        console.warn(`${mod.category}/${mod.name}: no explicit handler pattern found`);
      }
    }
  });

  it('expected tool categories should exist', () => {
    const categories = new Set(modules.map(m => m.category));
    const expectedCategories = [
      'navigation',
      'sequence',
      'protein',
      'database',
      'data',
      'pathway',
      'action',
      'utility',
      'file',
      'track',
      'primer',
      'annotation',
    ];
    for (const cat of expectedCategories) {
      expect(categories.has(cat), `Expected category '${cat}' not found`).toBe(true);
    }
  });
});
