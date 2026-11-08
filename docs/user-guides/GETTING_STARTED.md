# Getting Started With CodeXomics

This guide gets CodeXomics `0.723.0` running, connected to an AI provider, and ready to inspect genomic data.

## Requirements

| Resource | Minimum                               | Recommended                                                  |
| -------- | ------------------------------------- | ------------------------------------------------------------ |
| OS       | macOS, Windows, or Linux             | A current OS release and a package for your architecture    |
| Memory   | 6 GB RAM                              | 12 GB RAM or more                                            |
| Storage  | 1 GB for the app                      | Extra space for genomes, reads, BLAST databases, and plugins |
| Network  | Optional for local workflows          | Required for cloud LLMs and biological databases             |

Optional tools:

- An API key for your chosen cloud provider, if you want to use cloud AI.
- A local LLM server such as Ollama for offline or local model workflows.
- BLAST+ for local sequence alignment. CodeXomics includes BLAST setup and management workflows.

Building from source requires Node.js 22.12 or newer in the 22.x line and npm 10 or newer. The current source uses Electron `43.8.7`.

## Install

### Download A Release

Use the [GitHub Releases page](https://github.com/Scilence2022/CodeXomics/releases) and choose the build for your operating system.

Releases are published periodically, so the newest changes may only be available when you build from source. Check the version shown on a release before downloading.

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

1. Open `Options -> Configure LLM Providers`.
2. Select a provider tab.
3. Enter an API key or local endpoint.
4. Pick a model, or choose "Other (specify below)" for a custom model name.
5. Test the connection.
6. Save the provider configuration, then choose the provider and model on the **Default Model** tab.

Provider tabs include OpenAI, Anthropic, Google, DeepSeek, SiliconFlow, OpenRouter, MiniMax (Global and CN), Zhongkeyu, and **Custom Endpoint** for OpenAI-compatible servers. The ChatBox model selector can override the default for the current conversation.

## Load Data

Load the reference with **File → Load File → Genome File**, then choose the corresponding **Load File** entry for each supporting dataset.

| Data type           | Formats and entry points                                                   |
| ------------------- | -------------------------------------------------------------------------- |
| Genome sequence     | Nucleotide FASTA (`.fa`, `.fasta`, `.fas`, `.fna`) or GenBank (`.gb`, `.gbk`, `.gbff`, `.genbank`). Either may end in `.gz`. |
| Annotations         | GFF, GFF3, GTF, BED                                                        |
| Variants            | VCF                                                                        |
| Reads               | SAM or BAM. Keep the `.bai` or `.csi` index beside an indexed BAM.           |
| Quantitative tracks | WIG or BigWig (`.bw`, `.bigwig`)                                            |
| Pathways            | KGML in the pathway viewer                                                 |
| Projects            | `.prj.GAI` via **File → Open Project**                                     |

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

Start Electron with its authenticated MCP listener so external clients can work with a loaded genome.

```bash
export CODEXOMICS_MCP_MASTER_KEY='replace-with-at-least-16-random-characters'
npm run start-with-mcp
```

Connect to `http://127.0.0.1:3002/mcp` with `Authorization: Bearer <key>`. To delegate prompts to the ChatBox, launch in agent mode.

```bash
CODEXOMICS_MCP_MODE=agent npm run start-with-mcp
```

See the [MCP Server Guide](MCP_SERVER_GUIDE.md) for client configuration, scoped credentials, and the standalone server.

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
- Primer design, binding-site prediction, and the primer library.
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
| Run AI benchmarks             | [Benchmark Testing](USER_GUIDE.md#benchmark-testing)     |
| Install or develop plugins    | [Plugin Marketplace Guide](PLUGIN_MARKETPLACE_GUIDE.md)   |
| Contribute to the codebase    | [Developer Guide](../developer-guides/DEVELOPER_GUIDE.md) |

## Troubleshooting

- If AI calls fail, re-open `Options -> Configure LLM Providers`, test the provider, and verify the base URL.
- If file loading fails, confirm the file format and path are accessible to the Electron app.
- If MCP clients cannot connect, confirm the server is running and no other process is using ports `3002` or `3003`.
- If local BLAST is unavailable, use the built-in BLAST status/setup workflows.

For more detail, see the [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md).
