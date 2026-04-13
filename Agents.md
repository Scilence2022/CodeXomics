# CodeXomics AI Assistant Guidelines (`Agents.md`)

This document is intended for AI coding assistants (e.g., GitHub Copilot, Cursor, Gemini, Claude) operating within the CodeXomics repository. It provides critical context, structural rules, and architectural guidelines necessary for making accurate, stable modifications to the codebase. Provide this file as context when bootstrapping a new session.

## 1. Project Context
**CodeXomics** is an AI-powered bioinformatics analysis platform built as a desktop application using **Electron**. It provides genome visualization, plugin extensions, and an integrated multi-agent AI system for executing biological analysis tools.

- **Stack**: Node.js, Electron, Vanilla JS (ES6+), HTML5, Vanilla CSS, and various specialized bioinformatics libraries (e.g., D3.js).
- **Package Manager**: npm (Workspace structure enabled in `packages/`).
- **Main Process**: `src/main.js`
- **Renderer Process**: `src/renderer/`

## 2. Directory Structure & Where to Work
- `src/main.js` – Electron main process entry point. Keep logic minimal here; use IPC paths (`ipcMain`/`ipcRenderer`) to communicate with the renderer process safely.
- `src/renderer/modules/` – Core application logic organized as ES6 classes and modules.
  - `ChatManager.js`, `MultiAgentSystem.js` – Central orchestration for in-app AI interactions.
  - `TrackRenderer.js`, `CanvasSequenceRenderer.js` – Visualization components heavily relying on SVG/Canvas.
- `tools_registry/` – **The Dynamic Tool Registry** (at project root, NOT `src/tools_registry/`). When adding new capabilities for the in-app AI or MCP server, register tools structurally here. Do **not** hardcode specific tool JSON descriptions directly in UI components.
  - `tools_registry/system_integration.js` – Core orchestrator: merges built-in, registry, MCP, and plugin tools; deduplicates by name; generates the system prompt.
  - `tools_registry/builtin_tools_integration.js` – **Authoritative mapping** of built-in tool names to their ChatManager methods and categories (`builtInToolsMap`).
  - `tools_registry/registry_manager.js` – Loads YAML tool definitions and generates tool lists based on query relevance.
  - `tools_registry/<category>/` – YAML schema files per category (navigation, sequence_editing, file_operations, etc.).
- `src/mcp-tools/` and `src/mcp-server.js` – Implementations of the Model Context Protocol (MCP) server.
- `src/renderer/modules/Agents/` – The internal Multi-Agent System logic.
- `src/renderer/modules/chat/services/` – Extracted service classes for tool execution (`ToolExecutionService.js`, `FileOperationService.js`, `BlastService.js`, etc.).
- `docs/` – Markdown documentation managed by MkDocs.

## 3. Core Architectural Patterns
### Dynamic Tool Registry Integration
Rather than statically defining tools inside `ChatManager.js`, CodeXomics uses a dynamic registry (`tools_registry/system_integration.js`). The system prompt is generated per-query by merging tools from 4 sources, deduplicating by tool name, and classifying each tool as "Directly Available (Built-in)" or "Extended".

**Tool Classification Architecture:**

The authoritative source for whether a tool is "Built-in" is the `builtInToolsMap` in `tools_registry/builtin_tools_integration.js`. This Map contains every tool that can execute locally in the browser via `ChatManager.executeLocalTool()` or `ToolExecutionService`. When the system prompt is generated:
1. Tools whose names exist in `builtInToolsMap` are **always** classified as "Directly Available (Built-in)", regardless of whether they came from keyword detection, the YAML registry, or the MCP server.
2. Tools not in `builtInToolsMap` are classified as "Extended" (e.g., third-party MCP tools, dynamic plugin tools).
3. Deduplication ensures each tool name appears only once in the system prompt, with built-in source taking priority over registry and MCP sources.

**Adding a New Tool requires ALL of these steps:**

1. **Create the YAML schema** in `tools_registry/<category>/<tool_name>.yaml` – Define name, description, parameters (JSON Schema format), keywords, sample_usages, and relationships.
2. **Add to `builtInToolsMap`** in `tools_registry/builtin_tools_integration.js` – Map the tool name to its ChatManager method name and category. This is what makes the tool show up as "Built-in" in the system prompt. Without this entry, the tool will be incorrectly classified as "Extended/External".
3. **Add keyword matching rules** in `analyzeBuiltInToolRelevance()` (same file) – Add regex patterns so the tool is detected when users mention relevant keywords. Without this, the tool won't be included in dynamic (per-query) prompts even though it exists in the registry.
4. **Wire the execution** in `ChatManager.executeLocalTool()` or the appropriate service class (`src/renderer/modules/chat/services/`) – Add the actual function call that performs the tool's operation.
5. **MCP Server parity** – If the tool should also be available to external MCP clients (e.g., Claude Desktop), add the corresponding tool definition in `src/mcp-tools/` and ensure it's registered in `src/mcp-server.js`.

