# CodeXomics Project Memory — v0.7beta

This document preserves project background, architectural context, historical decisions, and discovered knowledge. It is the reference context for AI agents working on this codebase.

## 1. Project Context

**CodeXomics** is an AI-powered bioinformatics analysis platform built as a desktop application using **Electron**. It provides genome visualization, plugin extensions, and an integrated multi-agent AI system for executing biological analysis tools.

- **Stack**: Node.js, Electron, Vanilla JS (ES6+), HTML5, Vanilla CSS, and various specialized bioinformatics libraries (e.g., D3.js).
- **Package Manager**: npm (Workspace structure enabled in `packages/`).
- **Main Process**: `src/main.js`
- **Renderer Process**: `src/renderer/`

## 2. Directory Structure

- `src/main.js` – Electron main process entry point.
- `src/renderer/modules/` – Core application logic organized as ES6 classes and modules.
  - `ChatManager.js`, `MultiAgentSystem.js` – Central orchestration for in-app AI interactions.
  - `TrackRenderer.js`, `CanvasSequenceRenderer.js` – Visualization components heavily relying on SVG/Canvas.
- `tools_registry/` – **The Dynamic Tool Registry** (at project root, NOT `src/tools_registry/`).
  - `tools_registry/system_integration.js` – Core orchestrator: merges built-in, registry, MCP, and plugin tools; deduplicates by name; generates the system prompt.
  - `tools_registry/builtin_tools_integration.js` – **Authoritative mapping** of built-in tool names to their ChatManager methods and categories (`builtInToolsMap`).
  - `tools_registry/registry_manager.js` – Loads YAML tool definitions and generates tool lists based on query relevance.
  - `tools_registry/<category>/` – YAML schema files per category (navigation, sequence_editing, file_operations, etc.).
- `src/mcp-tools/` and `src/mcp-server.js` – Model Context Protocol (MCP) server implementation.
  - `src/mcp-tools/ToolsIntegrator.js` – Combines all 13 tool modules via `combineAllTools()`.
  - `src/mcp-tools/<category>/` – Individual tool modules (navigation/, sequence/, protein/, database/, data/, pathway/, action/, utility/, file/, track/, primer/, annotation/).
  - `src/mcp-tools/utility/AgentChatTools.js` – Defines `codexomics_chat` tool for external MCP clients.
- `src/renderer/modules/Agents/` – Internal Multi-Agent System logic.
- `src/renderer/modules/chat/services/` – Extracted service classes for tool execution:
  - `ToolExecutionService.js`, `FileOperationService.js`, `BlastService.js`, `AnnotationService.js`, `ProteinService.js`, `GenomeAnalysisService.js`, `IntentParserService.js`, `UIService.js`, `LLMContextService.js`
- `src/renderer/modules/chat/constants/` – Centralized constants.
  - `ToolNames.js` – **Authoritative registry** of all tool name constants organized by category.
  - `DefaultSettings.js` – Default configuration constants.
- `src/renderer/modules/MemoryLayers/` – Memory management for agent context.
  - `ShortTermMemory.js` – Fast temporary storage for recent function calls with TTL-based eviction.
- `src/renderer/modules/core/` – Extension system infrastructure.
  - `ExtensionService.js`, `ExtensionHost.js`, `ExtensionContext.js` – Extension lifecycle and sandboxed execution.
  - `ContributionRegistry.js`, `CommandRegistry.js` – Extension contribution points and command registration.
  - `ActivationEventsService.js` – Lazy extension activation based on events.
  - `ExtensionManifest.js` – Manifest validation for extension packages.
  - `Disposable.js` – Base class for lifecycle-managed resources.
  - `ServiceContainer.js` – Lightweight DI container with lazy singleton caching and cycle detection (P1-8).
  - `ErrorHandler.js` – Centralized error handling with fatal/error/warning/info levels (P1-10).
  - `NotificationService.js` – Non-blocking toast notifications replacing alert() (P1-10).
- `src/renderer/modules/security/` – Security infrastructure.
  - `SanitizeService.js` – DOMPurify-based HTML sanitization for safe innerHTML operations (P0-1).
