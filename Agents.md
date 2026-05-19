# CodeXomics AI Agent Behavior Rules (`Agents.md`) - v0.7beta

This document contains **behavioral rules and constraints** for AI coding assistants operating within the CodeXomics repository. For architectural context and project background, see `Memory.md`.

## 1. Adding a New Tool — Complete Checklist

1. **Create the YAML schema** in `tools_registry/<category>/<tool_name>.yaml` – Define name, description, parameters (JSON Schema format), keywords, sample_usages, and relationships.
2. **Add to `builtInToolsMap`** in `tools_registry/builtin_tools_integration.js` – Map the tool name to its ChatManager method name and category. Without this entry, the tool will be incorrectly classified as "Extended/External".
3. **Add keyword matching rules** in `analyzeBuiltInToolRelevance()` (same file) – Add regex patterns so the tool is detected when users mention relevant keywords. Without this, the tool won't be included in dynamic (per-query) prompts.
4. **Wire the execution** in `ChatManager.executeLocalTool()` or the appropriate service class (`src/renderer/modules/chat/services/`).
5. **Add to `ToolNames.js`** (`src/renderer/modules/chat/constants/ToolNames.js`) – Add the tool name constant under the appropriate category.
6. **Add to `FunctionCallsOrganizer`** (`src/renderer/modules/FunctionCallsOrganizer.js`) – Add the tool to its category mapping.
7. **Add intent keywords** in `tools_registry/registry_manager.js` – Add the tool category to `analyzeUserIntent()` and `getIntentKeywords()`.
8. **Add category to `tool_categories.yaml`** (`tools_registry/tool_categories.yaml`).
9. **MCP Server parity** – If the tool should be available to external MCP clients, add the corresponding tool definition in `src/mcp-tools/` and register in `src/mcp-server.js`.
10. **Add to tool execution policy** – Add the tool to the appropriate policy category in `LLMContextService.shouldAllowToolExecution()` (`LLMContextService.js:767-1087`). If no explicit policy is added, the default "allow once per same parameters" policy applies, which may cause unexpected `Policy blocked` errors for tools that should be re-executable.

## 2. Keyword Regex Rules

- Use `.*?` (lazy) between verb and noun to support intermediate words: `\b(open|create)\s+.*?\b(tabs?)\b` matches "open three new tabs"
- Support plural forms: `(tabs?|windows?)` not just `(tab|window)`
- Support prepositions: `\b(switch|go\s+to)\s+.*?\b(tabs?)\b` matches "switch to the analysis tab"
- **Anti-pattern**: Never use `\b(verb)\s+(noun)\b` (strict adjacency) — it fails on natural language like "search for gene", "replace the sequence", "scroll to the left"

## 3. Dynamic Tool Registry Rules

- **Rule**: Keep the built-in ChatBox tool capabilities (via `tools_registry/` descriptors) and the MCP Server schemas (via `src/mcp-tools/`) updated synchronously to ensure functional parity.
- **Rule**: Never mark a tool as `is_external: true` in `analyzeBuiltInToolRelevance()` if the tool is actually a local built-in tool.
- **Rule**: When a tool exists in both `builtInToolsMap` and the MCP server, it will be classified as Built-in with `alsoAvailableViaMCP: true`.
- **Rule**: Built-in tool parameter descriptions are enriched from the YAML registry definitions.
- **Rule**: Every tool registered in `builtInToolsMap` that should appear in dynamic prompts MUST have a corresponding keyword detection rule in `analyzeBuiltInToolRelevance()`.

## 4. LLM Configuration Rules

