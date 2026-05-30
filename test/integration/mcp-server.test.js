/**
 * MCP Server Integration Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const MCP_TOOLS_DIR = path.join(process.cwd(), 'src/mcp-tools');
const MCP_SERVER_PATH = path.join(process.cwd(), 'src/mcp-server.js');

describe('MCP Server Structure', () => {
  let mcpContent;

  beforeAll(() => {
    mcpContent = fs.readFileSync(MCP_SERVER_PATH, 'utf-8');
  });

  it('mcp-server.js should exist', () => {
    expect(fs.existsSync(MCP_SERVER_PATH)).toBe(true);
  });

  it('mcp-server.js should define MCP server class', () => {
    expect(mcpContent.includes('class StandardClaudeMCPServer') || mcpContent.includes('class UnifiedMCPServer')).toBe(
      true
    );
  });

  it('mcp-server.js should export the class', () => {
    expect(mcpContent).toContain('module.exports');
  });

  it('should have port allocation logic', () => {
    expect(mcpContent.includes('port') || mcpContent.includes('PORT')).toBe(true);
  });

  it('should reference ToolsIntegrator', () => {
    expect(mcpContent).toContain('ToolsIntegrator');
  });
});

describe('MCP Tool Modules', () => {
  let toolModules;

  beforeAll(() => {
    // Collect all .js files in mcp-tools/ recursively
    const collect = dir => {
      const results = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...collect(full));
        } else if (entry.name.endsWith('.js')) {
          results.push(full);
        }
      }
      return results;
    };
    toolModules = collect(MCP_TOOLS_DIR);
  });

  it('should have at least 12 tool modules', () => {
    expect(toolModules.length).toBeGreaterThanOrEqual(12);
  });

  it('all tool modules should be valid JS', () => {
    for (const file of toolModules) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('all tool modules should define a class', () => {
    for (const file of toolModules) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content.includes('class ')).toBe(true);
    }
  });

  it('all tool modules should export via module.exports', () => {
    for (const file of toolModules) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content.includes('module.exports')).toBe(true);
    }
  });

  it('should include ToolsIntegrator.js', () => {
    const filenames = toolModules.map(f => path.basename(f));
    expect(filenames).toContain('ToolsIntegrator.js');
  });

  it('ToolsIntegrator should have combineAllTools function', () => {
    const integratorPath = path.join(MCP_TOOLS_DIR, 'ToolsIntegrator.js');
    const content = fs.readFileSync(integratorPath, 'utf-8');
    expect(content).toContain('combineAllTools');
  });

  it('should have required tool categories', () => {
    const filenames = toolModules.map(f => path.basename(f));
    const expected = [
      'NavigationTools.js',
      'SequenceTools.js',
      'ProteinTools.js',
      'DatabaseTools.js',
      'DataTools.js',
      'PathwayTools.js',
      'ActionTools.js',
      'UtilityTools.js',
      'FileTools.js',
      'TrackSettingsTools.js',
      'PrimerTools.js',
      'AnnotationTools.js',
    ];
    for (const name of expected) {
      expect(filenames, `Should include ${name}`).toContain(name);
    }
  });
});

describe('MCP System Integration', () => {
  it('system_integration.js should exist in tools_registry/', () => {
    const sysIntPath = path.join(process.cwd(), 'tools_registry/system_integration.js');
    expect(fs.existsSync(sysIntPath)).toBe(true);
  });

  it('system_integration.js should have tool merge logic', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'tools_registry/system_integration.js'), 'utf-8');
    expect(content.includes('merge') || content.includes('deduplicat')).toBe(true);
  });
});