- `src/renderer/modules/tracks/` – Track rendering infrastructure (P2 extraction).
  - `GeneShapeCreators.js` – 24 static SVG gene shape methods extracted from TrackRenderer.js (P2-13).
  - `CanvasRendererBase.js` – Abstract base class eliminating ~300 lines of duplicated boilerplate across 3 canvas renderers (P2-17).
- `src/renderer/modules/export/` – Unified export functionality.
  - `GenBankExporter.js` – Consolidated GenBank format export.
- `src/main/` – Extracted main process modules from main.js (P1-7, 10,584→407 lines).
  - `window-registry.js`, `menu-builder.js`, `window-management.js`, `mcp-lifecycle.js`, `ipc-handlers.js`, `project-ipc.js`
- `src/renderer/modules/ThemeManager.js` – Multi-preset theming.
- `src/renderer/modules/TabManager.js` – Tab title and navigation source tracking.
- `docs/` – Markdown documentation managed by MkDocs.

## 3. Architectural Context

### 3.1 Dynamic Tool Registry Integration

The system prompt is generated per-query by merging tools from 4 sources, deduplicating by tool name, and classifying each tool as "Directly Available (Built-in)" or "Extended".

**Tool Classification Architecture:**

The authoritative source for whether a tool is "Built-in" is the `builtInToolsMap` in `tools_registry/builtin_tools_integration.js`. This Map contains every tool that can execute locally in the browser via `ChatManager.executeLocalTool()` or `ToolExecutionService` (~80+ entries across categories: file_loading, navigation, sequence, system, database, protein, data_management, external_apis, utility, annotation, sequence_editing, file_operations, primer_design, benchmark).

1. Tools whose names exist in `builtInToolsMap` are **always** classified as "Directly Available (Built-in)".
2. Tools not in `builtInToolsMap` are classified as "Extended".
3. Deduplication ensures each tool name appears only once; built-in source takes priority.

### 3.2 Internal Multi-Agent Routing

CodeXomics runs 7 specialized agents: `NavigationAgent`, `DataAgent`, `CoordinatorAgent`, `AnalysisAgent`, `ExternalAgent`, `PluginAgent`, `DeepResearchAgent`.

**Tool Execution Flow (Priority Chain):**

When `ChatManager.executeToolByName()` is called, it delegates to `ToolExecutionService.execute()`:

1. **PRIORITY 1**: Agent settings tools → `AgentSettingsManager`
2. **PRIORITY 2**: Extracted service classes (`FileOperationService`, `AnnotationService`, `BlastService`, `ProteinService`, `GenomeAnalysisService`, `IntentParserService`, `UIService`, `LLMContextService`)
3. **PRIORITY 3**: Multi-Agent routing (`MultiAgentSystem.executeTool()`) — only when `agentSystemEnabled` is true
4. **PRIORITY 4–8**: MCP tools → Plugin integrator → Action manager → MicrobeGenomicsFunctions → `ChatManager[camelCaseMethod]()` → `ChatManager.executeLocalTool()` fallback

**Multi-Agent Selection — Two-Phase Process:**

**Phase 1 — Filtering via `canExecute()`** (`AgentBase.js:84`):

- `toolMapping` first → then `capabilities[]` fallback (functionName or regex pattern)
- NavigationAgent is unique: uses `capabilities[]` exclusively, not `toolMapping`

**Phase 2 — Scoring via `calculateAgentScore()`** (`MultiAgentSystem.js:301`):

| Dimension                  | Calculation                              | Weight Impact                                                            |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| **Historical Performance** | `(1/avgTime) × 1000 + successRate × 100` | Faster & more reliable → higher score                                    |
| **Resource Availability**  | `getResourceAvailability() × 50`         | (cpuScore + memoryScore + networkScore) / 3, range 0~1                   |
| **Context Relevance**      | `calculateContextRelevance() × 200`      | Learning data: similar past contexts with success (+1) or failure (−0.5) |
| **Specialization Bonus**   | `isSpecializedAgent()` → **+100 flat**   | Hardcoded Agent↔tool mapping                                             |

The +100 specialization bonus is typically the **single largest scoring factor**.

### 3.3 Tool Execution Policy System

**Discovery (2025-05-13):** The tool execution policy system filters tool calls before execution to prevent redundant, duplicate, or rate-excessive calls.

**Architecture:**

```
LLM response → parse tool calls → policy filter loop → block/allow → execute remaining
```

