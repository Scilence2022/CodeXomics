# CodeXomics Developer Guide

This guide summarizes the current CodeXomics development workflow and architecture. For agent-specific rules, read [AI Assistant Guidelines](AI_ASSISTANT_GUIDELINES.md) and the canonical root [`Agents.md`](https://github.com/Scilence2022/CodeXomics/blob/main/Agents.md).

## Prerequisites

- Node.js 20 or 22.
- npm 10 or newer.
- Git.
- Platform build tools required by Electron Builder for your operating system.

CodeXomics `0.722.0` uses Electron `41.7.1` for compatibility with the supported Node.js CI matrix.

## Setup

```bash
git clone https://github.com/Scilence2022/CodeXomics.git
cd CodeXomics
npm install
npm start
```

Development mode:

```bash
npm run dev
```

## Commands

| Command                     | Purpose                                       |
| --------------------------- | --------------------------------------------- |
| `npm start`                 | Launch the Electron app                       |
| `npm run dev`               | Launch with developer tools                   |
| `npm run mcp-server`        | Start the standalone MCP server               |
| `npm run start-with-mcp`    | Start Electron and MCP together               |
| `npm run marketplace:start` | Start the plugin marketplace server           |
| `npm run start-full`        | Start Electron, MCP, and marketplace together |
| `npm test`                  | Run Vitest tests                              |
| `npm run lint`              | Run ESLint                                    |
| `npm run version-sync`      | Synchronize version fields                    |
| `npm run version-validate`  | Validate version consistency                  |
| `npm run docs:serve`        | Preview the MkDocs site locally               |
| `npm run docs:validate`     | Validate docs and build the site strictly     |
| `npm run docs:deploy`       | Publish documentation to `gh-pages`           |
| `npm run build`             | Build the current platform                    |
| `npm run build:mac`         | Build macOS packages                          |
| `npm run build:win`         | Build Windows packages                        |
| `npm run build:linux`       | Build Linux packages                          |

## Source Tree

```text
CodeXomics/
├── src/
│   ├── main.js
│   ├── main/
│   ├── preload.js
│   ├── version.js
│   ├── mcp-server.js
│   ├── mcp-tools/
│   ├── bioinformatics-tools/
│   └── renderer/
│       ├── index.html
│       ├── renderer-modular.js
│       ├── css/
│       └── modules/
├── tools_registry/
├── packages/marketplace-server/
├── docs/
├── test/
├── scripts/
├── Agents.md
├── Memory.md
└── mkdocs.yml
```

## Architecture

### Electron Boundary

- `src/main.js` owns app lifecycle and BrowserWindow creation.
- `src/main/` contains extracted main-process modules for windows, menus, MCP lifecycle, IPC, and project IPC.
- `src/preload.js` exposes safe APIs across the context bridge.
- Renderer code should not reach directly into Node APIs when a preload or IPC path exists.

### Renderer Modules

Most app behavior lives in `src/renderer/modules/`.

High-impact modules:

- `ChatManager.js` - LLM orchestration and dynamic tool prompt assembly.
- `MultiAgentSystem.js` - agent scoring and routing.
- `FileManager.js`, `MultiFileManager.js`, `ProjectManager.js` - file and project workflows.
- `TrackRenderer.js` plus Canvas renderers - genome visualization.
- `PluginManagerV2.js`, `PluginMarketplace.js`, `PluginFunctionCallsIntegrator.js` - plugin lifecycle and AI-callable plugins.
- `LLMConfigManager.js`, `MultiAgentSettingsManager.js` - provider and agent settings.
- `BenchmarkManager.js`, `BenchmarkUI.js`, `benchmark-suites/` - benchmark execution and reporting.

### Chat Services

Tool execution is split into focused services under `src/renderer/modules/chat/services/`:

- `ToolExecutionService.js`
- `LLMContextService.js`
- `IntentParserService.js`
- `TaskService.js`
- `FileOperationService.js`
- `AnnotationService.js`
- `ProteinService.js`
- `BlastService.js`
- `GenomeAnalysisService.js`
- `PrimerService.js`
- `RestrictionDigestService.js`
- `GelElectrophoresisService.js`
- `UIService.js`

Use existing services before adding new ChatManager logic.

### Dynamic Tool Registry

The registry is rooted at `tools_registry/`.

Important files:

- `registry_manager.js` loads and scores YAML tools.
- `system_integration.js` merges built-in, registry, MCP, and plugin tools.
- `builtin_tools_integration.js` maps local built-ins to ChatManager/service methods.
- `tool_categories.yaml` describes categories.

Current registry snapshot:

- 185 YAML tool schemas.
- 19 active YAML categories.
- 149 built-in ChatBox tools.
- 95 MCP tools in tools mode.

### MCP Server

Entry point: `src/mcp-server.js`.

Tool modules live under `src/mcp-tools/`:

- navigation
- sequence
- protein
- database
- data
- pathway
- action
- utility
- file
- track
- primer
- annotation

Tools mode exposes the full MCP list. Agent mode exposes only `codexomics_chat`, `list_genome_windows`, and `switch_active_window`.

### Plugin System

The plugin architecture is centered on:

- `src/renderer/modules/core/ExtensionService.js`
- `src/renderer/modules/core/ExtensionHost.js`
- `src/renderer/modules/core/ContributionRegistry.js`
- `src/renderer/modules/core/CommandRegistry.js`
- `src/renderer/modules/PluginManagerV2.js`
- `src/renderer/modules/PluginSecurityValidator.js`
- `packages/marketplace-server/`

Plugin API version is `2.0.0`.

## Adding A Tool

Use the complete checklist in root `Agents.md`. The short version:

1. Add a YAML schema in `tools_registry/<category>/`.
2. Add the built-in mapping if the app can execute it locally.
3. Add keyword relevance and intent matching.
4. Wire execution through an existing service or ChatManager fallback.
5. Add `ToolNames.js` constants.
6. Add FunctionCallsOrganizer categorization.
7. Add MCP parity if external clients need it.
8. Add an explicit policy in `LLMContextService.shouldAllowToolExecution()`.
9. Add focused tests for registry, routing, and execution behavior.

## Styling

CodeXomics uses vanilla CSS.

- Shared CSS lives in `src/renderer/css/`.
- Theme preset overrides live in `src/renderer/css/themes/`.
- Current preset CSS files: `professional.css`, `minimal.css`, `pastel.css`, `elegant.css`, `midnight.css`.
- Do not add TailwindCSS, Bootstrap, or atomic CSS frameworks unless explicitly requested.

## Testing

Vitest is configured by `vitest.config.mjs`.

Test folders:

- `test/unit/`
- `test/integration/`
- `test/mocks/`

Common focused checks:

```bash
npm test
npm run lint
npm run version-validate
```

## Documentation

MkDocs source lives in `docs/` and is configured by `mkdocs.yml`.

Do:

- Update `docs/index.md` for public landing-page changes.
- Add user content under `docs/user-guides/`.
- Add implementation content under `docs/developer-guides/`.
- Add deep architecture content under `docs/architecture/`.
- Keep root `README.md`, `Agents.md`, and `Memory.md` accurate.
- Keep semantic version, compact display version, and MkDocs release label distinct and synchronized.

Do not:

- Edit generated `site/` output directly.
- Point MkDocs nav at root-level files outside `docs/`.
- Hand-edit generated content on the `gh-pages` branch.

Run this before committing documentation or release metadata changes:

```bash
npm run docs:validate
```

## Contribution Notes

- Keep changes scoped.
- Preserve user changes in the working tree.
- Use conventional commit messages.
- For docs-only changes, use `docs(scope): summary`.
- Run the most relevant checks before committing.
