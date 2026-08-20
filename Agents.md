# CodeXomics AI Agent Rules - v0.722.0

This file is the operational contract for AI coding assistants working in the CodeXomics repository. For architectural background and project memory, read `Memory.md`.

## 1. Documentation And GitHub Pages

- The public documentation source is `docs/`; the site is configured by `mkdocs.yml`.
- Do not edit generated `site/` output directly. Change Markdown under `docs/` and rebuild from source.
- Root-level `README.md`, `Agents.md`, and `Memory.md` are canonical repository documents. If public Pages content repeats their guidance, keep the public page shorter and link back to the canonical root file.
- Keep MkDocs navigation paths relative to `docs/`. Root files such as `Agents.md` and `Memory.md` are not valid nav targets unless mirrored under `docs/`.
- Preserve YAML indentation in `mkdocs.yml`.
- Markdown artifacts should use standard GitHub Flavored Markdown unless a MkDocs Material extension is intentionally used.
- Run `npm run docs:validate` after changing canonical docs, public docs, version metadata, MkDocs configuration, or the Pages workflow.
- The live site is generated from the same `docs/` source. Never patch the `gh-pages` branch or generated `site/` files by hand; use `npm run docs:deploy` when an online publication is requested.

Versioned documentation must agree on all of the following:

- Semantic application version: `0.722.0` in `package.json`, `src/version.js`, `CHANGELOG.md`, and current release notes.
- Display version: `v0.722` where the compact in-app label is being described.
- Documentation release label: `v0.722.0` in `mkdocs.yml` and the public documentation release selector.
- Runtime baseline: Node.js 20 or 22, npm 10+, and Electron `41.7.1`.

## 2. Adding Or Changing Tools

When adding a new AI-callable tool, update every relevant registry. Missing one of these is the most common cause of invisible tools, incorrect "External" classification, or `Policy blocked` behavior.

1. Create the YAML schema in `tools_registry/<category>/<tool_name>.yaml`.
2. Add the tool to `builtInToolsMap` in `tools_registry/builtin_tools_integration.js` when it is a local built-in ChatBox tool.
3. Add keyword matching in `analyzeBuiltInToolRelevance()` in `tools_registry/builtin_tools_integration.js`.
4. Wire execution through `ChatManager.executeLocalTool()` or the appropriate service under `src/renderer/modules/chat/services/`.
5. Add the name constant to `src/renderer/modules/chat/constants/ToolNames.js`.
6. Add the tool to `src/renderer/modules/FunctionCallsOrganizer.js`.
7. Add intent keywords in `tools_registry/registry_manager.js`.
8. Add or update the category in `tools_registry/tool_categories.yaml`.
9. If external MCP clients should see it, add the MCP definition under `src/mcp-tools/` and make sure `ToolsIntegrator` exposes/routes it.
10. Add an explicit policy in `LLMContextService.shouldAllowToolExecution()` so repeated legitimate calls are not blocked by the default "allow once per same parameters" rule.

Current local facts to keep in mind:

- `tools_registry/` currently contains 216 YAML tools across 18 active categories.
- `builtInToolsMap` currently maps 178 built-in tools.
- MCP tools mode currently exposes 96 tools.
- MCP agent mode exposes only `codexomics_chat`, `list_genome_windows`, and `switch_active_window`.

## 3. Keyword Regex Rules

- Use lazy gaps between verbs and nouns, for example `\b(open|create)\s+.*?\b(tabs?)\b`.
- Support plural forms, for example `(tabs?|windows?)`.
- Support common prepositions and natural phrasing, for example `\b(switch|go\s+to)\s+.*?\b(tabs?)\b`.
- Avoid strict adjacency patterns such as `\b(search)\s+(gene)\b`; they fail on natural phrasing like "search for the gene".

## 4. Dynamic Tool Registry Rules

- Keep ChatBox built-in descriptors in `tools_registry/` and MCP schemas in `src/mcp-tools/` synchronized when a capability is shared.
- Never mark a local built-in tool as `is_external: true`.
- A tool present in both `builtInToolsMap` and the MCP server should be classified as built-in with MCP availability metadata.
- Built-in parameter descriptions should come from YAML registry definitions where available.
- Every built-in tool that should appear in dynamic prompts needs a keyword detection rule.