**Core engine:** `LLMContextService.shouldAllowToolExecution()` (`src/renderer/modules/chat/services/LLMContextService.js:762-1108`)

**Entry point:** `ChatManager.js:4556-4567` — every tool call is filtered before execution:

```js
toolsToExecute = toolsToExecute.filter(tool => {
  const shouldAllow = this.shouldAllowToolExecution(tool, conversationHistory, currentRound, []);
  if (!shouldAllow) {
    console.log(`🚫 [Policy] Blocking execution of: ${tool.tool_name}`);
    this.updateThinkingMessage(`🚫 Policy blocked: ${tool.tool_name}`);
    return false;
  }
  return true;
});
```

**Policy categories (hardcoded in `LLMContextService.js:767-1087`):**

| Category              | Policy Type                    | Tools                                                                                                                                                                                                    | Condition                                   |
| --------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `file_operations`     | `conditional_re_execution`     | `load_genome_file`, `load_annotation_file`, `load_variant_file`, `load_reads_file`, `load_wig_tracks`, `load_operon_file`                                                                                | Block if same tool+params already succeeded |
| `ui_operations`       | `once_per_round`               | `open_new_tab`, `close_tab`, `switch_tab`, `create_annotation`, `delete_feature`, `export_data`                                                                                                          | Block if already executed this round        |
| `position_navigation` | `parameter_based`              | `navigate_to_position`                                                                                                                                                                                   | Block if same params already succeeded      |
| `scroll_operations`   | `always_allowed`               | `scroll_left`, `scroll_right`                                                                                                                                                                            | Always allow                                |
| `zoom_operations`     | `rate_limited`                 | `zoom_in`, `zoom_out`                                                                                                                                                                                    | Block if within 5 seconds                   |
| `feature_navigation`  | `parameter_based`              | `jump_to_gene`, `jump_to_feature`, `focus_on_gene`                                                                                                                                                       | Block if same params already succeeded      |
| `search`              | `parameter_based`              | `find_gene_by_name`, `search_features`, `search_sequence_motif`                                                                                                                                          | Block if same params already succeeded      |
| `analysis`            | `parameter_based`              | `codon_usage_analysis`, `compute_gc`, `analyze_region`, `translate_dna`, `reverse_complement`, `get_coding_sequence`, `analyze_interpro_domains`                                                         | Block if same params already succeeded      |
| `display_operations`  | `once_per_round`               | `show_hide_features`, `set_view_mode`, `refresh_view`                                                                                                                                                    | Block if already this round                 |
| `track_operations`    | `parameter_based_rate_limited` | `toggle_track`, `toggle_annotation_track`                                                                                                                                                                | Block if same state or within 3s            |
| `state`               | `parameter_based`              | `get_current_state`, `get_genome_info`, `get_file_info`, `get_sequence`, `get_current_region`, `get_visible_tracks`                                                                                      | Block if same params already succeeded      |
| `external_api`        | `rate_limited`                 | `blast_search`, `fetch_protein_structure`, `get_uniprot_entry`, `search_uniprot_database`, `advanced_uniprot_search`, `search_interpro_entry`, `get_interpro_entry_details`, `fetch_alphafold_structure` | Block if within 30 seconds                  |

**Default policy for unknown tools** (`LLMContextService.js:1099-1104`):

If a tool name is NOT in any explicit category, the default "allow once per same parameters" policy applies:

```js
if (!applicablePolicy) {
  const alreadyExecuted = this.chatManager.wasToolExecutedSuccessfully(toolKey, conversationHistory);
  return !alreadyExecuted;
}
```

This uses `wasToolExecutedSuccessfully()` (`ChatManager.js:5972`), which searches conversation history for system messages containing `"<toolName> executed successfully"`.

**Key discovery:** `design_primers` is NOT in any explicit policy category. It falls through to the default policy, which blocks re-execution with the same parameters. This is why `🚫 Policy blocked: design_primers` appears — the tool was already called successfully with the same parameters earlier in the conversation.

**Policy system properties:**

- Entirely hardcoded — no YAML/JSON config, no UI settings, no runtime toggles
- Only visibility: Thinking Process display (`showThinkingProcess` toggle)
- Secondary legacy tracking: `nonReExecutableTools` Set at `ChatManager.js:4826` (separate from the policy system)

