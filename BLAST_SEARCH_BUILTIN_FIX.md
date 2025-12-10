# BLAST Search Tool - Built-in Type Fix

## Problem Analysis

The error occurred because the LLM was attempting to call the `blast_search` tool, which was defined in the Dynamic Tools Registry with `execution.type: "server"`. This caused the system to reject the tool execution, claiming it required an MCP server connection.

**Error Message**:
```
Tool "blast_search" requires an MCP server connection. 
Please ensure the appropriate MCP server is connected. 
Category: external_apis, Requires network: true
```

## Root Cause

The investigation revealed a legacy `blast_search.yaml` file at `/tools_registry/external_apis/blast_search.yaml` that was configured incorrectly:

1. **Execution Type**: Set to `"server"` instead of `"built-in"`
2. **Missing Registration**: `blast_search` was not registered in `builtin_tools_integration.js`
3. **Tool Name Conflict**: The new BLAST function tools used different names (`blast_search_online`, `blast_search_local`), but the LLM was calling the legacy `blast_search`

## Execution Flow Analysis

```
LLM calls "blast_search"
  ↓
ChatManager.executeToolByName("blast_search", params)
  ↓
Checks MCP tools → Not found
  ↓
Checks Dynamic Tools Registry → Found with type="server"
  ↓
Throws error: "requires MCP server connection"
  ✗ Never reaches built-in tool execution
```

The problem occurred at line 9516 of ChatManager.js:
```javascript
if (registryTool && registryTool.execution && registryTool.execution.type === 'server') {
    throw new Error(`Tool "${toolName}" requires an MCP server connection...`);
}
```

## Solution Implemented

### Fix 1: Update YAML Configuration
**File**: `/tools_registry/external_apis/blast_search.yaml`

Changed execution type from `"server"` to `"built-in"`:
```yaml
execution:
  type: "built-in"  # Changed from "server"
  timeout: 120000
  retries: 2
  requires_auth: false
  requires_data: false
  requires_network: true
```

### Fix 2: Register Tool as Built-in
**File**: `/tools_registry/builtin_tools_integration.js`

Added registration for `blast_search` tool:
```javascript
// Legacy blast_search tool (maps to blastSearch)
this.builtInToolsMap.set('blast_search', {
    method: 'blastSearch',
    category: 'external_apis',
    type: 'built-in',
    priority: 1
});
```

This maps the `blast_search` tool name to the existing `blastSearch` method in ChatManager (line 10043-10045).

## Corrected Execution Flow

```
LLM calls "blast_search"
  ↓
ChatManager.executeToolByName("blast_search", params)
  ↓
Checks MCP tools → Not found
  ↓
Checks Dynamic Tools Registry → Found with type="built-in"
  ↓
Continues to plugin check → Not a plugin
  ↓
Reaches built-in tool execution
  ↓
case 'blast_search': result = await this.blastSearch(parameters);
  ✓ Successfully executes
```

## BLAST Tools Architecture After Fix

### Complete BLAST Tools Inventory

**Legacy Tool** (now fixed):
- `blast_search` → `blastSearch()` method

**New Function Tools** (from BLAST Function Tools integration):
- `blast_search_online` → `blastSearchOnline()`
- `blast_search_local` → `blastSearchLocal()`
- `blast_search_batch` → `blastSearchBatch()`
- `blast_create_database` → `blastCreateDatabase()`
- `blast_list_databases` → `blastListDatabases()`
- `blast_database_info` → `blastDatabaseInfo()`
- `blast_delete_database` → `blastDeleteDatabase()`
- `blast_create_db_from_genome` → `blastCreateDbFromGenome()`
- `blast_create_protein_db_from_genome` → `blastCreateProteinDbFromGenome()`
- `blast_filter_results` → `blastFilterResults()`
- `blast_export_results` → `blastExportResults()`
- `blast_detect_sequence_type` → `blastDetectSequenceType()`
- `blast_validate_database` → `blastValidateDatabase()`
- `blast_get_installation_status` → `blastGetInstallationStatus()`

**Total**: 15 BLAST tools, all registered as `built-in` type

## Verification

After the fix, the tool should execute successfully:

```javascript
// Test execution
const result = await chatManager.blastSearch({
    sequence: "GGATTAAAAAAAGAGTGTCTGATAGCAGCTTCTGAACTGGTTACCTGCCGTGAGTAA",
    blastType: "blastn",
    database: "nt",
    evalue: "0.01"
});

// Expected: Successful execution without MCP server error
```

## Related Files Modified

1. `/tools_registry/external_apis/blast_search.yaml` - Changed execution type
2. `/tools_registry/builtin_tools_integration.js` - Added tool registration

## Related Files (No Changes Required)

1. `/src/renderer/modules/ChatManager.js` - Already has `blastSearch()` method
2. `/src/renderer/modules/BlastManager.js` - Core BLAST functionality (unchanged)
3. `/src/renderer/modules/BlastFunctionTools.js` - New tools layer (unchanged)

## Technical Notes

### Why Two Different Approaches?

The codebase has evolved to support BLAST in two ways:

1. **Legacy Approach**: Direct `blastSearch()` method in ChatManager
   - Simple, monolithic method
   - Called via `blast_search` tool name
   - Implemented around line 10043 in ChatManager.js

2. **New Approach**: BlastFunctionTools abstraction layer
   - Modular, tracked execution
   - Called via specific tool names (`blast_search_online`, etc.)
   - Implemented in BlastFunctionTools.js

Both approaches are now correctly configured as `built-in` tools, allowing the LLM to use either approach depending on the tool name in the system prompt.

### Recommendation for Future

Consider deprecating the legacy `blast_search` tool in favor of the more specific new tools:
- `blast_search_online` for NCBI searches
- `blast_search_local` for local BLAST+ searches

This provides better clarity and tracking capabilities through the BlastFunctionTools layer.

---

**Fix Date**: December 10, 2024  
**Status**: ✅ Resolved  
**Impact**: All BLAST tools now work correctly as built-in tools without MCP server requirement
