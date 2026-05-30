# CodeXomics Project Memory - v0.7beta

This document preserves project context, architectural decisions, implementation constraints, and discovered knowledge for agents working on CodeXomics.

## 1. Project Context

CodeXomics is an AI-powered bioinformatics desktop platform built with Electron, Node.js, vanilla JavaScript, vanilla CSS, D3, and specialized bioinformatics libraries. It combines genome visualization, AI-assisted tool execution, MCP integration, plugin infrastructure, and documentation through MkDocs.

Current version sources:

- `package.json`: `0.7.0-beta`
- `src/version.js`: major `0`, minor `7`, patch `0`, prerelease `beta`
- Display version: `v0.7beta`

Core entry points:

- Electron main process: `src/main.js`
- Extracted main-process modules: `src/main/`
- Preload/context bridge: `src/preload.js`
- Renderer bootstrap: `src/renderer/renderer-modular.js`
- Main UI: `src/renderer/index.html`
- MCP server: `src/mcp-server.js`
- Public documentation source: `docs/`
- GitHub Pages config: `mkdocs.yml`

## 2. Repository Structure

- `src/main.js` - Electron startup, BrowserWindow creation, and app lifecycle.
- `src/main/` - Extracted main-process modules:
  - `window-registry.js`
  - `menu-builder.js`
  - `window-management.js`
  - `mcp-lifecycle.js`
  - `ipc-handlers.js`
  - `project-ipc.js`
- `src/renderer/modules/` - Renderer application logic.
  - `ChatManager.js` - LLM orchestration and dynamic tool injection.
  - `MultiAgentSystem.js` - Agent selection, scoring, and routing.
  - `MemorySystem.js` - Multi-layer memory/caching.
  - `TrackRenderer.js`, `CanvasGenesRenderer.js`, `CanvasReadsRenderer.js`, `CanvasSequenceRenderer.js` - Genome rendering.
  - `TabManager.js`, `GenomeNavigationBar.js`, `NavigationManager.js` - navigation and tab state.
  - `ThemeManager.js`, `GeneralSettingsManager.js` - style presets and UI settings.
  - `PluginManagerV2.js`, `PluginMarketplace.js`, `PluginFunctionCallsIntegrator.js` - plugin lifecycle and AI-callable plugin functions.
  - `BenchmarkManager.js`, `BenchmarkUI.js`, `BenchmarkReportGenerator.js` - benchmark orchestration and reporting.
- `src/renderer/modules/chat/`
  - `constants/ToolNames.js` - central tool-name constants.
  - `constants/DefaultSettings.js` - default app/LLM settings.
  - `services/` - extracted services for tool execution, context, files, annotations, protein, BLAST, genome analysis, UI, tasks, and primer/digest/gel logic.
- `src/renderer/modules/core/` - VS Code-inspired extension infrastructure:
  - `ExtensionService.js`, `ExtensionHost.js`, `ExtensionContext.js`
  - `ContributionRegistry.js`, `CommandRegistry.js`
  - `ActivationEventsService.js`, `ExtensionManifest.js`
  - `ServiceContainer.js`, `Disposable.js`, `ErrorHandler.js`, `NotificationService.js`
- `src/renderer/modules/security/SanitizeService.js` - DOMPurify-backed HTML sanitization.
- `src/renderer/modules/tracks/` - extracted track-rendering helpers:
  - `GeneShapeCreators.js`
  - `CanvasRendererBase.js`
- `src/renderer/modules/export/GenBankExporter.js` - consolidated GenBank export.
- `src/mcp-tools/` - MCP tool definitions and routing modules.
- `tools_registry/` - dynamic YAML tool registry at repository root.
- `packages/marketplace-server/` - plugin marketplace package.
- `docs/` - MkDocs/GitHub Pages Markdown source.
- `test/` - Vitest unit and integration tests.

## 3. Dynamic Tool Registry

The registry is rooted at `tools_registry/`, not under `src/`.

Important files:

- `tools_registry/system_integration.js` - merges built-in, registry, MCP, and plugin tools; deduplicates; builds prompts.
- `tools_registry/builtin_tools_integration.js` - authoritative `builtInToolsMap` for local built-in tools.
- `tools_registry/registry_manager.js` - loads YAML schemas, scores relevance, and provides intent keyword matching.
- `tools_registry/tool_categories.yaml` - category metadata.

Current registry facts:

- 180 YAML tool schemas across 18 active categories.
- 143 built-in tools mapped by `BuiltInToolsIntegration`.
- Active YAML categories: `annotation`, `benchmark`, `coordination`, `data_management`, `database`, `external_apis`, `file_loading`, `file_operations`, `navigation`, `pathway`, `plugin_management`, `primer_design`, `protein`, `sequence`, `sequence_editing`, `system`, `task_management`, `utility`.
- Built-in categories in `builtInToolsMap`: `file_loading`, `navigation`, `sequence`, `system`, `task_management`, `database`, `protein`, `data_management`, `external_apis`, `utility`, `sequence_editing`, `file_operations`, `annotation`, `primer_design`, `benchmark`.