### 3.4 `isSpecializedAgent` Map vs. `toolMapping`

These are **two separate registries**:

| Registry             | Scope                 | Purpose                                                  |
| -------------------- | --------------------- | -------------------------------------------------------- |
| `isSpecializedAgent` | `MultiAgentSystem.js` | Determines which tools get the +100 specialization bonus |
| `toolMapping`        | Each Agent class      | Determines which tools pass `canExecute()` check         |

`isSpecializedAgent` should be a **superset-aligned** mapping of each agent's `toolMapping`/`capabilities`.

**Full `isSpecializedAgent` map (excluding legacy aliases):**

- `NavigationAgent` (23 capabilities): navigate_to_position, get_current_state, get_current_region, jump_to_gene, scroll_left, scroll_right, zoom_in, zoom_out, zoom_to_gene, toggle_track, get_track_status, bookmark_position, get_bookmarks, save_view_state, navigate_to, search_features, find_gene_by_name, pan_left, pan_right, switch_to_tab, open_new_tab, close_tab, get_chromosome_list
- `AnalysisAgent` (28 tools): get_sequence, translate_sequence, translate_dna, reverse_complement, calculate_gc_content, compute_gc, calc_region_gc, sequence_statistics, codon_usage_analysis, analyze_codon_usage, genome_codon_usage_analysis, calculate_entropy, calculate_melting_temp, calculate_molecular_weight, predict_promoter, predict_rbs, predict_terminator, analyze_region, compare_regions, find_similar_sequences, find_restriction_sites, virtual_digest, search_pattern, search_sequence_motif, calculate_primer_properties, design_primers, find_primer_binding_sites, add_primer_annotation, get_coding_sequence, get_upstream_region, get_downstream_region
- `DataAgent` (31 tools): get_sequence, get_gene_details, get_annotation_data, get_annotation, get_track_data, export_data, export_sequence, export_region, export_gene_list, export_track_data, export_fasta_sequence, export_genbank_format, export_gff_annotations, export_bed_format, export_cds_fasta, export_protein_fasta, export_current_view_fasta, load_genome_file, load_annotation_file, load_variant_file, load_reads_file, load_wig_tracks, get_operons, get_nearby_features, find_intergenic_regions, search_genes, search_sequences, search_annotations, list_annotations, get_data_statistics, get_genome_summary
- `ExternalAgent` (22 tools): blast_search, blast_sequence, blast_protein, search_uniprot_database, advanced_uniprot_search, get_uniprot_entry, uniprot_get_annotation, fetch_alphafold_structure, search_alphafold_structures, search_alphafold_by_sequence, search_pdb_structures, fetch_protein_structure, analyze_interpro_domains, get_interpro_entry_details, kegg_search, kegg_get_pathway, evo2_design, evo2_optimize
- `PluginAgent` (15 tools): list_plugins, get_plugin_info, install_plugin, uninstall_plugin, enable_plugin, disable_plugin, execute_plugin, call_plugin_function, get_plugin_functions, create_plugin, validate_plugin, test_plugin, search_plugins, get_plugin_marketplace, update_plugin
- `DeepResearchAgent` (4 tools): deep_research, research_analysis, synthesize_information, generate_research_report
- `CoordinatorAgent` (15 tools): coordinate_task, decompose_task, integrate_results, create_workflow, execute_workflow, get_workflow_status, assign_task_to_agent, get_agent_status, balance_load, handle_error, retry_failed_task, fallback_strategy, optimize_execution, cache_strategy, parallel_execution

### 3.5 LLM Configuration Manager

The LLM configuration UI (`#llmConfigModal`) is managed by `src/renderer/modules/LLMConfigManager.js`. Supports multiple provider tabs (Local LLM, OpenAI, Anthropic, Google, DeepSeek, SiliconFlow, OpenRouter) plus a "Model Selection" tab.

**Custom Model Name pattern:** Each provider's `<select id="{provider}Model">` includes `<option value="other">Other (specify below)</option>`, followed by a hidden `<div id="{provider}ModelOtherGroup">` containing `<input id="{provider}ModelOther">`.

### 3.6 Benchmark Tools & On-Demand Subsystem Initialization

