/**
 * ToolNames Constants Unit Tests
 *
 * Validates the structure and integrity of the tool name registry.
 * This ensures no duplicate tool names exist across categories
 * and that the registry is well-formed.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const TOOL_NAMES_SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'src/renderer/modules/chat/constants/ToolNames.js'),
  'utf-8'
);

// Parse the TOOL_NAMES object from source (it's not exported as ESM)
function parseToolNames() {
  const toolNames = {};
  // Match category blocks: CATEGORY: { ... }
  const categoryRegex = /(\w+):\s*\{([^}]+)\}/g;
  let match;
  while ((match = categoryRegex.exec(TOOL_NAMES_SOURCE)) !== null) {
    const categoryName = match[1];
    const content = match[2];
    const tools = {};
    const toolRegex = /(\w+):\s*'([^']+)'/g;
    let toolMatch;
    while ((toolMatch = toolRegex.exec(content)) !== null) {
      tools[toolMatch[1]] = toolMatch[2];
    }
    if (Object.keys(tools).length > 0) {
      toolNames[categoryName] = tools;
    }
  }
  return toolNames;
}

describe('ToolNames Constants', () => {
  const toolNames = parseToolNames();

  it('should parse at least 10 tool categories', () => {
    expect(Object.keys(toolNames).length).toBeGreaterThanOrEqual(10);
  });

  it('should have expected core categories', () => {
    expect(toolNames).toHaveProperty('NAVIGATION');
    expect(toolNames).toHaveProperty('SEARCH');
    expect(toolNames).toHaveProperty('SEQUENCE');
  });

  it('should have no duplicate tool name values across categories', () => {
    const allNames = [];
    Object.values(toolNames).forEach(category => {
      Object.values(category).forEach(name => {
        allNames.push(name);
      });
    });

    const uniqueNames = new Set(allNames);
    if (uniqueNames.size !== allNames.length) {
      const duplicates = allNames.filter((name, index) => allNames.indexOf(name) !== index);
      console.error('Duplicate tool names found:', [...new Set(duplicates)]);
    }
    expect(uniqueNames.size).toBe(allNames.length);
  });

  it('all tool names should be snake_case strings', () => {
    Object.entries(toolNames).forEach(([category, tools]) => {
      Object.entries(tools).forEach(([key, value]) => {
        expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
      });
    });
  });

  it('NAVIGATION category should have essential navigation tools', () => {
    expect(toolNames.NAVIGATION).toHaveProperty('NAVIGATE_TO_POSITION');
    expect(toolNames.NAVIGATION).toHaveProperty('ZOOM_IN');
    expect(toolNames.NAVIGATION).toHaveProperty('ZOOM_OUT');
  });

  it('SEARCH category should have find/search tools', () => {
    expect(toolNames.SEARCH).toHaveProperty('SEARCH_FEATURES');
    expect(toolNames.SEARCH).toHaveProperty('SEARCH_GENE_BY_NAME');
  });

  it('each category should have at least 2 tools', () => {
    Object.entries(toolNames).forEach(([category, tools]) => {
      expect(Object.keys(tools).length).toBeGreaterThanOrEqual(2, `Category ${category} should have at least 2 tools`);
    });
  });
});