## 4a. Agent Skill Rules

Skills are multi-step workflow documents, not tools. See `docs/developer-guides/AGENT_SKILLS.md`.

- Built-in skills live in `.agent/skills/`; user skills live in `skills/` under `userData`. Both roots
  are inventoried by `SkillRegistryService` in the main process.
- Two formats are supported: Anthropic bundles (`<dir>/SKILL.md` with `name`/`description`) and the
  CodeXomics native format (`<skill_id>.md` plus `SKILL_REGISTRY.yaml` metadata).
- In native frontmatter, `steps`, `parallel_groups`, and `outputs` are top-level keys. A
  `parallel_groups:` mapping nested inside the `steps:` sequence is invalid YAML and the skill is
  skipped.
- Snapshots carry metadata only. Never add skill bodies to the snapshot; `get_skill` loads them on
  demand so unused skills cost only their index line in the prompt.
- The renderer must not read skill directories directly. Go through the `skill-registry:*` IPC channels,
  the same boundary the tool registry uses.
- A user skill may not reuse a built-in skill id; the loader emits an error diagnostic and keeps the
  built-in.
- Enable/disable state lives in `skills.disabledIds` via `ConfigManager` and is enforced by
  `SkillService`, not by the main-process registry.
- `.agent/skills/**/*` must stay in the electron-builder `files` list, or built-in skills will not ship.
- Skills must stay out of benchmark runs. `getSkillsContextString()` returns `''` when
  `ChatManager.isBenchmarkMode()` is true, so benchmark prompts and the oracle baseline are unaffected
  by installed skills. Do not add benchmark cases for `list_skills` / `get_skill`; they are listed in
  `BUILTIN_TOOL_EXEMPTIONS` instead.

## 5. Tool Execution Policy Rules

- Policies are hardcoded inside `LLMContextService.shouldAllowToolExecution()`. Do not introduce YAML/JSON policy config or UI toggles unless explicitly requested.
- Add new tools to an explicit policy category. Unknown tools fall through to the default same-parameters block.
- Primer tools (`design_primers`, `calculate_primer_properties`, `find_primer_binding_sites`, `save_primer`, `list_primers`, `delete_primers`) belong in a `primer_design` policy category with parameter-sensitive behavior. The old `*_primer_annotation` names remain as back-compat aliases via `ToolExecutionService.legacyAliases`.
- Benchmark tools belong in a system/utility policy path and should not be routed through agents.
- Offline CLI benchmarks run `oracle-assisted` by default and `production-parity` with
  `--production-parity`. Only production-parity numbers are comparable to in-app behaviour;
  every report records which mode produced it in `harness_mode`. Never pool the two.
- When debugging `Policy blocked: <tool_name>`, check whether the tool has an explicit policy, whether identical parameters already succeeded, and whether stale system messages are being matched by `wasToolExecutedSuccessfully()`.

## 5a. Tool Result Protocol Rules

- The round loop keeps one canonical transcript in the OpenAI shape: assistant turns carry
  `tool_calls`, results come back as `role: 'tool'` messages bound to a `tool_call_id`.
  Provider adapters translate at the boundary (`toAnthropicMessages()`, `toGoogleContents()`);
  do not add provider-specific message shapes to `ChatManager`.
- `appendToolRoundToHistory()` is the only place a completed tool round is written into the
  transcript. It replays natively when every call in the round carries a `tool_call_id` and
  every id came back with a result; otherwise the whole round falls back to the prose
  `[Tool Result]` envelope. A partially native round is a protocol violation — never emit one.
- Policy and duplicate-suppression checks must read the structured records attached by
  `attachToolExecutionRecords()` (`getMessageToolExecutions()`), not the prose phrase
  `"<tool> executed successfully"`. The native transcript does not contain that phrase, and
  external tool output can contain it.
- Anthropic requires every `tool_result` block for a turn in one user message; Gemini wants the
  matching `functionResponse` parts grouped the same way. Both translators already do this.

## 5b. Cancellation And Timeout Rules

