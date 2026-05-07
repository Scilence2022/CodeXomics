<div align="center">

# CodeXomics

### AI-Powered Bioinformatics Analysis Platform

[![Version](https://img.shields.io/badge/version-0.6beta-blue.svg)](https://github.com/Scilence2022/CodeXomics/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/Scilence2022/CodeXomics/releases)
[![Electron](https://img.shields.io/badge/Electron-27.3.11-47848f.svg)](https://www.electronjs.org/)
[![Beta](https://img.shields.io/badge/Latest%20Beta-v0.7beta-blue.svg)](https://github.com/Scilence2022/CodeXomics/releases/tag/v0.7beta)

A cross-platform desktop bioinformatics platform built with Electron. Features a **multi-agent AI system**, a **dynamic tool registry**, MCP server integration, an extensible plugin architecture, **multi-preset UI theming**, and comprehensive genome visualization for exploring genomic, proteomic, and other omics data.

**[Latest Beta — v0.7beta](https://github.com/Scilence2022/CodeXomics/releases/tag/v0.7beta)**

[Features](#key-features) •
[Installation](#installation) •
[Quick Start](#quick-start) •
[Architecture](#architecture) •
[Documentation](#documentation) •
[Contributing](#contributing)

</div>

---

## Key Features

### Multi-Agent AI System

Eight specialized agents collaborate to handle complex analysis workflows:

| Agent               | Role                                                        |
| ------------------- | ----------------------------------------------------------- |
| `CoordinatorAgent`  | Task decomposition, workflow management, result integration |
| `AnalysisAgent`     | Sequence, variant, and genomic region analysis              |
| `DataAgent`         | File loading, data parsing, and format conversion           |
| `NavigationAgent`   | Genome browser navigation and position jumping              |
| `ExternalAgent`     | MCP server communication and external tool execution        |
| `PluginAgent`       | Plugin discovery, invocation, and lifecycle management      |
| `DeepResearchAgent` | Multi-source information synthesis and report generation    |
| `AgentBase`         | Shared base class providing common agent infrastructure     |

The system includes a **multi-layer `MemorySystem`** (short-term, medium-term, long-term, and semantic layers) for intelligent caching and cross-session context persistence.

### Dynamic Tool Registry

Tools are defined as individual YAML files under `tools_registry/` and are retrieved on-demand based on user intent — they are never hardcoded into system prompts.

**Tool categories (90+ tools total):**

| Category                                              | Count   | Description                                           |
| ----------------------------------------------------- | ------- | ----------------------------------------------------- |
| `navigation/`                                         | 12      | Browser navigation, tab management, position jumping  |
| `coordination/`                                       | 15      | Multi-agent workflow orchestration                    |
| `sequence/`                                           | 8+      | GC content, translation, ORF finding, motif search    |
| `sequence_editing/`                                   | 10      | Copy, cut, paste, insert, replace, undo               |
| `plugin_management/`                                  | 12      | Plugin install, enable, execute, validate             |
| `external_apis/`                                      | 12      | BLAST, UniProt, AlphaFold, KEGG, InterPro, EVO2       |
| `protein/`                                            | 6       | Structure fetching, AlphaFold viewer, PDB search      |
| `database/`                                           | 6       | UniProt, InterPro domain analysis                     |
| `data_management/`                                    | 4       | Annotations, region analysis, codon usage, export     |
| `pathway/`                                            | 3       | Metabolic pathways, KEGG, BLAST search                |
| `ai_analysis/`                                        | 5       | EVO2 sequence generation, CRISPR design, essentiality |
| `annotation/`, `file_operations/`, `benchmark/`, etc. | various | Additional specialized categories                     |

Each tool definition includes a JSON Schema for parameters, sample usages for few-shot learning, relationship metadata (dependencies, conflicts, alternatives), and performance statistics.

### CodeXomics MCP Server

- **40+ genomics tools** exposed as a standalone MCP server (`npm run mcp-server`)
- **Dual transport**: HTTP/SSE on port `3002`, WebSocket on port `3003`
- **Two operating modes**:
  - **Tools mode** (default) — All 40+ tools exposed individually; MCP clients call specific tools directly
  - **Agent mode** (`--mode=agent`) — Only `codexomics_chat` is exposed; prompts are routed through the internal AI agent which autonomously decides which tools to call. Progress notifications are pushed to MCP clients in real-time via `notifications/message`
- **`MCPBridge`** in the renderer auto-connects to running MCP server instances
- **`InternalMCPServer`** for in-process tool execution without network overhead
- **`AuthenticationManager`** and **`ConnectionHealthMonitor`** for secure, reliable connections
- Consumable from any MCP-compatible client (Claude Desktop, Cursor, etc.)

### Genome Visualization

- **SVG-based genome browser** with hardware-accelerated rendering
- **Multi-track system**: genes/features, DNA sequence, GC content/skew, variants (VCF), aligned reads (BAM), protein sequences, interaction networks, KEGG pathways
- **Interactive tracks**: resizable heights, drag-to-reorder, state persistence across sessions
- **Canvas renderers**: `CanvasGenesRenderer`, `CanvasReadsRenderer`, `CanvasSequenceRenderer` for high-performance display of dense data
- **Circos plotter**: circular genome visualization (`circos-plotter.html`)
- **Real-time navigation**: smooth zooming, panning, position jumping, multi-tab support

### Plugin System

- **Plugin API v2.0.0** — `PluginManagerV2` backed by a VS Code-inspired **`ExtensionService`** (activation events, contribution registry, sandboxed extension host)
- **AI-callable plugins** — `PluginFunctionCallsIntegrator` exposes plugin functions directly to LLM tool calling
- **`SmartExecutor`** and **`FunctionCallsOrganizer`** for intelligent routing
- **`PluginSecurityValidator`** for sandboxed, validated execution
- **`PluginMarketplace`** with a dedicated workspace package (`packages/marketplace-server/`) for community distribution
- **`PluginUpdateManager`**, `PluginDependencyResolver`, and `PluginResourceManager` for full lifecycle management

### ChatBox & AI Assistant

- **`ChatManager`** orchestrates LLM interactions with dynamic tool injection from the registry
- **Modular chat services** under `src/renderer/modules/chat/services/`:
  - `IntentParserService` — natural language intent detection
  - `ToolExecutionService` — tool dispatch and result handling
  - `LLMContextService` — context window management
  - `GenomeAnalysisService`, `AnnotationService`, `ProteinService`, `BlastService`, `FileOperationService`, `UIService`
- **Multi-provider LLM support**: OpenAI, Anthropic, Google Gemini, SiliconFlow (Qwen, DeepSeek, Kimi, GLM, Yi), local LLMs via Ollama
- **Draggable ChatBox** — dock to sidebar or float freely; drag to edge to dock, drag away to undock
- **Thinking history** — view full AI reasoning chain for each response

### Benchmark Testing System

Four benchmark suites covering 22+ test cases across six analysis categories:

| Suite                   | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `AutomaticSimpleSuite`  | Automated tests for straightforward single-step tasks     |
| `AutomaticComplexSuite` | Automated multi-step workflow validation                  |
| `ManualSuite`           | Interactive tests requiring human scoring (0–10 per case) |
| `ManualComplexSuite`    | Human-verified complex multi-agent workflows              |

Categories: navigation, sequence analysis, data loading, gene search, external database queries, and multi-step workflows. Results, LLM interactions, and performance metrics are exportable.

**8 AI-callable benchmark tools** are registered as built-in tools, allowing the in-app AI assistant to open, start, stop, pause, resume, query status, retrieve results, and export benchmark data directly from chat:

| Tool                       | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `open_benchmark`           | Open the benchmark interface                                     |
| `start_benchmark`          | Start a benchmark run with configurable suites, timeout, options |
| `stop_benchmark`           | Stop the currently running benchmark                             |
| `pause_benchmark`          | Pause the running benchmark                                      |
| `resume_benchmark`         | Resume a paused benchmark                                        |
| `get_benchmark_results`    | Retrieve benchmark results/history by index                      |
| `get_benchmark_status`     | Query current benchmark status (running, paused, suite count)    |
| `export_benchmark_results` | Export results as JSON, CSV, or HTML                             |

### Additional Capabilities

- **Multi-Preset UI Theming** — Switch between four interface style presets at runtime: AI Dynamic (blue-violet), Professional (deep teal), Minimal (warm amber), and Pastel (soft lavender-rose). Managed by `ThemeManager` with CSS custom properties and per-preset override files under `src/renderer/css/themes/`. Dark mode supported per preset.
- **Primer Designer** — Tm, GC%, and binding site analysis (`PrimerDesigner.js`)
- **BLAST integration** — Local BLAST installer, downloader, and manager (`BlastManager.js`)
- **Genomic Data Downloader** — Fetch genomes and annotations from NCBI and other sources
- **Checkpoint / Rollback** — `CheckpointManager` saves up to 50 named state snapshots with auto-save every 5 minutes
- **Internationalization** — `I18nManager` supports English and Simplified Chinese (`zh-CN`) with runtime language switching
- **Literature integration** — `LiteratureAPIService` for PubMed and preprint lookups
- **Bioinformatics web tools**: KGML Pathway Viewer, STRING Protein Networks, UniProt Search, InterPro Analyzer, NCBI Browser, GO Analyzer, KEGG Analyzer, DAVID Analyzer, Reactome Browser, PDB Viewer
- **Circos plotter** — Multi-track circular genome layout

---

## Installation

### Pre-built Releases

Download the latest release (v0.532beta):

**macOS**

- [Intel (x64) — `.dmg`](https://github.com/Scilence2022/CodeXomics/releases/download/v0.532beta/CodeXomics-0.532.0-beta-x64.dmg)
- [Apple Silicon (arm64) — `.dmg`](https://github.com/Scilence2022/CodeXomics/releases/download/v0.532beta/CodeXomics-0.532.0-beta-arm64.dmg)

**Windows**

- [Installer — `.exe`](https://github.com/Scilence2022/CodeXomics/releases/download/v0.532beta/CodeXomics%20Setup%200.532.0-beta.exe)
- [Portable — `.exe`](https://github.com/Scilence2022/CodeXomics/releases/download/v0.532beta/CodeXomics%200.532.0-beta.exe)

**Linux**

- [AppImage](https://github.com/Scilence2022/CodeXomics/releases/download/v0.532beta/CodeXomics-0.532.0-beta.AppImage)
- [Debian — `.deb`](https://github.com/Scilence2022/CodeXomics/releases/download/v0.532beta/codexomics_0.532.0-beta_amd64.deb)
- [Snap](https://github.com/Scilence2022/CodeXomics/releases/download/v0.532beta/codexomics_0.532.0-beta_amd64.snap)

[All downloads — GitHub Releases](https://github.com/Scilence2022/CodeXomics/releases/tag/v0.532beta)

### Build from Source

```bash
git clone https://github.com/Scilence2022/CodeXomics.git
cd CodeXomics
npm install          # installs root + workspace packages
npm start            # launch in development mode
npm run dev          # launch with DevTools open
```

**Additional run modes:**

```bash
npm run mcp-server              # standalone MCP server (tools mode)
npm run mcp-server -- --mode=agent  # standalone MCP server (agent mode)
npm run start-with-mcp          # app + MCP server concurrently
npm run start-with-marketplace  # app + plugin marketplace server
npm run start-full              # app + MCP server + marketplace server

npm run build                   # production build (all platforms)
npm run build:mac               # macOS DMG
npm run build:win               # Windows NSIS + portable
npm run build:linux             # Linux AppImage + deb + snap
```

---

## Quick Start

### 1. Configure AI Models

```
Options → Configure LLMs
  ├── Add API key (OpenAI, Anthropic, Google, SiliconFlow, DeepSeek, Kimi, ...)
  ├── Or set a local LLM base URL (e.g. http://localhost:11434/v1 for Ollama)
  └── Test connection → Save
```

### 2. Load Genomic Data

```
File → Load File
  ├── Genome:      FASTA, GenBank (.gbk / .gb)
  ├── Annotations: GFF, GTF, BED
  ├── Variants:    VCF
  └── Reads:       BAM, SAM
```

### 3. Interact via AI

```
ChatBox examples:
  "Find all DNA polymerase genes"
  "Calculate GC content of the selected region"
  "Design primers for lacZ"
  "Show STRING protein network for dnaA"
  "Load the glycolysis KEGG pathway"
  "Run benchmark tests"
  "Enable multi-agent mode and analyze this operon"
```

### 4. Connect External MCP Clients

Start the MCP server and add this to your client configuration:

```bash
# Tools mode (default) - all tools exposed individually
npm run mcp-server

# Agent mode - prompts routed through AI agent autonomously
npm run mcp-server -- --mode=agent
```

Client configuration:

```json
{
  "mcpServers": {
    "CodeXomics": {
      "url": "http://localhost:3002",
      "transportType": "streamable-http"
    }
  }
}
```

Endpoints:

- HTTP/SSE: `http://localhost:3002`
- WebSocket: `ws://localhost:3003`

---

## Architecture

### Source Tree

```
CodeXomics/
├── src/
│   ├── main.js                         # Electron main process
│   ├── preload.js                      # Context bridge / IPC
│   ├── version.js                      # Centralized version management
│   ├── mcp-server.js                   # MCP server entry point
│   ├── mcp-tools/                      # MCP tool implementations
│   │   ├── navigation/, sequence/, protein/, database/
│   │   ├── pathway/, primer/, annotation/, track/, action/, utility/
│   │   ├── AuthenticationManager.js
│   │   ├── ConnectionHealthMonitor.js
│   │   ├── ToolCategoryManager.js
│   │   └── ToolsIntegrator.js          # Mode-aware routing (tools/agent)
│   ├── bioinformatics-tools/           # Standalone HTML tool windows
│   │   ├── kgml-viewer.html            # KEGG pathway viewer
│   │   ├── string-networks.html        # STRING protein networks
│   │   ├── pdb-viewer.html             # Protein structure (NGL)
│   │   ├── uniprot-search.html
│   │   ├── interpro-analyzer.html
│   │   ├── ncbi-browser.html
│   │   ├── go-analyzer.html
│   │   ├── kegg-analyzer.html
│   │   ├── david-analyzer.html
│   │   ├── reactome-browser.html
│   │   └── gene-annotation-refine.html
│   ├── circos-plotter.html             # Circular genome visualization
│   ├── genomic-data-download.html      # NCBI genome downloader
│   ├── i18n/                           # Internationalization (EN, zh-CN)
│   └── renderer/
│       ├── index.html
│       ├── renderer-modular.js         # Application bootstrap
│       ├── css/                        # Vanilla CSS stylesheets
│       │   └── themes/                # UI style preset overrides
│       │       ├── professional.css   # Deep teal scientific style
│       │       ├── minimal.css        # Warm amber minimalist style
│       │       └── pastel.css         # Soft lavender-rose style
│       └── modules/
│           ├── Agents/                 # Multi-agent system
│           │   ├── AgentBase.js
│           │   ├── CoordinatorAgent.js
│           │   ├── AnalysisAgent.js
│           │   ├── DataAgent.js
│           │   ├── NavigationAgent.js
│           │   ├── ExternalAgent.js
│           │   ├── PluginAgent.js
│           │   └── DeepResearchAgent.js
│           ├── MemoryLayers/           # Multi-layer memory system
│           │   └── ShortTermMemory.js
│           ├── chat/                   # ChatManager service layer
│           │   └── services/
│           │       ├── IntentParserService.js
│           │       ├── ToolExecutionService.js
│           │       ├── LLMContextService.js
│           │       ├── GenomeAnalysisService.js
│           │       ├── AnnotationService.js
│           │       ├── ProteinService.js
│           │       ├── BlastService.js
│           │       ├── FileOperationService.js
│           │       └── UIService.js
│           ├── core/                   # VS Code-inspired extension system
│           │   ├── ExtensionService.js
│           │   ├── ExtensionHost.js
│           │   ├── ExtensionContext.js
│           │   ├── ContributionRegistry.js
│           │   ├── ActivationEventsService.js
│           │   ├── CommandRegistry.js
│           │   └── ExtensionManifest.js
│           ├── benchmark-suites/       # AI benchmark test suites
│           │   ├── AutomaticSimpleSuite.js
│           │   ├── AutomaticComplexSuite.js
│           │   ├── ManualSuite.js
│           │   └── ManualComplexSuite.js
│           ├── ChatManager.js          # LLM orchestration + tool injection
│           ├── MultiAgentSystem.js     # Agent coordination & event bus
│           ├── MemorySystem.js         # Multi-layer memory & caching
│           ├── TrackRenderer.js        # SVG genome track renderer
│           ├── CanvasGenesRenderer.js
│           ├── CanvasReadsRenderer.js
│           ├── CanvasSequenceRenderer.js
│           ├── NavigationManager.js    # Search & genome navigation
│           ├── FileManager.js          # File I/O & format parsing
│           ├── ProjectManager.js       # .prj.GAI project files
│           ├── PluginManagerV2.js      # Plugin lifecycle management
│           ├── PluginMarketplace.js    # Plugin discovery & install
│           ├── SmartExecutor.js        # Intelligent tool routing
│           ├── FunctionCallsOrganizer.js
│           ├── PluginFunctionCallsIntegrator.js
│           ├── PluginSecurityValidator.js
│           ├── MCPBridge.js            # Auto-connects to MCP server
│           ├── InternalMCPServer.js    # In-process MCP execution
│           ├── MCPServerManager.js
│           ├── CheckpointManager.js    # State snapshots & rollback
│           ├── I18nManager.js          # EN / zh-CN runtime switching
│           ├── PrimerDesigner.js       # Primer Tm, GC%, binding sites
│           ├── BlastManager.js         # Local BLAST integration
│           ├── ThemeManager.js         # Multi-preset UI style management
│           ├── BenchmarkManager.js     # Benchmark orchestration
│           ├── LiteratureAPIService.js # PubMed / preprint search
│           └── ...                     # 100+ additional modules
├── tools_registry/                     # Dynamic Tool Registry (YAML)
│   ├── registry_manager.js
│   ├── system_integration.js
│   ├── tool_categories.yaml
│   ├── navigation/    coordination/    sequence/    sequence_editing/
│   ├── protein/       database/        data_management/  pathway/
│   ├── ai_analysis/   plugin_management/ external_apis/
│   ├── annotation/    file_operations/  file_loading/
│   ├── primer_design/ system/           utility/
│   └── backup/
├── packages/
│   ├── app/                            # Workspace app package
│   └── marketplace-server/            # Plugin marketplace HTTP server
├── scripts/                            # Build, version, and packaging scripts
├── docs/                               # MkDocs documentation
├── test/                               # Unit, integration, and plugin tests
├── test_data/                          # Sample genomes and pathways
└── assets/                             # Icons and static resources
```

### Key Design Patterns

**Dynamic Tool Registry** — Each tool lives in its own YAML file. `registry_manager.js` scores and retrieves only the tools relevant to the current user query, keeping LLM context windows small and accurate.

**MCP Dual-Mode Server** — The MCP server operates in `tools` mode (direct tool access) or `agent` mode (prompts routed through the internal AI agent). In agent mode, the `codexomics_chat` tool is the single entry point, and progress notifications are pushed to MCP clients in real-time.

**Agent-per-capability** — Complex requests are decomposed by `CoordinatorAgent` and dispatched to domain-specific agents. Results are integrated back before responding.

**Service-layer ChatManager** — `ChatManager.js` delegates to focused service classes (`chat/services/`) rather than handling everything inline.

**VS Code-inspired extension host** — `core/ExtensionService.js` activates plugins lazily via activation events, manages contribution points, and sandboxes plugin execution.

**IPC boundary** — Renderer–main communication flows through `preload.js` context bridge; no direct Node.js calls from renderer code.

---

## File Format Support

| Format                  | Type                 | Import | Export |
| ----------------------- | -------------------- | ------ | ------ |
| FASTA                   | Genome sequence      | Yes    | Yes    |
| GenBank (`.gbk`, `.gb`) | Genome + annotations | Yes    | Yes    |
| GFF / GTF               | Annotations          | Yes    | Yes    |
| BED                     | Genomic intervals    | Yes    | Yes    |
| VCF                     | Variants             | Yes    | No     |
| SAM / BAM               | Alignments           | Yes    | No     |
| WIG                     | Quantitative tracks  | Yes    | Yes    |
| KGML                    | KEGG pathways        | Yes    | Yes    |
| `.prj.GAI`              | Projects             | Yes    | Yes    |

---

## Configuration

### AI Provider Setup

```json
// OpenAI / compatible
{ "provider": "openai", "apiKey": "sk-...", "model": "gpt-4o", "baseURL": "https://api.openai.com/v1" }

// Anthropic
{ "provider": "anthropic", "apiKey": "sk-ant-...", "model": "claude-opus-4-5" }

// Local LLM (Ollama)
{ "provider": "local", "apiKey": "not-required", "model": "llama3", "baseURL": "http://localhost:11434/v1" }
```

### Application Config Files

Stored in `~/.codexomics/`:

| File                  | Purpose                     |
| --------------------- | --------------------------- |
| `config.json`         | Main application settings   |
| `llm-config.json`     | AI provider configurations  |
| `ui-preferences.json` | Interface customizations    |
| `chat-history.json`   | Conversation history        |
| `plugins.json`        | Plugin configurations       |
| `projects.json`       | Project management settings |

### System Requirements

| Resource | Minimum                             | Recommended   |
| -------- | ----------------------------------- | ------------- |
| RAM      | 6 GB                                | 12 GB         |
| Storage  | 1 GB                                | 2 GB          |
| CPU      | Dual-core                           | Quad-core+    |
| OS       | macOS 10.15 / Win 10 / Ubuntu 20.04 | Latest stable |
| Network  | Required for AI services            | —             |

---

## Development

### Testing

```bash
npm test                    # full test suite
npm run test:plugins        # plugin system tests
npm run test:ai-integration # AI integration tests
npm run test:visualization  # visualization tests
```

Test structure:

```
test/
├── unit-tests/
├── integration-tests/
├── fix-validation-tests/
└── plugin-tests/
```

### Plugin Development

Plugins are loaded by `PluginManagerV2` and activated through `ExtensionService`. A plugin must provide an `ExtensionManifest`-compatible descriptor and can contribute commands, tools, and UI elements via the `ContributionRegistry`.

```javascript
// Minimal plugin structure
const MyPlugin = {
  id: 'my-plugin',
  name: 'My Custom Plugin',
  version: '1.0.0',

  functions: {
    analyzeSequence: {
      description: 'Analyze a DNA sequence',
      parameters: {
        sequence: { type: 'string', required: true },
      },
      execute: async params => {
        return { result: 'analysis complete' };
      },
    },
  },

  initialize: () => {
    /* setup */
  },
};
```

Refer to `src/renderer/modules/core/ExtensionService.js` and `src/renderer/modules/PluginManagerV2.js` for the full API.

### AI Coding Assistant Guidelines

When using autonomous AI coding tools (Copilot, Cursor, Claude, etc.) in this repository, read [`Agents.md`](Agents.md) first. It documents the architectural rules, coding conventions, IPC patterns, and the Dynamic Tool Registry integration contract that must be followed.

---

## Troubleshooting

| Symptom                          | Resolution                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| AI assistant not responding      | Check API key in `Options → Configure LLMs`. Use "Test Connection".                                                                    |
| MCP server tools not available   | Run `npm run mcp-server`; verify ports 3002/3003 are not blocked.                                                                      |
| MCP agent mode not working       | Ensure LLM is configured (`Options → Configure LLMs`). Start with `--mode=agent`. Check that `codexomics_chat` tool appears in client. |
| Plugin fails to load             | Check developer console for activation errors; verify plugin API version compatibility (`PLUGIN_API_VERSION = "2.0.0"`).               |
| KGML viewer blank                | Confirm file is valid KEGG XML; check file path accessibility.                                                                         |
| BAM tracks not visible           | Ensure BAM index (`.bai`) file is present alongside the BAM file.                                                                      |
| Performance lag on large genomes | Reduce visible track count; enable Simple Mode; close unused tool windows.                                                             |
| Project fails to load            | Verify `.prj.GAI` file integrity and that all referenced data files are accessible.                                                    |
| Language not switching           | Restart the application after changing language in settings.                                                                           |

---

## Documentation

- **[User Guide](docs/user-guides/)** — Feature walkthroughs and usage instructions
- **[Developer Guide](docs/developer-guides/)** — Setup, contribution workflow, and code conventions
- **[Architecture](docs/architecture/)** — System design documents including Multi-Agent System specification
- **[Reference](docs/reference/)** — API references and technical guides
- **[Release Notes](docs/release-notes/)** — Version history
- **[Tools Registry README](tools_registry/README.md)** — Tool definition format and registry internals
- **[AI Coding Guidelines](Agents.md)** — Guidelines for AI coding assistants

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

**Guidelines:**

- Vanilla JavaScript (ES6+) only — no TypeScript, no React, no CSS frameworks
- New AI tools belong in `tools_registry/` as YAML files, not hardcoded in `ChatManager.js`
- New capabilities for agent workflows belong in the relevant `Agents/` class
- Wrap all IPC calls and async operations in `try/catch`; never let promises fail silently
- Read `Agents.md` before making architectural changes

---

## Issues and Support

- **Bug Reports**: [GitHub Issues](https://github.com/Scilence2022/CodeXomics/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/Scilence2022/CodeXomics/discussions)
- **Email**: songlf@tib.cas.cn

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Electron](https://www.electronjs.org/) — cross-platform desktop framework
- [D3.js](https://d3js.org/) — data visualization

- [NGL Viewer](https://nglviewer.org/) — protein structure rendering
- [OpenAI](https://openai.com/), [Anthropic](https://anthropic.com/), [Google](https://deepmind.google/) — LLM providers
- [SiliconFlow](https://siliconflow.cn/) — Chinese LLM integration
- [KEGG](https://www.kegg.jp/) — pathway data
- [STRING](https://string-db.org/) — protein interaction networks
- [AlphaFold](https://alphafold.ebi.ac.uk/) — protein structure predictions
- [UniProt](https://www.uniprot.org/) / [InterPro](https://www.ebi.ac.uk/interpro/) — protein databases
- The bioinformatics community for feedback and inspiration

---

<div align="center">

**CodeXomics v0.533beta** — Intelligent Bioinformatics Analysis with Multi-Agent AI

![GitHub stars](https://img.shields.io/github/stars/Scilence2022/CodeXomics?style=social)
![GitHub issues](https://img.shields.io/github/issues/Scilence2022/CodeXomics)

[Back to Top](#codexomics)

</div>
