# Getting Started With CodeXomics

This guide gets CodeXomics `0.722.0` running, connected to an AI provider, and ready to inspect genomic data. The application displays this release as `v0.722`.

## Requirements

| Resource | Minimum                               | Recommended                                                  |
| -------- | ------------------------------------- | ------------------------------------------------------------ |
| OS       | macOS 10.15, Windows 10, Ubuntu 20.04 | Current stable release                                       |
| Memory   | 6 GB RAM                              | 12 GB RAM or more                                            |
| Storage  | 1 GB for the app                      | Extra space for genomes, reads, BLAST databases, and plugins |
| Network  | Optional for local workflows          | Required for cloud LLMs and biological databases             |

Optional tools:

- An API key for OpenAI, Anthropic, Google, DeepSeek, SiliconFlow, OpenRouter, or another OpenAI-compatible endpoint.
- A local LLM server such as Ollama for offline or local model workflows.
- BLAST+ for local sequence alignment. CodeXomics includes BLAST setup and management workflows.

Building from source requires Node.js 20 or 22 and npm 10 or newer. The packaged application uses Electron `41.7.1`.

## Install

### Download A Release

Use the [GitHub Releases page](https://github.com/Scilence2022/CodeXomics/releases) and choose the build for your operating system.

Published installers may lag behind the current source release. Check the release title and artifact version before downloading.

### Build From Source

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

## First Launch

On launch, CodeXomics opens the main genome workspace. The primary areas are:

- Header/menu controls for files, tools, settings, and windows.
- Central genome browser with genomic tracks.
- Side panels for gene details, ChatBox, file/project state, and settings.
- Optional standalone tool windows for pathway, protein, BLAST, downloader, and marketplace workflows.

## Configure AI

AI features are optional, but they enable natural-language analysis and multi-agent tool execution.

1. Open `Options -> Configure LLMs`.
2. Select a provider tab.
3. Enter an API key or local endpoint.
4. Pick a model, or choose "Other (specify below)" for a custom model name.
5. Test the connection.
6. Save the configuration.

Supported provider families include OpenAI, Anthropic, Google, DeepSeek, SiliconFlow, OpenRouter, and local OpenAI-compatible endpoints.

## Load Data

Use `File -> Load File` to load a genome or supporting dataset.

| Data type           | Formats                        |
| ------------------- | ------------------------------ |
| Genome sequence     | FASTA, GenBank (`.gb`, `.gbk`) |
| Annotations         | GFF, GFF3, GTF, BED            |
| Variants            | VCF                            |
| Reads               | SAM, BAM                       |
| Quantitative tracks | WIG, BigWig, BedGraph          |
| Pathways            | KGML                           |
| Projects            | `.prj.GAI`                     |

After loading data, use the browser controls to zoom, pan, search features, select genes, and toggle tracks.

## Ask The ChatBox

Open the ChatBox and ask direct analysis questions:

```text
Find all ribosomal genes.
Zoom to dnaA.
Calculate GC content in the visible region.
Translate the selected CDS.
Design primers for lacZ.
Search UniProt for the selected gene.
Create a quick BLAST database from the current genome.
List the currently loaded files.
```

The assistant selects relevant tools dynamically from the registry. Complex requests can be routed through the multi-agent system when enabled.

## Use MCP Clients

Start the standalone MCP server:

```bash
npm run mcp-server
```

Or run agent mode:

```bash
npm run mcp-server -- --mode=agent
```

Default endpoints:

- HTTP/SSE: `http://localhost:3002`
- WebSocket: `ws://localhost:3003`

See the [MCP Server Guide](MCP_SERVER_GUIDE.md) for client configuration.

## Work With Projects

Projects store workspace state and associated files in `.prj.GAI` format.

Common project actions:

- Create a new project from the File menu.
- Open an existing project with `File -> Open Project`.
- Save project state after loading genomes, annotations, reads, and analysis outputs.

## Explore Built-In Tools

Common workflows:

- Genome navigation and search.
- Sequence analysis, GC content, translation, restriction digest, and gel simulation.
- Primer design and binding-site annotation.
- BLAST database creation and sequence search.
- UniProt, InterPro, AlphaFold, PDB, KEGG, GO, DAVID, STRING, Reactome, and NCBI helper windows.
- Benchmark execution and result export.
- Plugin marketplace install, enable, disable, and function execution.

## Next Steps

| Goal                          | Guide                                                     |
| ----------------------------- | --------------------------------------------------------- |
| Learn the main interface      | [User Guide](USER_GUIDE.md)                               |
| Configure external clients    | [MCP Server Guide](MCP_SERVER_GUIDE.md)                   |
| Run local alignment workflows | [BLAST Guide](../reference/BLAST_GUIDE.md)                |
| Install or develop plugins    | [Plugin Marketplace Guide](PLUGIN_MARKETPLACE_GUIDE.md)   |
| Contribute to the codebase    | [Developer Guide](../developer-guides/DEVELOPER_GUIDE.md) |

## Troubleshooting

- If AI calls fail, re-open `Options -> Configure LLMs`, test the provider, and verify the base URL.
- If file loading fails, confirm the file format and path are accessible to the Electron app.
- If MCP clients cannot connect, confirm the server is running and no other process is using ports `3002` or `3003`.
- If local BLAST is unavailable, use the built-in BLAST status/setup workflows.

For more detail, see the [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md).