- Every provider request goes through `LLMConfigManager.fetchWithGuards()`, which applies both
  the caller's abort signal and `llm.requestTimeoutMs` (default 180000). Never call `fetch()`
  directly from a `send*MessageWithHistory()` path.
- A timeout surfaces as `name: 'TimeoutError'` / `isTimeout: true`, never as an abort, and
  `makeRequestWithRetry()` retries neither.
- Abort state is sticky: `abortCurrentConversation()` sets `conversationState.aborted` before
  tearing the state down, and the loop checks `throwIfConversationAborted()`. Do not
  re-create an AbortController mid-request; a missing controller means the turn was cancelled.
- `sendToLLM()` rethrows `AbortError`. `sendMessage()`, `sendMessageProgrammatically()` and
  `processAgentPrompt()` each render their own cancellation message from it.

## 5c. Context Budget Rules

- `enforceConversationTokenBudget()` runs immediately before every provider call and is the only
  thing bounding transcript growth across a turn; `sanitizeResultForLLM()` bounds a single result,
  not their sum. Budget comes from `llm.maxContextTokens` (default 120000; `0` disables, a garbage
  value falls back to the default, anything positive is floored at 4000).
- Trimming happens in two phases: compact old tool result bodies first (structure preserved), then
  drop whole exchanges. Never split an assistant `tool_calls` entry from its `tool` messages —
  `buildTranscriptGroups()` defines the spans that must move together.
- The system message, the user message that started the turn, and the most recent exchange are
  never trimmed. When nothing else is trimmable the function returns `null` and logs, rather than
  reporting a no-op trim.

## 5d. Mid-Turn Tool Retrieval Rules

- Tool selection runs once per turn, before round 1. `expandAdvertisedToolsForRejectedCalls()` is
  the only sanctioned way to widen it afterwards, and it fires only when a call was rejected with
  `UNADVERTISED_TOOL_REASON` — that constant is shared by the producer (`analyzeLLMResponse`) and
  the consumer; do not restate the string.
- Expansion appends to `currentNativeTools` and `lastSystemPromptMetadata.selectedTools`; it never
  reorders or removes. The advertised list is part of the request prefix, so growing it costs
  provider prompt caching — that is why it is on demand rather than per round.
- A turn may expand at most `MAX_TOOL_EXPANSIONS_PER_TURN` (3) times. A rejected name that the
  registry does not know is left alone, so the existing unavailable-tool handling still applies.

## 5e. Provider Request Rules

- Every OpenAI-compatible provider shares one request path,
  `sendOpenAICompatibleMessageWithHistory()`. Register a new one in
  `OPENAI_COMPATIBLE_PROVIDERS`; entries carry only genuine deviations
  (`payloadExtra`, `normalize`, `fallbackModelStatuses`). Do not copy the request
  path per provider — that is how the earlier copies drifted into dropping error
  bodies and skipping retry.
- `sendMessageWithProvider()` dispatches through the per-provider
  `historyMethod`, which stays the override seam. The named methods themselves
  should remain one-line delegations.
- Every provider — Anthropic and Gemini included — throws through
  `createProviderHttpError()` so the provider's own body survives, and retries
  through `makeRequestWithRetry()`.
- The Gemini key travels in the `x-goog-api-key` header, never the query string.
- `chatboxLLMTemperature` defaults to 0.3 because nearly every request carries
  native tool schemas and is judged on schema-exact arguments. Keep the two
  defaults in `ChatBoxSettingsManager` and `DEFAULT_LLM_TEMPERATURE` in sync.
- MCP system prompts are fetched through `getCachedMcpPrompt()`. Anything that
  changes a server's prompt content must call `invalidateMcpPromptCache()`.

## 5f. Transcript Service Rules

- Everything about the transcript the model sees lives in
  `ConversationTranscriptService`: tool-round replay, the structured execution
  ledger, and the context budget. ChatManager keeps one-line delegations; add new
  transcript logic to the service, not back into ChatManager.
- Reach it through `ChatManager.getTranscriptService()`, which constructs the
  service lazily so a ChatManager built without the full registry (tests,
  benchmark harnesses) still works.
- The service must stay in the `index.html` script list ahead of
  `modules/ChatManager.js`, and registered in `initializeServices()`.

## 5g. Annotation Research Binding Rules

