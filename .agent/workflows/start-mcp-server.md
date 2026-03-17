---
description: How to start the CodeXomics MCP Server for MCP Client
---

This workflow starts the CodeXomics MCP Server, which allows you to connect MCP Client to your local Genome Explorer instance.

1. Start the Claude MCP Server
   // turbo

```bash
npm run claude-mcp-server
```

### Next Steps for MCP Client Configuration

If this is your first time setting this up, you need to configure MCP Client to talk to this server.

1. Keep the server running (do not close the terminal).
2. Open your MCP Client config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
3. Add the following configuration:

```json
{
  "mcpServers": {
    "codexomics": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/GenomeAIStudio_1/scripts/start-claude-mcp-server.js"],
      "env": {}
    }
  }
}
```

_Note: Replace `/ABSOLUTE/PATH/TO/` with the actual full path to your repository._
