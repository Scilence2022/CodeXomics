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
  // eslint-disable-next-line no-new-func -- intentional: loads the service source under test into an isolated function scope
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

describe('IntentParserService - analyzeResponse provider normalization', () => {
  let parser;
  beforeAll(() => {
    parser = createParser();
  });

  it('normalizes the exact lysC conversational JSON shape and parameter alias', () => {
    const response = `I'll start by searching for the lysC gene in the current E. coli K-12 genome.

{
  "name": "find_gene_by_name",
  "arguments": {
    "gene_name": "lysC"
  }
}`;

    const analysis = parser.analyzeResponse(response);

    expect(analysis.displayText).toBe("I'll start by searching for the lysC gene in the current E. coli K-12 genome.");
    expect(analysis.toolCalls).toHaveLength(1);
    expect(analysis.toolCalls[0]).toMatchObject({
      tool_name: 'find_gene_by_name',
      parameters: { name: 'lysC' },
      source: 'plain',
    });
    expect(analysis.toolCalls[0].parameters).not.toHaveProperty('gene_name');
    expect(parser.parseToolCall(response).parameters.name).toBe('lysC');
  });

  it('normalizes common gene-name aliases for selection and navigation tools', () => {
    const analysis = parser.analyzeResponse([
      { name: 'select_gene', arguments: { gene_name: 'lysC' } },
      { tool_name: 'jump_to_gene', parameters: { name: 'dnaA' } },
    ]);

    expect(analysis.toolCalls[0].parameters).toEqual({ geneName: 'lysC' });
    expect(analysis.toolCalls[1].parameters).toEqual({ geneName: 'dnaA' });
  });

  it('reports malformed JSON-string arguments as an invalid protocol candidate', () => {
    const analysis = parser.analyzeResponse({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_bad',
          type: 'function',
          function: { name: 'find_gene_by_name', arguments: '{"name":' },
        },
      ],
    });

    expect(analysis.toolCalls).toHaveLength(0);
    expect(analysis.invalidToolCalls).toHaveLength(1);
    expect(analysis.invalidToolCalls[0]).toMatchObject({
      id: 'call_bad',
      source: 'openai',
      tool_name: 'find_gene_by_name',
    });
    expect(analysis.invalidToolCalls[0].reason).toContain('not valid JSON');
    expect(analysis.hasProtocolContent).toBe(true);
    expect(analysis.isProtocolOnly).toBe(true);
  });

  it('collects mixed Anthropic text and tool_use blocks', () => {
    const analysis = parser.analyzeResponse({
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'I will find that gene now.' },
        {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'find_gene_by_name',
          input: { name: 'lysC' },
        },
      ],
      stop_reason: 'tool_use',
    });

    expect(analysis.displayText).toBe('I will find that gene now.');
    expect(analysis.toolCalls).toEqual([
      {
        tool_name: 'find_gene_by_name',
        parameters: { name: 'lysC' },
        id: 'toolu_123',
        source: 'anthropic',
      },
    ]);
    expect(analysis.stopReason).toBe('tool_use');
    expect(analysis.terminationReason).toBe('tool_use');
    expect(analysis.isProtocolOnly).toBe(false);
  });

  it('normalizes a local OpenAI-compatible message object', () => {
    const analysis = parser.analyzeResponse({
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call_local_1',
          type: 'function',
          function: {
            name: 'navigate_to_position',
            arguments: '{"chromosome":"chr1","start":1000}',
          },
        },
      ],
    });

    expect(analysis.displayText).toBe('');
    expect(analysis.toolCalls[0]).toEqual({
      tool_name: 'navigate_to_position',
      parameters: { chromosome: 'chr1', start: 1000 },
      id: 'call_local_1',
      source: 'openai',
    });
    expect(analysis.isEmpty).toBe(false);
    expect(analysis.isProtocolOnly).toBe(true);
  });

  it('uses native calls as the only executable channel inside a structured envelope', () => {
    const analysis = parser.analyzeResponse({
      role: 'assistant',
      content: '{"tool_name":"delete_primers","parameters":{"all":true}}',
      tool_calls: [
        {
          id: 'call_native',
          type: 'function',
          function: { name: 'find_gene_by_name', arguments: '{"name":"lysC"}' },
        },
      ],
    });

    expect(analysis.toolCalls).toHaveLength(1);
    expect(analysis.toolCalls[0]).toMatchObject({
      id: 'call_native',
      tool_name: 'find_gene_by_name',
      parameters: { name: 'lysC' },
    });
    expect(analysis.displayText).toContain('delete_primers');
  });

  it('distinguishes an empty protocol envelope from ordinary empty input', () => {
    const protocolEnvelope = parser.analyzeResponse({ content: null, tool_calls: [] });
    const emptyInput = parser.analyzeResponse(null);

    expect(protocolEnvelope.isEmpty).toBe(true);
    expect(protocolEnvelope.hasProtocolContent).toBe(true);
    expect(protocolEnvelope.isProtocolOnly).toBe(true);
    expect(emptyInput.isEmpty).toBe(true);
    expect(emptyInput.hasProtocolContent).toBe(false);
    expect(emptyInput.isProtocolOnly).toBe(false);
  });

  it('reads OpenAI choices and legacy function_call wrappers', () => {
    const analysis = parser.analyzeResponse({
      choices: [
        {
          finish_reason: 'function_call',
          message: {
            role: 'assistant',
            content: 'Selecting it now.',
            function_call: {
              name: 'find_gene_by_name',
              arguments: '{"geneName":"lysC"}',
            },
          },
        },
      ],
    });

    expect(analysis.displayText).toBe('Selecting it now.');
    expect(analysis.toolCalls[0].parameters).toEqual({ name: 'lysC' });
    expect(analysis.toolCalls[0].source).toBe('openai');
    expect(analysis.finishReason).toBe('function_call');
  });

  it('normalizes OpenAI Responses API function_call output items', () => {
    const analysis = parser.analyzeResponse({
      status: 'completed',
      output: [
        {
          type: 'function_call',
          call_id: 'call_response_1',
          name: 'zoom_in',
          arguments: '{"factor":2}',
        },
      ],
    });

    expect(analysis.toolCalls).toEqual([
      {
        tool_name: 'zoom_in',
        parameters: { factor: 2 },
        id: 'call_response_1',
        source: 'openai-responses',
      },
    ]);
  });

  it('normalizes Gemini functionCall parts and finishReason', () => {
    const analysis = parser.analyzeResponse({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              { text: 'Looking up lysC.' },
              {
                functionCall: {
                  name: 'find_gene_by_name',
                  args: { gene_name: 'lysC' },
                },
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    });

    expect(analysis.displayText).toBe('Looking up lysC.');
    expect(analysis.toolCalls[0]).toMatchObject({
      tool_name: 'find_gene_by_name',
      parameters: { name: 'lysC' },
      source: 'gemini',
    });
    expect(analysis.finishReason).toBe('STOP');
  });

  it('accepts a Gemini zero-parameter functionCall without args', () => {
    const analysis = parser.analyzeResponse({
      candidates: [
        {
          content: { parts: [{ functionCall: { name: 'get_current_state' } }] },
          finishReason: 'STOP',
        },
      ],
    });

    expect(analysis.invalidToolCalls).toEqual([]);
    expect(analysis.toolCalls[0]).toMatchObject({
      tool_name: 'get_current_state',
      parameters: {},
      source: 'gemini',
    });
  });

  it('supports arrays and generic structured wrappers', () => {
    const analysis = parser.analyzeResponse({
      response: {
        output: [
          { tool_name: 'zoom_in', parameters: { factor: 2 } },
          { name: 'zoom_out', arguments: '{"factor":3}' },
        ],
      },
    });

    expect(analysis.toolCalls.map(call => call.tool_name)).toEqual(['zoom_in', 'zoom_out']);
    expect(analysis.toolCalls[1].parameters).toEqual({ factor: 3 });
  });

  it('does not mine tool calls from complete think blocks', () => {
    const response = `<think>
I should invoke a tool.
{"tool_name":"delete_primers","parameters":{"all":true}}
</think>
I need a little more information before continuing.`;

    const analysis = parser.analyzeResponse(response);

    expect(analysis.toolCalls).toHaveLength(0);
    expect(analysis.invalidToolCalls).toHaveLength(0);
    expect(analysis.displayText).toBe('I need a little more information before continuing.');
    expect(analysis.reasoningText).toContain('I should invoke a tool.');
    expect(parser.parseMultipleToolCalls(response)).toEqual([]);
  });

  it('does not mine calls from unterminated or provider-native reasoning blocks', () => {
    const unterminated = parser.analyzeResponse(
      '<think>I may call {"tool_name":"delete_primers","parameters":{"all":true}}'
    );
    const structured = parser.analyzeResponse({
      content: [
        {
          type: 'thinking',
          thinking: '{"tool_name":"delete_primers","parameters":{"all":true}}',
        },
        { type: 'text', text: 'Please confirm which primers to delete.' },
      ],
    });
    const geminiThought = parser.analyzeResponse({
      content: {
        parts: [
          {
            thought: true,
            text: '{"tool_name":"delete_primers","parameters":{"all":true}}',
          },
          { text: 'Please confirm which primers to delete.' },
        ],
      },
    });
    const openAIReasoning = parser.analyzeResponse({
      content: null,
      reasoning_details: [
        {
          type: 'reasoning.text',
          text: '{"tool_name":"delete_primers","parameters":{"all":true}}',
        },
      ],
      finish_reason: 'stop',
    });

    expect(unterminated.toolCalls).toEqual([]);
    expect(unterminated.isEmpty).toBe(true);
    expect(structured.toolCalls).toEqual([]);
    expect(structured.displayText).toBe('Please confirm which primers to delete.');
    expect(geminiThought.toolCalls).toEqual([]);
    expect(geminiThought.displayText).toBe('Please confirm which primers to delete.');
    expect(openAIReasoning.toolCalls).toEqual([]);
  });

  it('protects complete and unterminated analysis/reasoning tags', () => {
    for (const tagName of ['analysis', 'reasoning']) {
      const complete = parser.analyzeResponse(
        `<${tagName}>{"tool_name":"delete_primers","parameters":{"all":true}}</${tagName}>Safe answer.`
      );
      const unterminated = parser.analyzeResponse(
        `<${tagName}>{"tool_name":"delete_primers","parameters":{"all":true}}`
      );

      expect(complete.toolCalls, tagName).toEqual([]);
      expect(complete.displayText, tagName).toBe('Safe answer.');
      expect(complete.reasoningText, tagName).toContain('delete_primers');
      expect(unterminated.toolCalls, tagName).toEqual([]);
      expect(unterminated.isEmpty, tagName).toBe(true);
    }
  });

  it('keeps explanatory tool examples and ordinary data JSON non-executable', () => {
    const example = parser.analyzeResponse(`For example, an integration could emit:
{"name":"delete_primers","arguments":{"all":true}}`);
    const data = parser.analyzeResponse('{"text":"lysC","content":{"start":10,"end":20}}');

    expect(example.toolCalls).toEqual([]);
    expect(example.displayText).toContain('"name":"delete_primers"');
    expect(data.toolCalls).toEqual([]);
    expect(data.displayText).toBe('{"text":"lysC","content":{"start":10,"end":20}}');
  });

  it('does not execute nested or explicitly untrusted text payloads', () => {
    const nested = parser.analyzeResponse('{"example":{"name":"delete_primers","arguments":{"all":true}}}');
    const untrustedTail = parser.analyzeResponse(
      'Do not execute this payload:\n{"name":"delete_primers","arguments":{"all":true}}'
    );

    expect(nested.toolCalls).toEqual([]);
    expect(nested.displayText).toContain('delete_primers');
    expect(untrustedTail.toolCalls).toEqual([]);
    expect(untrustedTail.displayText).toContain('delete_primers');
  });

  it('can disable text-derived calls while preserving native structured calls', () => {
    const textCall = parser.analyzeResponse('{"tool_name":"delete_primers","parameters":{"confirm":true}}', {
      allowTextToolCalls: false,
    });
    const nativeCall = parser.analyzeResponse(
      {
        tool_calls: [
          {
            type: 'function',
            function: { name: 'delete_primers', arguments: '{"confirm":true}' },
          },
        ],
      },
      { allowTextToolCalls: false }
    );

    expect(textCall.toolCalls).toEqual([]);
    expect(textCall.displayText).toContain('delete_primers');
    expect(nativeCall.toolCalls[0].tool_name).toBe('delete_primers');
  });

  it('surfaces native refusal state separately from visible text', () => {
    const analysis = parser.analyzeResponse({
      role: 'assistant',
      content: null,
      refusal: 'I cannot help with that request.',
      finish_reason: 'stop',
    });

    expect(analysis.isRefusal).toBe(true);
    expect(analysis.displayText).toBe('I cannot help with that request.');
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