**Critical Rules:**
- **Rule**: You must keep the built-in ChatBox tool capabilities (via `tools_registry/` descriptors) and the MCP Server schemas (via `src/mcp-tools/`) updated synchronously to ensure functional parity across both access methods.
- **Rule**: Never mark a tool as `is_external: true` in `analyzeBuiltInToolRelevance()` if the tool is actually a local built-in tool (exists in `ChatManager.executeLocalTool()`). All built-in tools should be detected as built-in directly.
- **Rule**: When a tool exists in both `builtInToolsMap` and the MCP server, it will be classified as Built-in with `alsoAvailableViaMCP: true`. The system prompt will note it as "(also available via MCP)".
- **Rule**: Built-in tool parameter descriptions are enriched from the YAML registry definitions. If the YAML file has detailed parameter schemas, those will be used in the system prompt instead of empty `{ properties: {} }`.

### LLM Configuration Manager
The LLM configuration UI (`#llmConfigModal`) is managed by `src/renderer/modules/LLMConfigManager.js`. It supports multiple provider tabs (Local LLM, OpenAI, Anthropic, Google, DeepSeek, SiliconFlow, OpenRouter) plus a "Model Selection" tab.

**Key architectural pattern — Custom Model Name:**
All provider tabs (including Local LLM) support a "Custom Model Name" option. The implementation follows this pattern:
1. **HTML**: Each provider's `<select id="{provider}Model">` includes `<option value="other">Other (specify below)</option>` as the last option, followed by a hidden `<div id="{provider}ModelOtherGroup">` containing `<input id="{provider}ModelOther">`.
2. **Event listener**: In `setupEventListeners()`, each `{provider}Model` select has a `change` listener that toggles `display` of `{provider}ModelOtherGroup` based on whether the value is `'other'`.
3. **Save logic**: In `saveProviderInfo()` and `saveConfiguration()`, when the model select value is `'other'`, the actual model name is read from `{provider}ModelOther` input instead.
4. **Load logic**: In `loadConfigurationToUI()`, the saved model name is checked against the dropdown options. If not found, `'other'` is selected and the custom name is populated into `{provider}ModelOther`, with the group shown.
5. **Test Connection**: In `testConnection()`, the same `'other'` → `{provider}ModelOther` resolution is applied before making API requests.
6. **Model Selection tab**: `updateModelTypeOptions()` appends a `Custom Model Name` option (value `'custom'`) to the dynamic model list for non-auto providers. `isKnownModel()` treats `'other'` and `'custom'` as known sentinel values.

**Critical Rules for LLM Config:**
- **Rule**: When adding a new provider tab, you MUST include the "Other (specify below)" option and `ModelOtherGroup`/`ModelOther` input, following the exact same pattern as existing providers.
- **Rule**: The Local LLM tab uses `id="localEndpoint"` for base URL, while cloud providers use `id="{provider}BaseUrl"`. Code that reads base URL must handle this difference.
- **Rule**: `testConnection()` does NOT work on the "Model Selection" tab (`activeTab === 'models'`). The method must guard against this case.
- **Rule**: Each `test*()` method must include `baseUrl` fallback defaults (e.g., `'https://api.openai.com/v1'` for OpenAI) to prevent `undefined` URL concatenation.
- **Rule**: The Anthropic `testAnthropic()` method requires the `anthropic-dangerous-direct-browser-access: 'true'` header for browser-based API calls.
- **Rule**: The Google test method uses the `v1beta` API path (matching `sendGoogleMessage`), not `v1`.
- **Rule**: `testLocal()` validates that the configured model exists on the local server by parsing the `/models` response; it throws a descriptive error if the model is not found.

### Internal Multi-Agent Routing
CodeXomics runs its own internal network of specialized agents (`NavigationAgent`, `DataAgent`, `CoordinatorAgent`, `AnalysisAgent`, `ExternalAgent`, `PluginAgent`, `DeepResearchAgent`).

**Tool Execution Flow (Priority Chain):**

