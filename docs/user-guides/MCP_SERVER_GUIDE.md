# CodeXomics MCP Server Guide

The CodeXomics Model Context Protocol (MCP) server lets external AI clients inspect and operate on CodeXomics genomes, tools, windows, and analysis workflows.

## Modes

| Mode       | How it behaves                                                                     | Exposed tools                                                    |
| ---------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Tools mode | External clients call specific CodeXomics tools directly.                          | Current registry, filtered to the authenticated key's scopes     |
| Agent mode | External clients send natural-language prompts to the in-app ChatBox LLM pipeline. | `codexomics_chat`, `list_genome_windows`, `switch_active_window` |

Tools mode is the default. Agent mode lets CodeXomics choose and sequence tools internally.

## Start The Server

Authentication is fail-closed. Configure either a master key or scoped API keys before starting the network server. The master key is an administrative credential with access to every tool:

```bash
export CODEXOMICS_MCP_MASTER_KEY='replace-with-at-least-16-random-characters'
```

From the repository root, start Electron with its MCP listener to give clients access to the genome workspace.

```bash
npm run start-with-mcp
```

The listener runs inside Electron and routes genome calls through main-process IPC. Use the standalone listener for server-side development and tools that can run without a genome window.

```bash
npm run mcp-server
```

The combined launcher exits with a non-zero status if authentication is invalid or a listener fails to start.

Default transports:

- Streamable HTTP: `http://localhost:3002/mcp`
- Legacy SSE: `http://localhost:3002/sse`
- WebSocket: `ws://localhost:3003`

Streamable HTTP is preferred for new clients. Legacy SSE streams receive authenticated keepalives, close when their authentication session expires or sustained backpressure indicates a non-reading client, and are capped at 64 concurrent streams globally and 8 per credential principal.

All network transports bind to `127.0.0.1` by default. Setting `CODEXOMICS_MCP_ENABLE_LOCAL_BYPASS=true` disables bearer authentication for local development and must not be used on a shared or production host.

## Configure A Client

### HTTP/SSE Configuration

Use this configuration for clients that support remote HTTP/SSE MCP servers:

```json
{
  "mcpServers": {
    "CodeXomics": {
      "url": "http://localhost:3002/mcp",
      "transportType": "streamable-http",
      "headers": {
        "Authorization": "Bearer YOUR_CODEXOMICS_MCP_KEY"
      }
    }
  }
}
```

`scripts/start-mcp-server.js` starts the network transports above; it is not a stdio MCP transport. Start it separately with `npm run mcp-server`, then configure the client with the HTTP URL.

### Scoped annotation credentials

For autonomous annotation, use separate research and curator identities rather than giving an unattended agent the master key:

```bash
export CODEXOMICS_MCP_API_KEYS_JSON='{
  "research-agent": {
    "apiKey": "replace-with-a-long-research-agent-key",
    "permissions": ["annotation:read", "annotation:research", "annotation:propose"]
  },
  "curator": {
    "apiKey": "replace-with-a-different-long-curator-key",
    "permissions": ["annotation:read", "annotation:approve", "annotation:commit"]
  }
}'
```

Non-admin scoped keys can call only mapped annotation tools. See [Autonomous Annotation Workflow](../developer-guides/AUTONOMOUS_ANNOTATION.md) for the complete scope map, DGR setup, approval separation, and recovery behavior.

## Agent Mode Configuration

Set `CODEXOMICS_MCP_MODE=agent` for the Electron launcher, then connect to the same authenticated HTTP endpoint.

```bash
export CODEXOMICS_MCP_MASTER_KEY='replace-with-at-least-16-random-characters'
CODEXOMICS_MCP_MODE=agent npm run start-with-mcp
```

Agent mode requires a configured LLM provider in CodeXomics. If the ChatBox is already processing a request, agent mode returns a busy response instead of starting a second run.

## Request deadlines and cancellation

Tools mode gives a request up to 30 seconds. Agent mode allows up to 120
seconds. The SDK's legacy SSE transport and modern HTTP clients that return
the session ID from initialization can explicitly cancel a request. The
server forwards cancellation and deadline expiry to the matching Electron or
internal WebSocket execution. ChatBox uses that signal to stop the matching
model request.

File export and reviewed annotation commits check their write deadlines again
before persistence. A cancelled call may have already written a result.
For annotation commits, retry the same ChangeSet to retrieve an existing
receipt. A polling bridge can stop offering expired work to its client.
An operation already picked up by that bridge follows the client's own
cancellation behavior.

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
- Confirm `CODEXOMICS_MCP_MASTER_KEY` or `CODEXOMICS_MCP_API_KEYS_JSON` was configured before startup and that the client sends `Authorization: Bearer <key>`.
- Confirm ports `3002` and `3003` are available.
- For agent mode, confirm CodeXomics has a saved and working LLM configuration.
- If a tool needs genome state, keep the Electron app open and connected.
- If tool lists look stale after changing modes, restart the client or ask it to refresh MCP tools.
