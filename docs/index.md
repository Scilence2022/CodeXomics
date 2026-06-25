# CodeXomics

**AI-powered bioinformatics analysis platform**

[![Version](https://img.shields.io/badge/version-0.722.0-blue.svg)](https://github.com/Scilence2022/CodeXomics/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/Scilence2022/CodeXomics/blob/main/LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/Scilence2022/CodeXomics/releases)

CodeXomics is a cross-platform Electron workspace for genome visualization, AI-assisted biological analysis, plugin development, benchmark testing, and Model Context Protocol (MCP) integration.

The current source release is `0.722.0`, displayed as `v0.722` in the application. Published installers on GitHub Releases may lag behind the source tree.

<div class="grid cards" markdown>

- :material-rocket-launch:{ .lg .middle } **Get Started**

  ***

  Install CodeXomics, configure an AI provider, and load your first genome.

  [:octicons-arrow-right-24: Getting Started](user-guides/GETTING_STARTED.md)

- :material-book-open-variant:{ .lg .middle } **User Guide**

  ***

  Learn the genome browser, ChatBox, plugins, BLAST, and benchmark workflows.

  [:octicons-arrow-right-24: User Guide](user-guides/USER_GUIDE.md)

- :material-lan-connect:{ .lg .middle } **MCP Server**

  ***

  Connect CodeXomics tools to MCP-compatible clients in tools or agent mode.

  [:octicons-arrow-right-24: MCP Server](user-guides/MCP_SERVER_GUIDE.md)

- :material-code-tags:{ .lg .middle } **Developer Guide**

  ***

  Understand the source tree, tool registry, agents, plugins, and tests.

  [:octicons-arrow-right-24: Developer Guide](developer-guides/DEVELOPER_GUIDE.md)

</div>

## Current System Snapshot

| Area                   | Current state                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Application version    | `0.722.0` (`v0.722` display)                                                           |
| Runtime baseline       | Node.js 20/22 for source builds; Electron `41.7.1`                                     |
| Tool registry          | 185 YAML schemas across 19 active categories                                           |
| Built-in ChatBox tools | 149 mapped local tools                                                                 |
| MCP tools mode         | 95 tools exposed                                                                       |
| MCP agent mode         | `codexomics_chat`, `list_genome_windows`, `switch_active_window`                       |
| Runtime agents         | Coordinator, Analysis, Data, Navigation, External, Plugin, DeepResearch                |
| UI styling             | Vanilla CSS with default, professional, minimal, pastel, elegant, and midnight presets |

## Core Capabilities

!!! info "Production-readiness release"

    Version `0.722.0` adds secure credential storage, hardened renderer boundaries, structured logging and crash capture, auto-update support, stronger CI gates, and an Electron smoke-test harness. See the [v0.722.0 release notes](release-notes/RELEASE_NOTES_v0.722.md).

### Genome Visualization

- Load FASTA, GenBank, GFF/GTF, BED, VCF, SAM/BAM, WIG, KGML, and `.prj.GAI` projects.
- Explore genes, sequence, GC content/skew, variants, reads, protein data, pathway views, and custom annotation tracks.
- Use SVG and Canvas renderers for responsive browsing across dense genomic datasets.

### AI-Assisted Analysis

- Configure OpenAI, Anthropic, Google, DeepSeek, SiliconFlow, OpenRouter, or local LLM-compatible endpoints.
- Ask the ChatBox to navigate, search, analyze sequence content, design primers, run BLAST workflows, retrieve protein structures, and manage tasks.
- Use multi-agent routing for complex workflows that need decomposition and tool coordination.

### Extensibility

- Build plugins with the VS Code-inspired extension host and Plugin API `2.0.0`.
- Expose plugin functions to AI tool calling.
- Serve and test marketplace plugins through `packages/marketplace-server/`.

### MCP Integration

- Run CodeXomics as a standalone MCP server.
- Use tools mode for direct tool calls.
- Use agent mode when an external client should delegate natural-language prompts to the in-app AI pipeline.

## Screenshots

### Genome browser

Feature track, GC content and skew, multi-track WIG data, the gene details sidebar, and the protein/sequence view.

![Genome browser overview](figures/genome-browser-overview.png)

### Read alignment and references

Coverage and base-resolution sequencing-read tracks alongside gene references and operons in the side panel.

![Aligned reads and references](figures/reads-and-references.png)

Base-level read pileup over a selected gene:

![Read alignment pileup](figures/read-alignment-pileup.png)

### Protein structures

AlphaFold structure lookup and an interactive 3D protein viewer, driven from the AI ChatBox.

![AlphaFold protein structure viewer](figures/protein-structure-alphafold.png)

### Primer design

Designed primers rendered directly on the sequence view.

![Primer design on the sequence track](figures/primer-design.png)

## Documentation Map

| Section              | Start here                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------- |
| New users            | [Getting Started](user-guides/GETTING_STARTED.md)                                           |
| Daily usage          | [User Guide](user-guides/USER_GUIDE.md)                                                     |
| MCP clients          | [MCP Server Guide](user-guides/MCP_SERVER_GUIDE.md)                                         |
| Plugin users         | [Plugin Marketplace Guide](user-guides/PLUGIN_MARKETPLACE_GUIDE.md)                         |
| Developers           | [Developer Guide](developer-guides/DEVELOPER_GUIDE.md)                                      |
| AI coding assistants | [AI Assistant Guidelines](developer-guides/AI_ASSISTANT_GUIDELINES.md)                      |
| Architecture         | [Multi-Agent System](architecture/CodeXomics_Multi_Agent_System_Technical_Specification.md) |
| BLAST                | [BLAST Guide](reference/BLAST_GUIDE.md)                                                     |
| Benchmarks           | [Benchmark Methods](reference/BENCHMARK_METHODS.md)                                         |
| Current release      | [v0.722.0 Release Notes](release-notes/RELEASE_NOTES_v0.722.md)                             |

## Repository Links

- [GitHub Repository](https://github.com/Scilence2022/CodeXomics)
- [Issues](https://github.com/Scilence2022/CodeXomics/issues)
- [Discussions](https://github.com/Scilence2022/CodeXomics/discussions)
- [Releases](https://github.com/Scilence2022/CodeXomics/releases)
