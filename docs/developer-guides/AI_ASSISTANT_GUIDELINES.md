# AI Assistant Guidelines

This page summarizes the repository rules that matter most to AI coding assistants and contributors. The canonical, stricter contract is the root-level [`Agents.md`](https://github.com/Scilence2022/CodeXomics/blob/main/Agents.md); architectural background lives in [`Memory.md`](https://github.com/Scilence2022/CodeXomics/blob/main/Memory.md).

## Documentation Rules

- The GitHub Pages source is `docs/`; `mkdocs.yml` controls the site.
- Do not edit generated `site/` output directly.
- Keep MkDocs nav paths relative to `docs/`.
- Keep root `README.md`, `Agents.md`, and `Memory.md` synchronized with public docs when behavior changes.

## Tool Changes

When adding or changing an AI-callable tool, update all relevant surfaces:

1. YAML schema in `tools_registry/<category>/<tool_name>.yaml`.
2. `builtInToolsMap` in `tools_registry/builtin_tools_integration.js` for local built-ins.
3. Keyword relevance rules in `analyzeBuiltInToolRelevance()`.
4. Execution wiring in `ChatManager` or a service under `src/renderer/modules/chat/services/`.
5. `src/renderer/modules/chat/constants/ToolNames.js`.
6. `src/renderer/modules/FunctionCallsOrganizer.js`.
7. Intent keywords in `tools_registry/registry_manager.js`.
8. Category metadata in `tools_registry/tool_categories.yaml`.
9. MCP definition/routing under `src/mcp-tools/` when external clients should see it.
10. Explicit execution policy in `LLMContextService.shouldAllowToolExecution()`.

## Current Tool Facts

| Surface                    | Count |
| -------------------------- | ----: |
| YAML registry schemas      |   180 |
| Active registry categories |    18 |
| Built-in ChatBox tools     |   143 |
| MCP tools mode             |    95 |
| MCP agent mode             |     3 |

MCP agent mode intentionally exposes only `codexomics_chat`, `list_genome_windows`, and `switch_active_window`.

## Coding Rules

- Use vanilla JavaScript and vanilla CSS.
- Do not introduce TypeScript, React, TailwindCSS, Bootstrap, or atomic CSS frameworks unless explicitly requested.
- Use robust IPC, file, and network error handling.
- Keep changes scoped and do not revert unrelated user work.
- Do not leave placeholders or TODO-only implementations.

## Routing Rules

- Specialized agent tools need both agent-side capability mapping and `MultiAgentSystem.isSpecializedAgent()` alignment.
- System, utility, and benchmark tools should not be added to agent mappings.
- Client-delegated MCP calls should use `chatManager.executeToolByName()`.

## Policy Rules

Tool execution policies are intentionally hardcoded in `LLMContextService.shouldAllowToolExecution()` for auditability. New tools should be placed in an explicit policy category; otherwise, they fall back to a same-parameters duplicate block.