- **Rule**: When adding a new provider tab, include the "Other (specify below)" option and `ModelOtherGroup`/`ModelOther` input, following the exact same pattern as existing providers.
- **Rule**: The Local LLM tab uses `id="localEndpoint"` for base URL, while cloud providers use `id="{provider}BaseUrl"`. Code that reads base URL must handle this difference.
- **Rule**: `testConnection()` does NOT work on the "Model Selection" tab (`activeTab === 'models'`). Guard against this case.
- **Rule**: Each `test*()` method must include `baseUrl` fallback defaults (e.g., `'https://api.openai.com/v1'` for OpenAI) to prevent `undefined` URL concatenation.
- **Rule**: The Anthropic `testAnthropic()` method requires the `anthropic-dangerous-direct-browser-access: 'true'` header for browser-based API calls.
- **Rule**: The Google test method uses the `v1beta` API path (matching `sendGoogleMessage`), not `v1`.
- **Rule**: `testLocal()` validates that the configured model exists on the local server by parsing the `/models` response.

## 5. Multi-Agent Routing Rules

- **Rule**: When adding functionality that requires AI to sequentially execute logic (like navigating AND analyzing), integrate it as a capability into the relevant Agent class rather than building brittle one-off callbacks in the UI layer.
- **Rule**: When adding a tool that should be routed through a specific agent, add it to BOTH the agent's `toolMapping` (in `registerToolMapping()`) AND the `isSpecializedAgent` map in `MultiAgentSystem`. If the tool should get the +100 specialization bonus, it MUST be in `isSpecializedAgent`.
- **Rule**: System/utility tools (category `'system'` in `builtInToolsMap`) should NOT be added to any agent's `toolMapping`. They are handled by `ToolExecutionService` PRIORITY 7 fallback.
- **Rule**: Never make `CoordinatorAgent.canExecute()` accept all tools unconditionally — this causes infinite recursion with `ToolExecutionService` PRIORITY 3.
- **Rule**: `ChatManager.builtInTools` may be `undefined` at runtime. Never assume `this.chatManager.builtInTools.builtInToolsMap` exists. The `builtInToolsMap` lives on the `BuiltInToolsIntegration` class instance in `tools_registry/builtin_tools_integration.js`, not on `ChatManager`.
- **Rule**: When adding a new tool name, also add it to `ToolNames.js` under the appropriate category constant.

## 6. Tool Execution Policy Rules

- **Rule**: When adding a new tool, explicitly add it to the `toolPolicies` object in `LLMContextService.shouldAllowToolExecution()` (`LLMContextService.js:767-1087`). Without an explicit policy, the tool falls through to the default "allow once per same parameters" policy, which blocks re-execution with the same parameters — this causes `🚫 Policy blocked: <tool_name>` messages.
- **Rule**: Primer design tools (`design_primers`, `calculate_primer_properties`, `find_primer_binding_sites`, `add_primer_annotation`) should be added to a `primer_design` policy category with `parameter_based` policy, since users frequently re-run primer design with different parameters.
- **Rule**: The policy system is hardcoded inline. Do NOT introduce YAML/JSON config or UI toggles for policies without explicit approval — the current design keeps policies immutable and auditable.
- **Rule**: When debugging a `Policy blocked` message, check: (1) is the tool in an explicit policy category? (2) was it already executed with the same parameters? (3) is the `wasToolExecutedSuccessfully()` check finding a stale system message in conversation history?

## 7. Benchmark Rules

- **Rule**: Benchmark tools must NOT be added to any agent's `toolMapping`. They are system/utility tools handled by `ToolExecutionService` PRIORITY 7.
- **Rule**: Never use `typeof openBenchmarkInterface === 'function'` as a fallback. Always use `this.app.initializeBenchmarkSystemOnDemand()`.
- **Rule**: When calling `_getBenchmarkManager()`, use `let` (not `const`) so the variable can be reassigned after on-demand initialization.
- **Rule**: The benchmark YAML schemas are in `tools_registry/benchmark/` (8 files). The category must be declared in `tools_registry/tool_categories.yaml`.
- **Rule**: Parameter names in ChatManager methods must be consistent — use `params` or `parameters` for both the function argument and body references, never mix them.

## 8. MCP Server Rules

