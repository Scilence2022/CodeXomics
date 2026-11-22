import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Adapter = require('../../src/renderer/modules/DynamicToolsSnapshotAdapter');
const manifest = require('../../tools_registry/generated/tool-registry-manifest.json');
const { createAgentLoopHarness, openAiToolCall, openAiToolCalls } = require('../helpers/agent-loop-harness');
const ToolsIntegrator = require('../../src/mcp-tools/ToolsIntegrator');
const LLMConfigManager = require('../../src/renderer/modules/LLMConfigManager');
const adapter = new Adapter(manifest, { agentSystemEnabled: true });

describe('model-facing tool contracts', () => {
  it('ranks every exact registry name first when all registry categories are enabled', () => {
    for (const { name } of manifest.tools) {
      expect(adapter.selectRelevantTools(name, {}, 1)[0]?.name, name).toBe(name);
    }
  });

  it.each([
    ['列出所有工具', 'list_available_tools'],
    ['查看当前浏览器状态', 'get_current_state'],
    ['列出已加载的文件', 'get_loaded_files_list'],
    ['关闭当前标签页', 'close_tab'],
    ['保存当前视图', 'save_view_state'],
    ['截取当前视图', 'capture_screenshot'],
  ])('grounds the first action for %s', (query, name) => {
    expect(adapter.selectRelevantTools(query, {}, 1)[0].name).toBe(name);
  });

  it('keeps a slot for the second Chinese instruction in a two-tool budget', () => {
    const tools = adapter.selectRelevantTools('打开基因组文件，然后导出当前视图的FASTA序列', {}, 2);
    expect(tools.map(tool => tool.name)).toEqual(['load_genome_file', 'export_current_view_fasta']);
  });

  it('only teaches samples that match the tool and its advertised schema', () => {
    const tool = {
      ...manifest.toolsByName.open_new_tab,
      sample_usages: [
        { user_query: 'Bad name', tool_call: 'close_tab()' },
        { user_query: 'Bad argument', tool_call: 'open_new_tab(invented=true)' },
        { user_query: 'Open tab', tool_call: "open_new_tab(title='Review')" },
      ],
    };
    const prompt = adapter.formatSampleUsages([tool]);
    expect(prompt).toContain('"title":"Review"');
    expect(prompt).not.toContain('Bad');
    for (const registered of manifest.tools) {
      for (const sample of registered.sample_usages) {
        const call = adapter.buildCanonicalSampleCall(registered, sample);
        if (!call || call.tool_name !== registered.name) continue;
        expect(adapter.validateToolCall(call.tool_name, call.parameters).errors, registered.name).toEqual([]);
      }
    }
  });

  it('uses attached schemas in native mode and supplies all fields in text mode', async () => {
    const options = { selectionLimit: 1, nativeFunctionCalling: true };
    const native = await adapter.generateDynamicSystemPrompt('capture_screenshot', {}, options);
    const text = await adapter.generateDynamicSystemPrompt(
      'capture_screenshot',
      {},
      { ...options, nativeFunctionCalling: false }
    );
    expect(native.systemPrompt).toContain('native function calling');
    expect(native.systemPrompt).not.toContain('maxImageBytes');
    expect(native.nativeTools[0].function.parameters.properties).toHaveProperty('maxImageBytes');
    expect(text.systemPrompt).toContain('"maxImageBytes"');
    expect(text.systemPrompt).toContain('"enum"');
    expect(text.systemPrompt).not.toContain('native function calling');
  });

  it('finds a specific contract after a compact inventory and respects zero matches', async () => {
    const { chatManager } = createAgentLoopHarness();
    chatManager.dynamicTools = adapter;
    chatManager.dynamicToolsEnabled = true;
    const lookup = async parameters =>
      chatManager.sanitizeResultForLLM(await chatManager.listAvailableTools(parameters), 'list_available_tools');
    const all = await lookup({});
    expect(all.inventory_note).toContain('tool_name');
    const one = await lookup({ tool_name: 'view_markdown_file' });
    expect(one.total_tools).toBe(1);
    expect(one.categories.utility.tools[0].parameters.required).toEqual(['filePath']);
    const hits = await lookup({ query: 'open_new_tab', category: 'navigation' });
    expect(hits.categories.navigation.tools[0].name).toBe('open_new_tab');
    expect((await lookup({ tool_name: 'undefined_tool' })).total_tools).toBe(0);
    expect((await lookup({ query: 'qzqzqzqz' })).total_tools).toBe(0);
  });

  it('retrieves and validates a dotted plugin using its inline contract', async () => {
    const a = new Adapter(manifest, {});
    a.setPluginManager({
      pluginRegistry: {
        function: new Map([
          [
            'viewer',
            {
              functions: {
                compare: {
                  description: 'Compare two views',
                  parameters: {
                    type: 'object',
                    properties: { title: { type: 'string' } },
                    required: ['title'],
                  },
                },
              },
            },
          ],
        ]),
      },
    });
    const prompt = await a.generateDynamicSystemPrompt(
      'viewer.compare',
      {},
      { nativeFunctionCalling: true, selectionLimit: 1 }
    );
    expect(prompt.toolsUsed).toEqual(['viewer.compare']);
    expect(prompt.nativeTools).toEqual([]);
    expect(prompt.systemPrompt).toContain('"required":["title"]');
    expect(a.validateToolCall('viewer.compare', { title: 'Review' }).valid).toBe(true);
    expect(a.validateToolCall('viewer.compare', {}).valid).toBe(false);
  });

  it('resubmits an invalid batch with field feedback and replays the actual arguments', async () => {
    const params = { filePath: '/data/notes.md', title: 'Review' };
    const bad = { name: 'view_markdown_file', parameters: { path: params.filePath } };
    const good = { name: 'view_markdown_file', parameters: params };
    const zoom = { name: 'zoom_in' };
    const harness = createAgentLoopHarness({
      registryTools: [manifest.toolsByName.view_markdown_file, manifest.toolsByName.zoom_in],
      advertisedTools: [good.name, zoom.name],
      responses: [openAiToolCalls([bad, zoom]), openAiToolCalls([good, zoom]), 'Done.'],
      tools: { view_markdown_file: () => ({ success: true }), zoom_in: () => ({ success: true }) },
    });
    harness.chatManager.currentNativeTools = [adapter.toNativeFunctionTool(manifest.toolsByName.zoom_in)];
    await harness.send('Open the Markdown file /data/notes.md with the title Review and then zoom in.');
    const notice = harness.requests[1].find(message => message.content?.includes('[Tool Protocol Repair]'));
    expect(notice.content).toContain('$.filePath is required');
    expect(notice.content).toContain('$.path is not allowed');
    expect(notice.content).toContain('batch did not execute');
    expect(harness.toolCalls).toEqual([
      { tool_name: good.name, parameters: params },
      { tool_name: zoom.name, parameters: {} },
    ]);
    const assistant = harness.history.find(message => message.tool_calls);
    expect(JSON.parse(assistant.tool_calls[0].function.arguments)).toEqual(params);
    const messages = harness.history.filter(message => message.role === 'tool');
    for (const message of messages) expect(JSON.parse(message.content).success).toBe(true);
    const google = new LLMConfigManager({}, { get: (_key, fallback) => fallback });
    const contents = google.toGoogleContents([assistant, ...messages]);
    expect(contents.at(-1).parts[1].functionResponse.response.success).toBe(true);
  });

  it('gives text-mode repairs when schemas exist but native calling is switched off', async () => {
    const harness = createAgentLoopHarness({
      registryTools: [manifest.toolsByName.open_new_tab],
      advertisedTools: ['open_new_tab'],
      config: { 'chatboxSettings.enableNativeFunctionCalling': false },
      responses: [openAiToolCall('open_new_tab', { invented: true }), 'Done.'],
    });
    harness.chatManager.currentNativeTools = [adapter.toNativeFunctionTool(manifest.toolsByName.open_new_tab)];
    await harness.send('Open a new tab.');
    const notice = harness.requests[1].find(message => message.content?.includes('[Tool Protocol Repair]'));
    expect(notice.content).toContain('$.invented');
    expect(notice.content).toContain('canonical JSON');
  });

  it('preserves list results, bounds large inventories, and keeps failed results actionable', () => {
    const { chatManager } = createAgentLoopHarness();
    const list = [{ id: 'first' }, { id: 'second' }];
    expect(chatManager.sanitizeResultForLLM(list, 'list_items')).toEqual(list);
    const many = Array.from({ length: 75 }, (_, id) => ({ id }));
    const large = chatManager.sanitizeResultForLLM(many, 'list_items');
    expect(large.total).toBe(75);
    expect(large.items).toEqual(many.slice(0, 50));
    const round = [];
    chatManager.appendToolRoundToHistory(round, {
      toolsToExecute: [{ tool_name: 'list_items', tool_call_id: 'failed', parameters: {} }],
      toolResults: [{ tool: 'list_items', tool_call_id: 'failed', success: false, error: 'Missing index' }],
    });
    expect(JSON.parse(round[1].content)).toEqual({ success: false, error: 'Missing index' });
  });

  it('includes text-only plugin names in the constrained response format', () => {
    const manager = new LLMConfigManager({}, { get: (_key, fallback) => fallback });
    const format = manager.buildConstrainedToolResponseFormat({
      nativeFunctionCalling: false,
      constrainedToolOutput: true,
      tools: [adapter.toNativeFunctionTool(manifest.toolsByName.zoom_in)],
      selectedToolNames: ['zoom_in', 'viewer.compare'],
    });
    expect(format.json_schema.schema.properties.tool_calls.items.properties.tool_name.enum).toContain('viewer.compare');
  });

  it('honours state detail switches and counts annotations across contigs through local execution', async () => {
    const { chatManager } = createAgentLoopHarness();
    chatManager.app = { currentAnnotations: { a: [{}, {}], b: [{}] }, loadedFiles: ['demo.gbk'] };
    chatManager.getCurrentWorkingDirectory = () => '/data';
    chatManager.getVisibleTracks = () => ['genes'];
    const full = await chatManager.executeLocalTool('get_current_state', {});
    expect(full).toMatchObject({ annotationsCount: 3, visibleTracks: ['genes'], loadedFiles: ['demo.gbk'] });
    const compact = await chatManager.executeLocalTool('get_current_state', {
      include_tracks: false,
      include_data_summary: false,
    });
    expect(compact.annotationsCount).toBe(3);
    expect(compact).not.toHaveProperty('visibleTracks');
    expect(compact).not.toHaveProperty('loadedFiles');
  });

  it('publishes matching field sets and required inputs on the repaired MCP contracts', () => {
    const external = new ToolsIntegrator({}).allTools;
    for (const name of [
      'get_current_state',
      'get_genome_info',
      'capture_screenshot',
      'load_operon_file',
      'find_pathway_genes',
      'show_metabolic_pathway',
    ]) {
      const internal = adapter.toNativeFunctionTool(manifest.toolsByName[name]).function.parameters;
      const mcp = adapter.toNativeFunctionTool(external[name]).function.parameters;
      expect(Object.keys(internal.properties).sort(), name).toEqual(Object.keys(mcp.properties).sort());
      expect(internal.required, name).toEqual(mcp.required);
    }
    expect(adapter.validateToolCall('set_working_directory', { use_home_directory: true }).valid).toBe(true);
    expect(adapter.validateToolCall('set_working_directory', { use_home_directory: false }).valid).toBe(false);
  });
});