A Deep Gene Research proposal is a structured, citation-verified artifact. It must never make
the trip through a model's prose — a paraphrase loses the target binding, invents qualifier
names, and drops the fields the verification chain keys on.

- When `create_annotation_changeset` receives a `researchRun` that names a stored task, the
  archived proposal is authoritative. A caller may still pass `annotationProposal`, but only
  byte for byte; anything else is rejected, never silently downgraded. Operations are derived
  from the resolved proposal, not from the request.
- `_requireArchivedDgrReport()` keys on the research run, not on the proposal's shape. Naming a
  real task demands the archived report, citation validation, current-annotation binding, and a
  matching `proposalSha256`. Gating on `proposal.researchSummary.schema` alone meant dropping one
  field turned the whole chain off in silence. Synthetic run ids that name no task
  (`rollback:<id>`) stay exempt.
- `getStoredResearchProposal()` reads the runs sidecar without taking the runs lock, on purpose:
  the caller already holds the ledger lock, and the workflow materialization path takes them in
  the opposite order. Do not "fix" it by adding the lock.
- `EC_number` is the one writable qualifier that is not lower-case; it keeps the GenBank spelling.
  The free-form `updates` map resolves field names case-insensitively via
  `_normaliseUpdateField()`; an explicit `operations` list names its qualifier deliberately and
  stays strict. Rejections name the writable vocabulary and the near-miss field.
- `updates` always produces `addQualifier`, which merges rather than overwrites. A replacement
  needs an explicit `replaceQualifier` operation, and replacing a non-placeholder product sets
  `requiresHumanReview`.

## 6. Multi-Agent Routing Rules

- Sequential AI behavior belongs in an agent capability, not brittle UI callbacks.
- When a tool should route to a specialized agent, update both that agent's `toolMapping` or capabilities and `MultiAgentSystem.isSpecializedAgent()`.
- System, utility, and benchmark tools should not be added to agent `toolMapping`; they are handled by `ToolExecutionService` fallback paths.
- Never make `CoordinatorAgent.canExecute()` accept all tools unconditionally; that can recurse through `ToolExecutionService`.
- `ChatManager.builtInTools` may be undefined at runtime. The authoritative map lives on `BuiltInToolsIntegration`, not on `ChatManager`.

## 7. MCP Server Rules

- Agent mode tool lists must remain limited to `codexomics_chat`, `list_genome_windows`, and `switch_active_window`.
- `_executeViaAgent()` should translate structured calls into natural-language prompts via `_buildAgentPromptFromToolCall()`.
- `processAgentPrompt` must use `sendToLLM()` and the same ChatBox pipeline as normal user input.
- `processAgentPrompt` must check `llmConfigManager.isConfigured()`.
- `onProgress` callbacks must never throw; wrap callback delivery in `try/catch`.
- Agent mode timeout is 120 seconds; tools mode timeout is 30 seconds.
- `setMode()` must call `sendToolListChanged()` so clients refresh the exposed tool list.
- When `conversationState.isProcessing` is true, agent prompt execution should return a busy error rather than starting a second ChatBox run.
- Client-delegated MCP calls should use `chatManager.executeToolByName()`. Legacy category switch routing is obsolete.

## 8. LLM Configuration Rules

- The modal is titled "Configure LLM Providers". It has no Model Selection tab: the
  global default lives in the "Default Model" block above the provider tabs and
  writes `modelTypes.main` via the `mainProvider` / `mainModel` / `mainCustomModel`
  element ids. Specialized model types (voice/image/multimodal) have no UI and no
  readers — do not reintroduce them without a consuming feature.
- New provider tabs must include the "Other (specify below)" option and matching `ModelOtherGroup` / `ModelOther` fields.
- The Local LLM tab uses `id="localEndpoint"` for base URL; cloud providers use `id="{provider}BaseUrl"`.
- Every tab is a provider tab, so `testConnection()` reads the active tab directly; it no longer guards against a `'models'` tab.
- Each provider-specific test method needs a base URL fallback.
- Anthropic browser requests require the `anthropic-dangerous-direct-browser-access: 'true'` header.
- Google tests use the `v1beta` API path to match `sendGoogleMessage`.
- `testLocal()` validates the configured model against the local `/models` response.

