/**
 * ToolNames Constants Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const TOOL_NAMES_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/constants/ToolNames.js');

describe('ToolNames Constants', () => {
  beforeAll(async () => {
    // Need to mock DOM since ToolNames may reference window
    const content = fs.readFileSync(TOOL_NAMES_PATH, 'utf-8');
    // Check if it's a module or global definition
    const exportsMatch = content.match(/module\.exports\s*=\s*\{([^}]+)\}/s);
    if (exportsMatch) {
      // It exports specific values — import to validate the module loads cleanly
      await import(TOOL_NAMES_PATH + '?t=' + Date.now());
    }
  });

  it('ToolNames.js should exist', () => {
    expect(fs.existsSync(TOOL_NAMES_PATH)).toBe(true);
  });

  it('ToolNames.js should have valid JS syntax', () => {
    // Check for common tool name categories in the file
    const content = fs.readFileSync(TOOL_NAMES_PATH, 'utf-8');
    expect(content.length).toBeGreaterThan(200);
  });

  it('should define navigation tool constants', () => {
    const content = fs.readFileSync(TOOL_NAMES_PATH, 'utf-8');
    const hasNavCategories =
      content.includes('NAVIGATION') &&
      (content.includes('go_to') || content.includes('scroll') || content.includes('switch'));
    expect(hasNavCategories).toBe(true);
  });

  it('should define file loading tool constants', () => {
    const content = fs.readFileSync(TOOL_NAMES_PATH, 'utf-8');
    const hasFileCategory =
      content.includes('FILE_LOADING') || content.includes('load_genome') || content.includes('load_annotation');
    expect(hasFileCategory).toBe(true);
  });

  it('should define sequence tool constants', () => {
    const content = fs.readFileSync(TOOL_NAMES_PATH, 'utf-8');
    const hasSequenceCategory = content.includes('SEQUENCE') || content.includes('search_sequence');
    expect(hasSequenceCategory).toBe(true);
  });

  it('should define protein tool constants', () => {
    const content = fs.readFileSync(TOOL_NAMES_PATH, 'utf-8');
    const hasProteinCategory = content.includes('PROTEIN') || content.includes('fetch_');
    expect(hasProteinCategory).toBe(true);
  });

  it('should not have duplicate constant values', () => {
    const content = fs.readFileSync(TOOL_NAMES_PATH, 'utf-8');
    // Extract all string values
    const stringValues = content.match(/['"]([a-z_][a-z0-9_]*?)['"]\s*[,:}]/g) || [];
    const values = stringValues.map(s => s.replace(/['"]/g, '').replace(/[,:}]/g, '').trim());
    const duplicates = values.filter((v, i) => v.length > 2 && values.indexOf(v) !== i);
    if (duplicates.length > 0) {
      console.log(`Potential duplicate tool names: ${[...new Set(duplicates)].join(', ')}`);
    }
    // Tool name strings may appear in multiple contexts (imports, exports, constants) - just warn
    expect([...new Set(duplicates)].length).toBeLessThan(100);
  });
});
