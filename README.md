<div align="center">

# CodeXomics

### The AI-native genome browser

_Talk to your genome — AI agents drive the view and run the analysis._

[![Version](https://img.shields.io/badge/version-v0.723-blue.svg)](https://github.com/Scilence2022/CodeXomics/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/Scilence2022/CodeXomics/releases)
[![Electron](https://img.shields.io/badge/Electron-43.8.7-47848f.svg)](https://www.electronjs.org/)

CodeXomics is an AI-native genome browser — a cross-platform Electron desktop app where conversational AI agents drive the visualization and run real biological analyses, with built-in tool execution, plugin development, and Model Context Protocol (MCP) integration.

Current source release: `0.723.0` (shown as `v0.723` in the app). See the [changelog](CHANGELOG.md#unreleased) for changes in the current source and [GitHub Releases](https://github.com/Scilence2022/CodeXomics/releases) for available installers.

[Website](https://scilence2022.github.io/CodeXomics/landing/) •
[中文 Landing Page](https://scilence2022.github.io/CodeXomics/landing/index-zh.html) •
[中文文档](https://scilence2022.github.io/CodeXomics/zh/) •
[Documentation](https://scilence2022.github.io/CodeXomics/) •
[Getting Started](docs/user-guides/GETTING_STARTED.md) •
[Developer Guide](docs/developer-guides/DEVELOPER_GUIDE.md) •
[MCP Server](docs/user-guides/MCP_SERVER_GUIDE.md) •
[Releases](https://github.com/Scilence2022/CodeXomics/releases)

</div>

---

## What CodeXomics Provides

CodeXomics combines an interactive genome browser with executable AI analysis. Load a genome, ask a question in the ChatBox, and let the app navigate the view, call bioinformatics tools, and return results in the same workspace.

- Browse FASTA and GenBank genomes, overlay annotations, variants, SAM/BAM alignments, WIG/BigWig tracks and operons, and organize work in `.prj.GAI` projects. [Supported inputs](docs/user-guides/GETTING_STARTED.md#load-data)
- Run BLAST, primer design, virtual restriction digest, gel simulation, and protein structure lookup from the ChatBox. [User Guide](docs/user-guides/USER_GUIDE.md)
- Queue sequence edits and export a separate GenBank file. Run Deep Gene Research to create evidence-backed annotation ChangeSets for curator review. [Sequence editing](docs/user-guides/USER_GUIDE.md#sequence-editing) · [Annotation review](docs/developer-guides/AUTONOMOUS_ANNOTATION.md)
- Choose a cloud or OpenAI-compatible local model, run the in-app benchmark, or extend the app through plugins and MCP. [Benchmark testing](docs/user-guides/USER_GUIDE.md#benchmark-testing) · [MCP Server Guide](docs/user-guides/MCP_SERVER_GUIDE.md)

The tool registry and agent runtime are implementation details that evolve with the release; see the [architecture guide](docs/architecture/CodeXomics_Multi_Agent_System_Technical_Specification.md) for current internals.

## Screenshots

<div align="center">

![Genome browser overview](docs/figures/genome-browser-overview.png)

_Genome browser: feature track, GC content and skew, multi-track WIG data, gene details sidebar, and the protein/sequence view._

![Aligned reads and references](docs/figures/reads-and-references.png)

_Base-resolution and coverage read alignment tracks alongside gene references and operons in the side panel._

![AlphaFold protein structure viewer](docs/figures/protein-structure-alphafold.png)

_AlphaFold structure lookup and interactive 3D protein viewer, driven from the AI ChatBox._

![Read alignment pileup](docs/figures/read-alignment-pileup.png)

_Base-level sequencing-read pileup over a selected gene._

![Primer design on the sequence track](docs/figures/primer-design.png)

_Designed primers rendered directly on the sequence view._

</div>

## Install

### Download

Download the latest available build from [GitHub Releases](https://github.com/Scilence2022/CodeXomics/releases).

### Build From Source

Source builds require Node.js 22.12 or newer in the 22.x line and npm 10 or newer. Standalone tests also run on Node.js 20 after dependencies are installed.

```bash
git clone https://github.com/Scilence2022/CodeXomics.git
cd CodeXomics
npm install
npm start
```

Useful run modes:

```bash
npm run dev                       # Electron app with developer tools
npm run mcp-server                # Standalone MCP server, tools mode
npm run mcp-server -- --mode=agent
npm run start-with-mcp            # Electron app + MCP server
npm run marketplace:start         # Plugin marketplace server
npm run start-with-marketplace    # Electron app + marketplace server
npm run start-full                # Electron app + MCP server + marketplace
```

Build commands:

```bash
npm run build
npm run build:mac
npm run build:win
npm run build:linux
npm run build:all
```

## Quick Start

1. Launch CodeXomics after [downloading a release](https://github.com/Scilence2022/CodeXomics/releases) or starting the source build.
2. Open **Settings → Model Providers** (<kbd>⌘,</kbd> / <kbd>Ctrl+,</kbd>), save a provider, and choose the **Default Model**. The ChatBox model picker can override it for a conversation.
3. Load a reference with **File → Load File → Genome File** or open a `.prj.GAI` project with **File → Open Project**.
4. Add optional annotation, variant, reads, WIG, or operon files.
5. Ask the assistant to run concrete analyses, for example:

```text
Find all DNA polymerase genes.
Calculate GC content for the selected region.
Design primers around lacZ.
Search AlphaFold for the selected protein.
Create a local BLAST database from the current genome.
Run a virtual restriction digest with EcoRI and simulate an agarose gel.
```

## MCP Server

To give external clients access to the loaded genome, start Electron with its authenticated MCP listener.

```bash
export CODEXOMICS_MCP_MASTER_KEY='replace-with-at-least-16-random-characters'
npm run start-with-mcp
```

To delegate natural-language requests to the configured ChatBox model, start the app in agent mode.

```bash
CODEXOMICS_MCP_MODE=agent npm run start-with-mcp
```

Use the Streamable HTTP endpoint and send the server key as a bearer token.

```json
{
  "mcpServers": {
    "CodeXomics": {
      "url": "http://127.0.0.1:3002/mcp",
      "transportType": "streamable-http",
      "headers": {
        "Authorization": "Bearer YOUR_CODEXOMICS_MCP_KEY"
      }
    }
  }
}
```

Tools mode is the default and filters tools by credential permissions. Agent mode exposes `codexomics_chat`, `list_genome_windows`, and `switch_active_window`. Standalone server development, scoped credentials, and legacy transports are covered in the [MCP Server Guide](docs/user-guides/MCP_SERVER_GUIDE.md).

## Architecture At A Glance

```text
CodeXomics/
├── src/
│   ├── main.js                    # Electron entry point
│   ├── main/                      # Extracted main-process modules
│   ├── preload.js                 # Context bridge and IPC surface
│   ├── version.js                 # Centralized application version
│   ├── mcp-server.js              # MCP server entry point
│   ├── mcp-tools/                 # MCP tool modules
│   ├── bioinformatics-tools/      # Standalone HTML analysis windows
│   └── renderer/
│       ├── index.html
│       ├── renderer-modular.js
│       ├── css/                   # Vanilla CSS and theme presets
│       └── modules/
│           ├── Agents/            # Multi-agent runtime
│           ├── chat/              # Chat services and constants
│           ├── core/              # Extension host infrastructure
│           ├── security/          # Sanitization and safety services
│           ├── tracks/            # Shared renderer infrastructure
│           └── benchmark-suites/  # AI benchmark suites
├── tools_registry/                # Dynamic YAML tool registry
├── packages/marketplace-server/   # Plugin marketplace server
├── docs/                          # MkDocs / GitHub Pages source
├── test/                          # Vitest unit and integration tests
├── scripts/                       # Build, version, and packaging scripts
├── Agents.md                      # AI coding-agent rules
├── Memory.md                      # Project architecture memory
└── mkdocs.yml                     # GitHub Pages configuration
```

## Tool Registry

The dynamic registry lives at the repository root in `tools_registry/`. Each tool has its own YAML schema with parameters, keywords, usage examples, and relationships. The registry manager retrieves relevant tools per query instead of injecting every capability into every prompt.

The [category definitions](tools_registry/tool_categories.yaml) describe how schemas are grouped. See [Agents.md](Agents.md#2-adding-or-changing-tools) for the current inventory and the checklist for keeping ChatBox and MCP tool contracts in sync.

## Documentation

GitHub Pages is built from `docs/` using MkDocs Material and configured by [mkdocs.yml](mkdocs.yml). Root-level project context is maintained in:

- [Agents.md](Agents.md) for AI coding-agent operating rules.
- [Memory.md](Memory.md) for architectural context and historical decisions.
- [docs/index.md](docs/index.md) for the public documentation landing page.

Do not edit generated `site/` output directly. Update files under `docs/` and rebuild Pages from source.

Install the documentation dependencies in a Python environment, then preview or validate the site.

```bash
python -m pip install 'mkdocs>=1.6,<2' mkdocs-material mkdocs-minify-plugin
npm run docs:serve      # Preview at http://127.0.0.1:8000
npm run docs:validate   # Check version/docs consistency and build strictly
```

The [Documentation workflow](.github/workflows/docs.yml) validates pull requests and publishes the site from `main`. See the [Developer Guide](docs/developer-guides/DEVELOPER_GUIDE.md#documentation) for editing and release conventions.

## Development

```bash
npm test                  # Vitest unit and integration suites
npm run lint              # ESLint
npm run version-validate  # Version consistency checks
npm run docs:validate     # Documentation consistency and strict MkDocs build
```

The project uses vanilla JavaScript, vanilla CSS, Electron, Node.js, D3, DOMPurify, NGL, js-yaml, Vitest, and npm workspaces. TypeScript, React, TailwindCSS, Bootstrap, and atomic CSS frameworks are not part of the application stack.

## Contributing

Before making code changes, read:

- [Agents.md](Agents.md) for repository-specific AI assistant rules.
- [Memory.md](Memory.md) for current architecture and project history.
- [Developer Guide](docs/developer-guides/DEVELOPER_GUIDE.md) for setup and extension points.

Use conventional commit messages. For documentation-only changes, prefer `docs(scope): summary`.

## License

CodeXomics is released under the [MIT License](LICENSE).
