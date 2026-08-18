/* eslint-disable no-new-func */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const DynamicToolsSnapshotAdapter = require('../../src/renderer/modules/DynamicToolsSnapshotAdapter.js');

function loadManager() {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/renderer/modules/LLMConfigManager.js'), 'utf8');
  return new Function(`${source}; return LLMConfigManager;`)();
}

function createManager() {
  const Manager = loadManager();
  return new Manager({}, { get: () => null });
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'compute_gc',
      description: 'Compute GC content',
      strict: true,
      parameters: {
        type: 'object',
        properties: { sequence: { type: 'string' } },
        required: ['sequence'],
        additionalProperties: false,
      },
    },
  },
];

describe('native function-calling payloads', () => {
  it('normalizes legacy property-level required booleans for native APIs', () => {
    const adapter = new DynamicToolsSnapshotAdapter(
      {
        tools: [
          {
            name: 'legacy_required_tool',
            description: 'Legacy schema',
            parameters: {
              type: 'object',
              properties: {
                identifier: { type: 'string', required: true },
                verbose: { type: 'boolean', required: false },
              },
            },
          },
        ],
      },
      { agentSystemEnabled: false }
    );

    const schema = adapter.toNativeFunctionTool(adapter.toolsByName.get('legacy_required_tool')).function.parameters;
    expect(schema.required).toEqual(['identifier']);
    expect(schema.properties.identifier.required).toBeUndefined();
    expect(schema.properties.verbose.required).toBeUndefined();
  });

  it('adds strict native tools to OpenAI-compatible requests', () => {
    const manager = createManager();
    const payload = manager.buildOpenAICompatiblePayload(
      { model: 'local-small', maxTokens: 512 },
      [{ role: 'user', content: 'compute GC' }],
      { tools, nativeFunctionCalling: true, toolChoice: 'auto', temperatureOverride: 0 }
    );

    expect(payload.tools).toEqual(tools);
    expect(payload.tool_choice).toBe('auto');
    expect(payload.parallel_tool_calls).toBe(true);
    expect(payload.temperature).toBe(0);
  });

  it('uses JSON Schema constrained output when native tools are explicitly disabled', () => {
    const manager = createManager();
    const payload = manager.buildOpenAICompatiblePayload(
      { model: 'local-small' },
      [{ role: 'user', content: 'compute GC' }],
      { tools, nativeFunctionCalling: false, constrainedToolOutput: true }
    );

    expect(payload.tools).toBeUndefined();
    expect(payload.response_format.type).toBe('json_schema');
    expect(payload.response_format.json_schema.schema.properties.tool_calls.items.properties.tool_name.enum).toEqual([
      'compute_gc',
    ]);
  });

  it('maps native tools to Anthropic and Gemini declarations', () => {
    const manager = createManager();
    expect(manager.buildAnthropicTools({ tools })[0]).toMatchObject({
      name: 'compute_gc',
      input_schema: tools[0].function.parameters,
    });
    expect(manager.buildGoogleFunctionDeclarations({ tools })[0]).toMatchObject({
      name: 'compute_gc',
      parameters: {
        type: 'object',
        properties: { sequence: { type: 'string' } },
        required: ['sequence'],
      },
    });
  });
});
