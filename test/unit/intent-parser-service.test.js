/**
 * IntentParserService Tests
 *
 * Validates that the parser correctly extracts tool calls from
 * LLM responses containing mixed text + JSON, think tags,
 * code fences, emojis, and nested parameters.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVICE_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/IntentParserService.js');

function createParser() {
  const code = fs.readFileSync(SERVICE_PATH, 'utf-8').replace('window.IntentParserService = IntentParserService;', '');
  const fn = new Function(code + '; return IntentParserService;');
  const IntentParserService = fn();
  return new IntentParserService({}, {});
}

describe('IntentParserService - parseToolCall', () => {
  let parser;
  beforeAll(() => {
    parser = createParser();
  });

  it('should return null for null/undefined', () => {
    expect(parser.parseToolCall(null)).toBeNull();
    expect(parser.parseToolCall(undefined)).toBeNull();
  });

  it('should parse pure JSON with nested parameters', () => {
    const result = parser.parseToolCall(
      '{"tool_name":"navigate_to_position","parameters":{"chromosome":"chr1","start":1000,"end":2000}}'
    );
    expect(result).not.toBeNull();
    expect(result.tool_name).toBe('navigate_to_position');
    expect(result.parameters.chromosome).toBe('chr1');
    expect(result.parameters.start).toBe(1000);
  });

  it('should parse text before JSON (the main mixed-content bug)', () => {
    const result = parser.parseToolCall(
      'I will navigate to that position for you.\n\n{"tool_name":"navigate_to_position","parameters":{"chromosome":"chr1","start":1000,"end":2000}}'
    );
    expect(result).not.toBeNull();
    expect(result.tool_name).toBe('navigate_to_position');
    expect(result.parameters.chromosome).toBe('chr1');
  });

  it('should parse emoji before JSON (was short-circuited by old code)', () => {
    const result = parser.parseToolCall(
      '✅ Navigating now!\n{"tool_name":"navigate_to_position","parameters":{"chromosome":"chr1","start":500}}'
    );
    expect(result).not.toBeNull();
    expect(result.tool_name).toBe('navigate_to_position');
  });

  it('should parse "Navigated to" before JSON (was short-circuited by old code)', () => {
    const result = parser.parseToolCall('Navigated to chr1.\n{"tool_name":"zoom_in","parameters":{"factor":2}}');
    expect(result).not.toBeNull();
    expect(result.tool_name).toBe('zoom_in');
  });

  it('should parse code-fence wrapped JSON', () => {
    const result = parser.parseToolCall(
      '```json\n{"tool_name":"get_sequence","parameters":{"chromosome":"chr1","start":1,"end":100}}\n```'
    );
    expect(result).not.toBeNull();
    expect(result.tool_name).toBe('get_sequence');
  });

  it('should parse deeply nested parameters (arrays + objects)', () => {
    const result = parser.parseToolCall(
      'Running gel electrophoresis now.\n{"tool_name":"simulate_gel_electrophoresis","parameters":{"fragments":[{"name":"Lane 1","sizes":[1000,500,200]}],"gel_percent":1.0}}'
    );
    expect(result).not.toBeNull();
    expect(result.tool_name).toBe('simulate_gel_electrophoresis');
    expect(result.parameters.fragments).toHaveLength(1);
    expect(result.parameters.gel_percent).toBe(1.0);
  });

  it('should skip non-tool-call JSON blocks and find the tool call', () => {
    const result = parser.parseToolCall(
      'Here is some info: {"status":"ok"}\n\n{"tool_name":"zoom_in","parameters":{"factor":3}}'
    );
    expect(result).not.toBeNull();
    expect(result.tool_name).toBe('zoom_in');
  });

  it('should return null for confirmation-only text with no tool call', () => {
    const result = parser.parseToolCall('✅ Navigated to chr1:1000-2000 successfully.');
    expect(result).toBeNull();
  });

  it('should handle empty string', () => {
    const result = parser.parseToolCall('');
    expect(result).toBeNull();
  });

  it('should fix set_working_directory malformed parameters', () => {
    const result = parser.parseToolCall('{"tool_name":"set_working_directory","parameters":{"/home/user/data":true}}');
    expect(result).not.toBeNull();
    expect(result.parameters.directory_path).toBe('/home/user/data');
  });
});

describe('IntentParserService - parseToolCall with think tags', () => {
  let parser;
  beforeAll(() => {
    parser = createParser();
  });

  it('should strip complete think tags', () => {
    const result = parser.parseToolCall(
      'Let me find that gene.\n{"tool_name":"find_gene_by_name","parameters":{"name":"lacZ"}}'
    );
    expect(result).not.toBeNull();
    expect(result.tool_name).toBe('find_gene_by_name');
  });

  it('should strip think tags with actual XML-style tags', () => {
    const input =
      'I need to navigate.\n{"tool_name":"navigate_to_position","parameters":{"chromosome":"chr1","start":1}}';
    const result = parser.parseToolCall(input);
    expect(result).not.toBeNull();
    expect(result.tool_name).toBe('navigate_to_position');
  });
});

describe('IntentParserService - parseMultipleToolCalls', () => {
  let parser;
  beforeAll(() => {
    parser = createParser();
  });

  it('should parse multiple tool calls in mixed content', () => {
    const results = parser.parseMultipleToolCalls(
      'I will do two things:\n{"tool_name":"navigate_to_position","parameters":{"chromosome":"chr1","start":1}}\n{"tool_name":"zoom_in","parameters":{"factor":2}}'
    );
    expect(results).toHaveLength(2);
    expect(results[0].tool_name).toBe('navigate_to_position');
    expect(results[1].tool_name).toBe('zoom_in');
  });

  it('should parse JSON array of tool calls', () => {
    const results = parser.parseMultipleToolCalls(
      '[{"tool_name":"navigate_to_position","parameters":{"chromosome":"chr1","start":1}},{"tool_name":"zoom_in","parameters":{"factor":2}}]'
    );
    expect(results).toHaveLength(2);
  });

  it('should return empty array for null/undefined', () => {
    expect(parser.parseMultipleToolCalls(null)).toHaveLength(0);
    expect(parser.parseMultipleToolCalls(undefined)).toHaveLength(0);
  });

  it('should return empty array for text with no tool calls', () => {
    const results = parser.parseMultipleToolCalls('Just some regular text here.');
    expect(results).toHaveLength(0);
  });

  it('should handle residual "json" text between objects', () => {
    const results = parser.parseMultipleToolCalls(
      '{"tool_name":"zoom_in","parameters":{"factor":2}}json{"tool_name":"zoom_out","parameters":{"factor":2}}'
    );
    expect(results).toHaveLength(2);
  });
});

describe('IntentParserService - _extractBalancedJsonBlocks', () => {
  let parser;
  beforeAll(() => {
    parser = createParser();
  });

  it('should not be confused by braces inside JSON strings', () => {
    const blocks = parser._extractBalancedJsonBlocks(
      '{"tool_name":"search_pattern","parameters":{"pattern":"a{2,}b"}}'
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(blocks[0]);
    expect(parsed.parameters.pattern).toBe('a{2,}b');
  });

  it('should find multiple balanced blocks in mixed text', () => {
    const blocks = parser._extractBalancedJsonBlocks('Some text {"a":1} more text {"b":2} end');
    expect(blocks).toHaveLength(2);
  });

  it('should handle nested objects', () => {
    const blocks = parser._extractBalancedJsonBlocks('{"outer":{"inner":"value"}}');
    expect(blocks).toHaveLength(1);
    const parsed = JSON.parse(blocks[0]);
    expect(parsed.outer.inner).toBe('value');
  });
});