Model list auto-refresh (`LLMConfigManager`):

- A new provider tab needs a `refresh{Provider}ModelsBtn` button and a `{provider}ModelsStatus` element beside its model select; button ids follow the same capitalization as `save{Provider}ProviderBtn`.
- Add the listing endpoint to `buildModelListRequest()`. It returns `null` when credentials are missing, which is how auto-refresh skips unconfigured providers; only `local` may list models without an API key.
- Parse new response shapes in `extractModelIds()`. Anthropic and OpenAI-compatible providers use `{ data: [{ id }] }`; Google uses `{ models: [{ name: 'models/...' }] }`.
- A 404/405 from a listing endpoint means "provider has no model list", not a failure: `fetchProviderModels()` raises `MODEL_LIST_UNSUPPORTED` and the built-in list is kept.
- `populateProviderModelSelect()` is the only writer of the provider model selects. It rebuilds from the markup snapshot in `staticModelOptionsHtml`, so shipped `<option>` labels and the `other` entry must stay in `index.html`.
- Refreshed lists are cached in `provider.remoteModels` with `modelsSource: 'remote'`. `reconcileBuiltInModelLists()` discards any persisted list that did not come from a provider API, so shipped model updates are never shadowed by an old config file.
- Auto-refresh triggers are passive only: opening the modal, switching tabs, and saving changed credentials. Do not add refresh calls on app start or to the message-sending path.

## 9. UI, Styling, And Theme Rules

- Use vanilla CSS in `src/renderer/css/`. Do not add TailwindCSS, Bootstrap, or atomic CSS frameworks unless explicitly requested.
- Respect existing CSS variables, DOM structures, and theme files.
- UI style presets are managed by `ThemeManager.js`, `src/renderer/index.html`, and `src/renderer/css/themes/<preset>.css`.
- Current preset CSS files include `professional.css`, `minimal.css`, `pastel.css`, `elegant.css`, and `midnight.css`.
- When adding a preset, define variables in `ThemeManager.js`, create the theme CSS, add the preset card and stylesheet link in `index.html`, and update `ThemeManager.applyStyle()`.
- Keep `GeneralSettingsManager.applySettings()` ordering and accent-color safeguards intact so non-default presets win over accent color overrides.

## 10. Navigation And Tab Rules

- Any navigation, zoom, or drag code that updates tab titles must call `updateCurrentTabPosition()` with an options object.
- Never call `updateCurrentTabPosition()` without `{ source: '...' }`.
- Only `GenomeNavigationBar.js` ruler interactions should use `{ source: 'ruler' }`.
- Position-focused navigation can use `'ruler'`; exploration-focused zoom, drag, and navigation should preserve the current mode.

## 11. Sequence Editing Vs. Task Checklist Rules

- Sequence editing actions are genome mutation operations managed by `ActionManager` and executed through `execute_actions`.
- Task checklist items are AI progress-tracking items managed by `TaskService`.
- Do not call `execute_actions` to run checklist items.
- Do not call task-management tools to mutate sequence data.

## 12. Coding Conventions

- Use vanilla JavaScript ES6+ classes/modules. The app is not TypeScript or React.
- Use robust `try/catch` around IPC, file operations, and network requests. Bubble errors sequentially.
- Do not leave placeholder logic or TODO stubs in delivered code.
- Internal file operations should use `fs.promises` and Node's `path` module for cross-platform paths.
- Use camelCase for variables and functions.
- Keep changes scoped; do not refactor unrelated systems during a targeted fix.
- Do not revert unrelated user changes in the working tree.

## 13. Editing And Release Reminders

- Commit completed changes with a concise conventional commit message.
- Maintain semantic version consistency in `package.json`, `src/version.js`, `CHANGELOG.md`, and release notes when doing release/version work.
- Update the current version references in `README.md`, `Agents.md`, `Memory.md`, `docs/index.md`, `docs/user-guides/GETTING_STARTED.md`, and `mkdocs.yml` when cutting a release.
- Do not manually edit `package-lock.json`; run `npm install` if dependencies change.
- If editing build or Pages config, validate with the relevant command before committing when tooling is available.
