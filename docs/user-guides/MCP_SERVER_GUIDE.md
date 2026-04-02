# CodeXomics MCP Server Guide

Welcome to the CodeXomics Model Context Protocol (MCP) Server integration guide! The CodeXomics MCP Server is a powerful bridge that gives external AI tools (like Claude Desktop, Cherry Studio, or Cursor) direct programmatic access to the bioinformatic tools, visualizations, and datasets inside your CodeXomics workspace.

## 🌟 What is the MCP Server?

Traditional AI assistants are trapped in a chat box and can't interact with your files. The **CodeXomics MCP Server** exposes the robust capabilities of the CodeXomics application over a standardized protocol. 

When you connect an MCP-compatible AI to this server, the AI gains the ability to:
- Retrieve nucleotide and protein sequences seamlessly.
- Automatically run analysis tools (e.g. sequence motifs, primers calculation, GC content).
- Search biological databases explicitly within your local bioinformatics contexts.

## 🚀 How to Start the MCP Server

You have two primary ways to run the MCP Server:

### Option A: Standalone Mode
If you only need the server running (without launching the full Electron App UI), run this from the project root:
```bash
npm run mcp-server
```

### Option B: Concurrent Mode (Recommended)
If you want to use the full CodeXomics interface alongside an external AI tool connected to the server, use:
```bash
npm run start-with-mcp
```
*This command starts both the MCP Server (usually on port `3002` or `3000`) and the Electron application simultaneously.*

## 🔌 Connecting to AI Clients

### 1. Claude Desktop
To add CodeXomics to your Claude Desktop capabilities, modify your Claude MCP settings file (`claude_desktop_config.json`). Add the following entry:

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
*(Make sure to replace `/ABSOLUTE/PATH/TO/` with the actual path to your repository).*

### 2. Cherry Studio
To use CodeXomics with Cherry Studio:
1. Open Cherry Studio Settings → **MCP Servers**.
2. Add a new server configuration.
3. Choose **Command** type.
4. Set Command: `node`
5. Set Arguments: `/ABSOLUTE/PATH/TO/CodeXomics/scripts/start-mcp-server.js`
6. Click Save and Ensure the status shows "Connected".

## 🛠️ Frequently Available Tools

Once connected, your AI assistant will inherently understand the `tools_registry` structure of CodeXomics and can call tools such as:
- **`get_sequence`**: Fetch specific sequences directly from active genome tracks.
- **`analyze_gc`**: Assess GC content/skew across nucleotide boundaries.
- **`search_sequence_motif`**: Find biological regex patterns natively.

> [!TIP]
> Tell your AI assistant: *"Analyze the sequence from chromosome 1 using your available CodeXomics tools"* and watch it autonomously invoke the MCP tools to return answers without copy-pasting sequences manually!