When `ChatManager.executeToolByName()` is called, it delegates to `ToolExecutionService.execute()`, which follows this priority chain:

1. **PRIORITY 1**: Agent settings tools (`update_agent_setting`, `get_agent_settings`, `toggle_agent_mode`) → `AgentSettingsManager`
2. **PRIORITY 2**: Extracted service classes (`FileOperationService`, `AnnotationService`, `BlastService`, `ProteinService`, `GenomeAnalysisService`) — checks if the snake_case→camelCase method name exists on any service
3. **PRIORITY 3**: Multi-Agent routing (`MultiAgentSystem.executeTool()`) — only when `agentSystemEnabled` is true
4. **PRIORITY 4–8**: MCP tools → Plugin integrator → Action manager → MicrobeGenomicsFunctions → `ChatManager[camelCaseMethod]()` → `ChatManager.executeLocalTool()` fallback

**Multi-Agent Selection (`selectOptimalAgent`):**
- Iterates all registered agents, calling `agent.canExecute(functionName, parameters)`
- `canExecute()` in `AgentBase` checks `this.toolMapping` first, then `this.capabilities` array
- Agents with matching tools become candidates, scored by: historical performance + resource availability + context relevance + specialization bonus (+100 for specialized agents)
- When no agent declares `canExecute: true`, `selectOptimalAgent` returns `null`, and `executeTool` returns `{ success: false, result: null }`
- `ToolExecutionService` PRIORITY 3 then falls through (because `agentResult.success !== true`), allowing PRIORITY 7 (`this.chatManager[camelCaseMethod]()`) to handle it directly

**Critical Architecture — toolMapping vs. builtInToolsMap:**

These are **two separate registries** that must not be confused:

| Registry | Location | Purpose |
|----------|----------|---------|
| `builtInToolsMap` | `tools_registry/builtin_tools_integration.js` | Declares all tools that exist as ChatManager methods. Used for system prompt generation and tool classification. |
| `toolMapping` | Each Agent's `registerToolMapping()` | Declares which tools a specific agent can execute locally. Only tools in `toolMapping` pass the `canExecute()` check. |

A tool can exist in `builtInToolsMap` but not in any agent's `toolMapping` (e.g., `set_working_directory`, `toggle_settings_modal`, `list_available_tools`, `download_internet_file`). These "system/utility" tools are handled by the PRIORITY 7 fallback in `ToolExecutionService`, NOT by the multi-agent system.

**Infinite Recursion Trap:**

Never make `CoordinatorAgent.canExecute()` return `true` for all tools and delegate to `chatManager.executeToolByName()`. This creates a cycle:
```
ToolExecutionService P3 → MultiAgentSystem → CoordinatorAgent → chatManager.executeToolByName() → ToolExecutionService P3 → ...
```
The correct approach is to let `selectOptimalAgent` return `null` when no agent handles a tool, allowing the priority chain to fall through to PRIORITY 7 (direct `ChatManager` method call).

**Agent Delegation Pattern (`performExecution`):**