- **Rule**: In agent mode, `ToolsIntegrator.getAvailableTools()` returns only `codexomics_chat`, `list_genome_windows`, and `switch_active_window`.
- **Rule**: `_executeViaAgent()` translates structured tool calls into natural language prompts via `_buildAgentPromptFromToolCall()`. Unknown tools get a generic fallback prompt.
- **Rule**: `processAgentPrompt` must always go through `sendToLLM()` (the same pipeline as ChatBox user input). Never create a separate LLM call loop.
- **Rule**: `processAgentPrompt` must check `this.llmConfigManager.isConfigured()` before execution. Use `llmConfigManager` (not legacy `this.llmConfig` or `this.getCurrentModelConfig()`).
- **Rule**: The `onProgress` callback must never throw — wrap it in try/catch in `InternalMCPServer.handleCodexomicsChat()`.
- **Rule**: Agent mode timeout is 120s (vs 30s in tools mode).
- **Rule**: `setMode()` triggers `sendToolListChanged()` so MCP clients re-fetch the tool list.
- **Rule**: When the ChatBox is busy (`conversationState.isProcessing`), `processAgentPrompt` returns `{ success: false, error: 'ChatBox is busy...' }`.
- **Rule**: Client-delegated tool calls from MCP clients must use `chatManager.executeToolByName()` rather than legacy routing methods. `executeToolWithPriority()` and its category-specific switch functions are obsolete and removed.

## 9. Styling Rules

- **Rule**: Use Vanilla CSS. Do **not** use TailwindCSS, Bootstrap, or any atomic CSS frameworks unless explicitly asked. The project uses standard `.css` files in `src/renderer/css/`. Respect existing color variables and DOM structures.

## 10. UI Style Preset Rules

When adding a new UI Style preset:

1. Define preset variables in `ThemeManager.js` (name, description, icon, variables, darkVariables).
2. Create `src/renderer/css/themes/<preset>.css` with `[data-ui-style="<preset>"]` selectors overriding all hardcoded colors (header, buttons, chatbox, toolbar, toggles, checkboxes, modals, markdown, benchmark UI).
3. Add preset card in `src/renderer/index.html` inside `#stylePresetCards`.
4. Add CSS `<link>` in `src/renderer/index.html`.
5. Update `ThemeManager.applyStyle()` — add new style name to `classList.remove()` call.

- **Rule**: When `GeneralSettingsManager.saveAllSettings()` calls `applySettings()`, `applyAccentColor()` may override the preset's `--primary-color`. The guard skips override when UI Style is not `'default'`. `applySettings()` ensures `applyUIStyle()` runs after `applyAccentColor()` so preset variables always win. Do not remove these safeguards.

## 11. Tab Manager Rules

- **Rule**: When modifying any navigation, zoom, or drag functionality, pass the appropriate `source` parameter to `updateCurrentTabPosition()`.
- **Rule**: Never call `updateCurrentTabPosition()` without the options object — always include `{ source: '...' }`.
- **Rule**: The navigation ruler (`GenomeNavigationBar.js`) is the ONLY interaction that should use `{ source: 'ruler' }`.
- **Rule**: When adding new navigation methods, determine the appropriate source: position-focused → `'ruler'`, exploration-focused → preserve current mode.

## 12. Coding Conventions

1. **Vanilla JavaScript**: ES6+ only. No TypeScript or React. Use standard ES6 classes and modular imports. Native DOM manipulation or D3.js for visual updates.
2. **Robust IPC and Error Handling**: Wrap IPC calls and network requests in `try/catch`. Bubble errors up sequentially. Do not let promises fail silently.
3. **No Code Placeholders**: Provide fully working, drop-in replacement code. No `// TODO: implement logic here`.
4. **File Operations**: Always use `fs.promises` internally. Handle cross-platform paths using Node's `path` module.
5. **camelCase naming**: Use camelCase for variables and functions.

## 13. Editing Reminders

- Commit all changes in a concise conventional commit style (e.g., `feat(primer): add advanced parameters for biological directions`).
- Maintain strict adherence to semantic versioning in `package.json` and `CHANGELOG.md`.
- Do not modify `package-lock.json` manually; run `npm install` if a dependency is added.
- When generating markdown artifacts or tables, maintain standard GitHub Flavored Markdown (GFM).
- If editing `mkdocs.yml`, ensure proper YAML indentation spaces are preserved.
