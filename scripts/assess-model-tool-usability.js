// Paired first-call smoke test. Pass each checkout as a separate argument
// to use its own registry, retrieval and prompt implementation.
'use strict';

const path = require('node:path');

const cases = [
  ['列出所有可用工具', 'list_available_tools', {}],
  ['查看当前浏览器状态', 'get_current_state', {}],
  ['列出已加载的文件', 'get_loaded_files_list', {}],
  ['关闭当前标签页', 'close_tab', {}],
  ['保存当前视图，命名为 morning', 'save_view_state', { name: 'morning' }],
  [
    'Open the Markdown file /data/notes.md with the viewer title Review.',
    'view_markdown_file',
    { filePath: '/data/notes.md', title: 'Review' },
  ],
  ['Set my working directory to my home directory.', 'set_working_directory', { use_home_directory: true }],
  ['Open one new tab titled Comparison.', 'open_new_tab', { title: 'Comparison' }],
];

async function main() {
  const model = process.env.OLLAMA_MODEL || 'qwen3.5:4b';
  const roots = process.argv.slice(2);
  if (!roots.length) roots.push(process.cwd());
  const catalogs = roots.map(root => {
    const directory = path.resolve(root);
    const Adapter = require(path.join(directory, 'src/renderer/modules/DynamicToolsSnapshotAdapter'));
    const manifest = require(path.join(directory, 'tools_registry/generated/tool-registry-manifest.json'));
    return { root: directory, adapter: new Adapter(manifest, {}) };
  });
  const context = {
    genomeBrowser: {
      currentChromosome: 'demo',
      availableChromosomes: ['demo'],
      currentPosition: { start: 1, end: 1000 },
    },
  };
  for (const [query, name, requiredValues] of cases) {
    for (const { root, adapter } of catalogs) {
      const prompt = await adapter.generateDynamicSystemPrompt(query, context, {
        selectionLimit: 8,
        nativeFunctionCalling: true,
      });
      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: prompt.systemPrompt },
            { role: 'user', content: query },
          ],
          tools: prompt.nativeTools,
          stream: false,
          think: false,
          options: { temperature: 0, seed: 42, num_ctx: 8192, num_predict: 256 },
        }),
      });
      if (!response.ok) throw new Error(`Local Ollama returned ${response.status}: ${await response.text()}`);
      const completion = await response.json();
      const calls = completion.message.tool_calls || [];
      const call = calls[0]?.function;
      const passed =
        calls.length === 1 &&
        call.name === name &&
        adapter.validateToolCall(name, call.arguments).valid &&
        Object.entries(requiredValues).every(([key, value]) => call.arguments[key] === value);
      console.log(
        JSON.stringify({
          harness_mode: 'first-call-smoke',
          root,
          model,
          query,
          expected: name,
          offered: prompt.toolsUsed.includes(name),
          calls,
          passed,
          promptTokens: completion.prompt_eval_count,
        })
      );
    }
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