Tool classification rules:

1. If a tool name exists in `builtInToolsMap`, classify it as built-in.
2. Tools not in `builtInToolsMap` are extended/external unless another source promotes them.
3. Built-in source wins during deduplication.
4. Built-in parameter descriptions should be enriched from YAML definitions.

## 4. Tool Execution Pipeline

`ChatManager.executeToolByName()` delegates to `ToolExecutionService.execute()`.

Priority flow:

1. Agent settings tools.
2. Extracted chat service classes.
3. Multi-agent routing when enabled.
4. MCP tools.
5. Plugin integrator.
6. Action manager.
7. Microbe/genomics helper functions.
8. `ChatManager[camelCaseMethod]()` or `ChatManager.executeLocalTool()` fallback.

`LLMContextService.shouldAllowToolExecution()` filters tool calls before execution. Policies are hardcoded inline so behavior remains auditable.

Key policy memory:

- Unknown tools fall through to a same-parameters duplicate block.
- Re-runnable tools need explicit policy categories.
- Primer design and benchmark tools need explicit policies because users commonly re-run them.
- `wasToolExecutedSuccessfully()` searches conversation history for prior success markers, so stale system messages can affect policy decisions.

## 5. Multi-Agent System

Runtime agents:

- `CoordinatorAgent` - decomposition, workflow orchestration, integration.
- `AnalysisAgent` - sequence and region analysis.
- `DataAgent` - file/data retrieval and export workflows.
- `NavigationAgent` - browser state and genomic navigation.
- `ExternalAgent` - biological databases and external APIs.
- `PluginAgent` - plugin discovery and invocation.
- `DeepResearchAgent` - multi-source research synthesis.

Selection has two phases:

1. `AgentBase.canExecute()` filters candidate agents through `toolMapping` or capabilities.
2. `MultiAgentSystem.calculateAgentScore()` scores historical performance, resource availability, context relevance, and `isSpecializedAgent()` bonus.

Important distinction:

- Agent `toolMapping` determines eligibility.
- `MultiAgentSystem.isSpecializedAgent()` determines the +100 specialization bonus.
- Keep those mappings aligned when adding tools.

## 6. MCP Server

Entry point: `src/mcp-server.js`.

Tool modules:

- `navigation/NavigationTools.js`
- `sequence/SequenceTools.js`
- `protein/ProteinTools.js`
- `database/DatabaseTools.js`
- `data/DataTools.js`
- `pathway/PathwayTools.js`
- `action/ActionTools.js`
- `utility/UtilityTools.js`
- `file/FileTools.js`
- `track/TrackSettingsTools.js`
- `primer/PrimerTools.js`
- `annotation/AnnotationTools.js`
- `utility/AgentChatTools.js`

Modes:

- Tools mode exposes 95 tools.
- Agent mode exposes 3 tools: `codexomics_chat`, `list_genome_windows`, `switch_active_window`.
- Mode priority: CLI argument, `CODEXOMICS_MCP_MODE`, `authConfig.mode`, then default `tools`.
- Agent mode uses the same ChatBox `sendToLLM()` pipeline as in-app user input.
- Agent mode timeout is 120 seconds; tools mode timeout is 30 seconds.

Default transports:

- HTTP/SSE: `3002`
- WebSocket: `3003`

## 7. LLM Configuration

Manager: `src/renderer/modules/LLMConfigManager.js`.

Supported UI provider families include Local LLM, OpenAI, Anthropic, Google, DeepSeek, SiliconFlow, and OpenRouter.

Rules:

- Local base URL field is `localEndpoint`.
- Cloud provider base URLs are `{provider}BaseUrl`.
- Provider model dropdowns use an "Other (specify below)" option plus a hidden custom model input group.
- `testConnection()` must not run against the Model Selection tab.
- Anthropic browser tests require `anthropic-dangerous-direct-browser-access: 'true'`.
- Google tests use `v1beta`.

## 8. Visualization And Track State

Rendering stack:

- SVG track rendering through `TrackRenderer.js`.
- Canvas paths for dense gene, read, and sequence displays.
- Shared boilerplate in `CanvasRendererBase.js`.
- Gene shapes extracted to `GeneShapeCreators.js`.

Annotation track memory:

- Custom annotation tracks are stored in `genomeBrowser.annotationTracks`.
- Internal IDs look like `annotation_track_123`.
- Rendering and visibility use the prefixed ID `annotation_${at.id}`.
- `visibleTracks` must contain the full prefixed ID.
- DOM `data-track-type` must match the full prefixed ID to avoid losing custom tracks during order updates.
- `TabManager` must persist both annotation track data and `visibleTracks`.

Tab title/navigation memory:

- Position title mode: `Chromosome:start-end`.
- Gene title mode: `Gene: <name>`.
- `source === 'ruler'` switches to position mode.
- Zoom/drag/navigation should preserve gene mode unless intentionally switching.

## 9. Plugin And Extension System

CodeXomics uses a VS Code-inspired extension host and plugin lifecycle:

- `ExtensionService` handles activation.
- `ExtensionHost` and `ExtensionContext` provide execution context.
- `ContributionRegistry` and `CommandRegistry` manage contributions and commands.
- `PluginManagerV2` handles plugin lifecycle.
- `PluginFunctionCallsIntegrator` exposes plugin functions to AI tool calling.
- `PluginSecurityValidator`, `PluginDependencyResolver`, `PluginResourceManager`, and `PluginUpdateManager` support validation, dependencies, resources, and updates.
- `packages/marketplace-server/` serves marketplace data.

Plugin API version: `2.0.0`.

## 10. UI Theme System

Theme manager: `src/renderer/modules/ThemeManager.js`.

CSS source:

- `src/renderer/css/base.css`
- `src/renderer/css/components.css`
- Feature-specific CSS files in `src/renderer/css/`
- Theme preset files in `src/renderer/css/themes/`

Current preset CSS files:

- `professional.css`
- `minimal.css`
- `pastel.css`
- `elegant.css`
- `midnight.css`

The project uses vanilla CSS only.

## 11. Sequence Editing Vs. Task Checklist

Two similarly named systems must remain separate:

- Sequence editing actions mutate genome sequence state and are managed by `ActionManager`.
- Task checklist items track AI workflow progress and are managed by `TaskService`.

Sequence tools include `copy_sequence`, `cut_sequence`, `paste_sequence`, `delete_sequence`, `insert_sequence`, `replace_sequence`, `get_action_list`, `clear_actions`, and `execute_actions`.

Task tools include `add_task`, `update_task`, `list_tasks`, `clear_tasks`, and `delete_task`.

Never use `execute_actions` for checklist items.

## 12. Documentation System

GitHub Pages is built from `docs/` through MkDocs Material.

Important files:

- `mkdocs.yml` - site metadata, theme, plugins, validation, and nav.
- `docs/index.md` - public landing page.
- `docs/user-guides/` - user-facing usage docs.
- `docs/developer-guides/` - contributor and implementation docs.
- `docs/architecture/` - deep technical architecture.
- `docs/reference/` - focused reference guides.
- `docs/release-notes/` - release materials.
- Root `README.md` - repository landing page.
- Root `Agents.md` - AI coding-agent rules.
- Root `Memory.md` - this architectural memory.

Do not treat `site/` as source.

Deployment Note:

- While a `Deploy Documentation` GitHub Actions workflow exists for push events to `main`, repository environment protection rules for the `github-pages` environment prevent deployments from the `main` branch directly.
- The authoritative deployment mechanism is running `mkdocs gh-deploy` locally. This compiles the docs to the `site/` directory, commits it to the `gh-pages` branch, and pushes it to `origin/gh-pages`, updating the live site.

## 13. Historical Decisions

- Main process extraction reduced `src/main.js` into focused modules under `src/main/`.
- `ServiceContainer.js` introduced lazy singleton caching and cycle detection.
- `ErrorHandler.js` and `NotificationService.js` centralized error and notification handling.
- `SanitizeService.js` introduced DOMPurify-backed sanitization for safe innerHTML.
- `GeneShapeCreators.js` extracted static SVG gene-shape methods from `TrackRenderer.js`.
- `CanvasRendererBase.js` removed duplicated canvas renderer boilerplate.
- Dynamic Tool Registry replaced static prompt-wide tool definitions.
- Tool execution was extracted from `ChatManager` into focused services.
- Tool execution policies remain hardcoded for auditability.
- Delegated tool routing was unified on `executeToolByName()` and `ToolExecutionService.execute()`.
- Formatting updates across the codebase led to unit test failures in string-match assertions in `blast-tools-consistency.test.js`. The test was refactored to use robust regular expressions (`new RegExp(...)`) instead of rigid string containment checks (`toContain`), making tests resilient to line wrapping.

## 14. Common Commands

```bash
npm start
npm run dev
npm run mcp-server
npm run start-with-mcp
npm run marketplace:start
npm run start-full
npm test
npm run lint
npm run version-sync
npm run version-validate
npm run build
npm run build:mac
npm run build:win
npm run build:linux
```
