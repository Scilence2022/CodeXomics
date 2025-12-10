# External API Tools - Quick Reference

## 🔍 Problem: "Unknown tool" error for external API tools

If you encounter this error:
```
Error: Unknown tool: <tool_name>
🎯 Total tools found: 0
```

This means you're trying to use an **external API tool** that requires an **MCP server connection**.

## ✅ Quick Solution

### Step 1: Identify Tool Type
Check the tool's YAML definition in `/tools_registry/`:

```yaml
execution:
  type: server  # ← Tool requires MCP server
  requires_network: true
```

### Step 2: Connect MCP Server
- Ensure an MCP server providing this tool is configured and connected
- Check MCP server status in application settings
- Verify network connectivity

### Step 3: Verify Error Message
After the fix, you should see:
```
Tool "<tool_name>" requires an MCP server connection.
Please ensure the appropriate MCP server is connected.
Category: <category>, Requires network: <true/false>
```

## 📋 Common External API Tools

These tools require MCP server connections:

- `blast_sequence` - Perform BLAST search on DNA sequence
- `blast_protein` - BLAST search for protein sequences  
- `blast_search` - General BLAST search interface
- Other external APIs as defined in `/tools_registry/external_apis/`

## 🔧 For Developers: Adding New External API Tools

### 1. Create YAML Definition
```yaml
name: your_tool_name
version: 1.0.0
description: Tool description
category: external_apis
execution:
  type: server          # REQUIRED for external APIs
  timeout: 60000
  requires_network: true
  requires_auth: false
parameters:
  type: object
  properties:
    # Define parameters
```

### 2. Tool Registration Flow
External API tools follow this execution path:

```
LLM calls tool
  ↓
ChatManager.executeToolByName()
  ↓
1. Check MCP servers (getAllAvailableTools)
  ↓ 
2. If found → Execute on MCP server
  ↓
3. If NOT found → Check registry for tool requirements
  ↓
4. If execution.type === 'server' → Throw clear MCP requirement error
  ↓
5. Otherwise → Continue to plugin/built-in checks
```

### 3. No Additional Code Required!
The fix automatically handles external API tools through the registry.
Just ensure your YAML has `execution.type: server`.

## 🎯 Testing External API Tool Integration

Use the test file:
```bash
# Open in application browser
open test-blast-sequence-fix.html
```

Or test programmatically:
```javascript
// Check if tool requires MCP
const toolDef = await chatManager.dynamicTools.registryManager
    .getToolDefinition('blast_sequence');

console.log('Execution type:', toolDef.execution.type);
// Output: "server" (requires MCP)

// Try to execute (will show clear error if no MCP)
try {
    await chatManager.executeToolByName('blast_sequence', {...});
} catch (error) {
    console.error(error.message);
    // "Tool 'blast_sequence' requires an MCP server connection..."
}
```

## 📚 Related Documentation

- Full fix details: `/docs/fix-summaries/blast/BLAST_SEQUENCE_TOOL_EXECUTION_FIX.md`
- Tool registry guide: `/tools_registry/README.md`
- MCP integration: `/docs/MCP_INTEGRATION_GUIDE.md`

---
**Last Updated:** December 10, 2024