All 7 agents override `performExecution()` with the same pattern:
1. Try `chatManager.executeToolByName(functionName, parameters)` first
2. Fall back to `_performLocalExecution()` (the agent's own `toolMapping`)

This means when an agent IS selected (tool in its `toolMapping`), execution goes through ChatManager which re-enters `ToolExecutionService`. To avoid recursion, `ToolExecutionService` PRIORITY 3 must detect that the agent result is already resolved and not route again. The current implementation avoids this because the agent's `performExecution` calls `executeToolByName` which will NOT re-enter PRIORITY 3 when the tool is in the agent's `toolMapping` — it will be caught by PRIORITY 7 instead (since `agentSystemEnabled` check doesn't prevent re-entry, but the `success === true && result !== undefined` guard on the agent result prevents double-processing).

**Agent Specialization Map (`isSpecializedAgent`):**

The `MultiAgentSystem.isSpecializedAgent()` method defines which tools each agent specializes in. This map must be kept in sync with each agent's `registerToolMapping()`. Currently:
- `NavigationAgent`: navigate_to_position, search_features, zoom_in/out, pan_left/right, get_current_state, search_gene_by_name, switch_to_tab, open_new_tab, close_tab, toggle_track, get_track_status
- `AnalysisAgent`: get_sequence, translate_dna, reverse_complement, compute_gc, search_pattern, find_restriction_sites, virtual_digest, search_sequence_motif, analyze_region, design_primers, calculate_primer_properties
- `DataAgent`: get_gene_details, get_operons, export_data, load_genome_file, export_fasta_sequence, export_genbank_format, search_annotations, list_annotations, get_annotation
- `ExternalAgent`: blast_search, search_uniprot_database, advanced_uniprot_search, fetch_alphafold_structure, search_alphafold_structures, search_pdb_structures, fetch_protein_structure, analyze_interpro_domains
- `PluginAgent`: list_plugins, execute_plugin, install_plugin, uninstall_plugin
- `DeepResearchAgent`: deep_research, research_analysis, synthesize_information, generate_research_report
- `CoordinatorAgent`: coordinate_task, decompose_task, integrate_results, create_workflow, execute_workflow

**Critical Rules:**
- **Rule**: When adding functionality that requires AI to sequentially execute logic (like navigating AND analyzing), integrate it as a capability into the relevant Agent class rather than building brittle one-off callbacks in the UI layer.
- **Rule**: When adding a tool that should be routed through a specific agent, add it to BOTH the agent's `toolMapping` (in `registerToolMapping()`) AND the `isSpecializedAgent` map in `MultiAgentSystem`.
- **Rule**: System/utility tools (category `'system'` in `builtInToolsMap`) should NOT be added to any agent's `toolMapping`. They are handled by `ToolExecutionService` PRIORITY 7 fallback.
- **Rule**: Never make `CoordinatorAgent.canExecute()` accept all tools unconditionally — this causes infinite recursion with `ToolExecutionService` PRIORITY 3.
- **Rule**: `ChatManager.builtInTools` may be `undefined` at runtime. Never assume `this.chatManager.builtInTools.builtInToolsMap` exists. The `builtInToolsMap` lives on the `BuiltInToolsIntegration` class instance in `tools_registry/builtin_tools_integration.js`, not on `ChatManager`.

### MCP Agent Mode
CodeXomics MCP Server supports an "agent" capability that allows external MCP clients (e.g., Claude Desktop) to use the internal multi-agent system via a `codexomics_chat` tool.

**Architecture:**
- `src/mcp-tools/utility/AgentChatTools.js` — Defines the `codexomics_chat` tool with parameters: `prompt` (required), `activate_multi_agent` (optional, enables multi-agent mode), `context` (optional)
- `src/mcp-server.js` — Registers the tool and declares `agent` capability in `initialize` response with `modes: ['tools-only', 'single-agent', 'multi-agent']`
- `src/renderer/modules/InternalMCPServer.js` — `handleCodexomicsChat()` method receives WebSocket messages
- `src/renderer/renderer-modular.js` — Routes `mcp-tool-call` and `execute-tool-request` for `codexomics_chat` → `ChatManager.processAgentPrompt()`
- `ChatManager.processAgentPrompt()` — Handles single-agent/multi-agent mode switching, builds agent context, executes LLM loop with tool calls

**Key methods in ChatManager:**
- `processAgentPrompt(params)` — Entry point: toggles agent mode, builds context, calls `_executeAgentLoop()`
- `_buildAgentContext(params)` — Collects current genome position info (chromosome, start, end, visible tracks)
- `_executeAgentLoop(prompt, context)` — LLM call + tool execution loop (max 10 iterations)
- `_extractToolCallsFromResponse(response)` — Parses tool calls from LLM response (supports multiple formats)

### Styling & CSS
- **Rule**: Use Vanilla CSS. Do **not** use TailwindCSS, Bootstrap, or any atomic CSS frameworks unless explicitly asked by the user to introduce them. The project uses standard `.css` files located in `src/renderer/css/`. Respect the existing color variables and DOM structures.

### UI Style System (Multi-Preset Theming)
CodeXomics supports multiple UI style presets (AI Dynamic, Professional, Minimal, Pastel) that can be switched at runtime via `ThemeManager`. The system uses CSS custom properties (`:root` variables) as the primary theming mechanism, with `[data-ui-style="<preset>"]` attribute selectors for overriding hardcoded colors in `styles.css`.

**Key files involved:**
- `src/renderer/modules/ThemeManager.js` – Preset definitions (CSS variables for each style), apply/switch logic, dark mode overrides
- `src/renderer/css/base.css` – Default CSS custom property definitions (`:root`)
- `src/renderer/css/themes/<preset>.css` – Per-preset override rules using `[data-ui-style]` selectors
- `src/renderer/modules/GeneralSettingsManager.js` – UI for selecting style presets, `applyUIStyle()` method
- `src/renderer/index.html` – Style preset card UI and theme CSS `<link>` tags

**Adding a new UI Style preset requires ALL of these steps:**

1. **Define preset variables in `ThemeManager.js`** – Add a new entry to `this.stylePresets` with:
   - `name`, `description`, `icon` (Font Awesome class)
   - `variables` object: all CSS custom properties (`--primary-color`, `--primary-hover`, `--primary-rgb`, `--header-gradient`, `--btn-gradient`, `--chat-user-bg`, etc.) — copy the full variable set from an existing preset and change colors
   - `darkVariables` object: dark-mode overrides for backgrounds, text, borders, and header gradient

2. **Create `src/renderer/css/themes/<preset>.css`** – Use `[data-ui-style="<preset>"]` selectors to override hardcoded colors in `styles.css`, `chatbox-enhancements.css`, `chatbox-markdown.css`, `buttons.css`, etc. This file must include overrides for:
   - Header, welcome screen, version tag
   - Button gradients (`.btn-gradient`, `.btn-primary`)
   - Chatbox components (header, send button, user message, AI message, tabs)
   - All toolbar buttons (`#blastBtn`, `#newChatBtn`, `#sendChatBtn`, `#toggleChatBtn`, `#addFeaturesBtn`, etc.)
   - `.toggle-slider`, `.mac-toggle` (toggle switches)
   - `.add-features-dropdown` and its child elements
   - Checkbox overrides (`.track-checkbox`, `.feature-checkbox`, `.track-controls input[type='checkbox']`, etc.)
   - Modal headers, focus rings, notifications, benchmark UI
   - Markdown rendering (links, blockquotes, code blocks, copy button)
   - Dark mode checkbox overrides inside `@media (prefers-color-scheme: dark)`
   - `.style-preview-swatch.<preset>-swatch` for the settings UI color preview

3. **Add preset card in `src/renderer/index.html`** – Inside `#stylePresetCards`, add:
   ```html
   <div class="style-preset-card" data-style="<preset>">
       <div class="style-preview-swatch <preset>-swatch">
           <i class="fas fa-<icon>"></i>
       </div>
       <div class="style-preset-info">
           <div class="style-preset-name"><Name></div>
           <div class="style-preset-desc"><Description></div>
       </div>
   </div>
   ```

4. **Add CSS `<link>` in `src/renderer/index.html`** – Add `<link rel="stylesheet" href="css/themes/<preset>.css">` alongside the other theme CSS links (before `styles.css`).

5. **Update `ThemeManager.applyStyle()`** – Add the new style name to the `classList.remove()` call so the previous style class is properly cleaned up when switching.

**Critical pitfall – `applyAccentColor` override:** When `GeneralSettingsManager.saveAllSettings()` calls `applySettings()`, it executes `applyAccentColor()` which can override the preset's `--primary-color` with the saved `accentColor` value (defaulting to `#667eea`). The `applyAccentColor()` method includes a guard that skips the override when the current UI Style is not `'default'`. The `applySettings()` method also ensures `applyUIStyle()` runs **after** `applyAccentColor()` so the preset variables always win. When adding a new preset, **do not** remove these safeguards.

## 4. Coding Conventions
1. **Vanilla JavaScript**: The project defaults to vanilla JavaScript (ES6+). It does not use TypeScript or React. Utilize standard ES6 classes and modular imports. Use native DOM manipulation or D3.js for visual updates.
2. **Robust IPC and Error Handling**: When making IPC calls or network requests, always wrap in `try/catch`. Bubble errors up sequentially so the UI can provide user-facing error dialogs. Do not let promises fail silently.
3. **No Code Placeholders**: If the user asks for a feature or bug fix, provide fully working, drop-in replacement code. Do not leave `// TODO: implement logic here`.
4. **File Operations**: Always use `fs.promises` internally. Handle cross-platform paths carefully using Node's `path` module. 

## 5. Build and Execution Commands
When modifying logic and testing functionality, rely on these defined npm scripts:
- `npm start` - Starts the electron app in development mode.
- `npm run dev` - Starts the electron app with developer tools immediately active.
- `npm run mcp-server` - Starts the standalone CodeXomics MCP Server.
- `npm test` - Runs the existing testing suite.

## 6. Important Editing Reminders
- You MUST maintain strict adherence to semantic versioning patterns in `package.json` and `CHANGELOG.md` upon modification.
- Do not modify `package-lock.json` manually; run `npm install` if a dependency is added to `package.json`.
- When generating markdown artifacts or tables, maintain standard GitHub Flavored Markdown (GFM).
- If editing `mkdocs.yml`, ensure proper YAML indentation spaces are preserved.
