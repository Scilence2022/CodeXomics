# CodeXomics

**AI-powered bioinformatics analysis platform**

[![Version](https://img.shields.io/badge/version-0.7.0--beta-blue.svg)](https://github.com/Scilence2022/CodeXomics/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/Scilence2022/CodeXomics/blob/main/LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/Scilence2022/CodeXomics/releases)

CodeXomics is a cross-platform Electron workspace for genome visualization, AI-assisted biological analysis, plugin development, benchmark testing, and Model Context Protocol (MCP) integration.

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
| Application version    | `0.7.0-beta` (`v0.7beta` display)                                                      |
| Tool registry          | 180 YAML schemas across 18 active categories                                           |
| Built-in ChatBox tools | 143 mapped local tools                                                                 |
| MCP tools mode         | 95 tools exposed                                                                       |
| MCP agent mode         | `codexomics_chat`, `list_genome_windows`, `switch_active_window`                       |
| Runtime agents         | Coordinator, Analysis, Data, Navigation, External, Plugin, DeepResearch                |
| UI styling             | Vanilla CSS with default, professional, minimal, pastel, elegant, and midnight presets |

## Core Capabilities

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

## Repository Links

- [GitHub Repository](https://github.com/Scilence2022/CodeXomics)
- [Issues](https://github.com/Scilence2022/CodeXomics/issues)
- [Discussions](https://github.com/Scilence2022/CodeXomics/discussions)
- [Releases](https://github.com/Scilence2022/CodeXomics/releases)
