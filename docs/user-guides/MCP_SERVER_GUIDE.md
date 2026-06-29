# CodeXomics MCP Server Guide

The CodeXomics Model Context Protocol (MCP) server lets external AI clients inspect and operate on CodeXomics genomes, tools, windows, and analysis workflows.

## Modes

| Mode       | How it behaves                                                                     | Exposed tools                                                    |
| ---------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Tools mode | External clients call specific CodeXomics tools directly.                          | 96 tools                                                         |
| Agent mode | External clients send natural-language prompts to the in-app ChatBox LLM pipeline. | `codexomics_chat`, `list_genome_windows`, `switch_active_window` |

Tools mode is the default. Agent mode is useful when you want CodeXomics to choose and sequence tools internally.

## Start The Server

From the repository root:

```bash
npm run mcp-server
```

Start agent mode:

```bash
npm run mcp-server -- --mode=agent
```

Start the Electron app and MCP server together:

```bash
npm run start-with-mcp
```

Default transports:

- HTTP/SSE: `http://localhost:3002`
- WebSocket: `ws://localhost:3003`

## Configure A Client

### HTTP/SSE Configuration

Use this configuration for clients that support remote HTTP/SSE MCP servers:

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

### Command Configuration

Use this configuration for clients that spawn a local process:

```json
{
  "mcpServers": {
    "codexomics": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/CodeXomics/scripts/start-mcp-server.js"]
    }
  }
}
```

Replace `/ABSOLUTE/PATH/TO/CodeXomics` with your local repository path.

## Agent Mode Configuration

For process-spawn clients, pass `--mode=agent`:

```json
{
  "mcpServers": {
    "codexomics-agent": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/CodeXomics/scripts/start-mcp-server.js", "--mode=agent"]
    }
  }
}
```

Agent mode requires a configured LLM provider in CodeXomics. If the ChatBox is already processing a request, agent mode returns a busy response instead of starting a second run.

## Common Tool Families

In tools mode, clients can access tool families for:

- Genome navigation and state inspection.
- Sequence retrieval, GC content, translation, reverse complement, molecular weight, motif search, restriction digest, and gel simulation.
- Primer design and primer annotation.
- Annotation CRUD and search.
- File loading/export and loaded-file inspection.
- BLAST, UniProt, InterPro, AlphaFold, PDB, and pathway workflows.
- Track settings.
- Sequence editing action queues.
- Benchmark control and result export.
- Multi-window discovery and focus.

## Example Prompts

Tools mode:

```text
Use get_sequence for the selected gene, then translate it.
Find restriction sites in the visible region.
Create a quick BLAST database for the current genome.
```

Agent mode:

```text
Analyze the operon around lacZ, collect supporting database evidence, and summarize the result.
```

## Troubleshooting

- Confirm the server process is running.
- Confirm ports `3002` and `3003` are available.
- For agent mode, confirm CodeXomics has a saved and working LLM configuration.
- If a tool needs genome state, keep the Electron app open and connected.
- If tool lists look stale after changing modes, restart the client or ask it to refresh MCP tools.