8 built-in benchmark tools (`open_benchmark`, `start_benchmark`, `stop_benchmark`, `pause_benchmark`, `resume_benchmark`, `get_benchmark_results`, `get_benchmark_status`, `export_benchmark_results`) registered in `builtInToolsMap` under the `benchmark` category.

The benchmark subsystem uses lazy initialization via `GenomeBrowser.initializeBenchmarkSystemOnDemand()` — NOT loaded at startup.

### 3.7 MCP Server Modes

Two modes: `--mode=tools` (default, all 40+ tools exposed individually) and `--mode=agent` (only `codexomics_chat` + window tools exposed, all prompts routed through ChatManager's LLM loop).

Mode configuration priority: CLI arg > `CODEXOMICS_MCP_MODE` env var > `authConfig.mode` > default `'tools'`.

### 3.8 UI Style System (Multi-Preset Theming)

Multiple UI style presets (AI Dynamic, Professional, Minimal, Pastel) switchable at runtime via `ThemeManager`. CSS custom properties (`:root` variables) as primary theming mechanism, with `[data-ui-style="<preset>"]` attribute selectors for overrides.

Key files: `ThemeManager.js`, `base.css`, `themes/<preset>.css`, `GeneralSettingsManager.js`, `index.html`

### 3.9 Tab Manager and Navigation Source Pattern

Tab title system in `TabManager.js` supports two modes:

- **Mode 1 (Position-based)**: `Chromosome:start-end`
- **Mode 2 (Gene-based)**: `Gene: <name>`

Navigation source values: `'ruler'`, `'zoom'`, `'drag'`, `'navigation'`. Gene name titles are preserved during zoom/drag/navigation; only `source === 'ruler'` switches to Mode 1.

### 3.10 Annotation Track Management (Dynamic Tracks)

Custom annotation tracks (GFF/BED) are managed dynamically outside the `multiFileManager` (which is reserved for BAM/VCF). 

- **ID Pattern**: The internal `id` (e.g., `annotation_track_123`) is stored in `genomeBrowser.annotationTracks`. However, for rendering and visibility tracking, a double-prefixed ID is used: `annotation_annotation_track_123`.
- **Visibility Control**: The `visibleTracks` set must contain the full prefixed ID (`annotation_${at.id}`) to be correctly rendered by `displayGenomeView`.
- **Track Identification**: Tracks in the DOM are identified by `data-track-type`. For custom tracks, this attribute must match the full prefixed ID to prevent them from being lost or misidentified as generic "genes" tracks during DOM-based order updates.
- **State Persistence**: `TabManager` explicitly synchronizes both the `annotationTracks` data list and the `visibleTracks` set per tab to ensure custom tracks survive navigation, tab switching, and ruler interactions.

## 4. Historical Decisions

- **P1-7**: Main process extraction (10,584→407 lines) into `src/main/` modules
- **P1-8**: DI container via `ServiceContainer.js` with lazy singleton caching and cycle detection
- **P1-10**: Centralized `ErrorHandler.js` + `NotificationService.js` replacing alert()
- **P0-1**: DOMPurify-based `SanitizeService.js` for safe innerHTML
- **P2-13**: 24 static SVG gene shape methods extracted into `GeneShapeCreators.js`
- **P2-17**: `CanvasRendererBase.js` abstract base eliminating ~300 lines duplication across 3 canvas renderers
- **Dynamic Tool Registry**: Moved from static tool definitions in ChatManager to `tools_registry/` YAML-based dynamic registry with 4-source merging
- **Service Extraction**: Tool execution logic extracted from ChatManager into dedicated service classes (`ToolExecutionService`, `FileOperationService`, etc.)
- **Policy System Design**: Tool execution policies hardcoded inline in `LLMContextService.shouldAllowToolExecution()` rather than configurable — intentional decision to keep policies immutable and auditable
- **Annotation Track Persistence**: Resolved intermittent disappearance of GFF/BED tracks by enforcing ID prefix consistency and prioritizing `data-track-type` in track order detection.

## 5. Build and Execution Commands

- `npm start` - Starts the electron app in development mode.
- `npm run dev` - Starts the electron app with developer tools immediately active.
- `npm run mcp-server` - Starts the standalone CodeXomics MCP Server.
- `npm test` - Runs the existing testing suite.
