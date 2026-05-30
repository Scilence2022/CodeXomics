# LLM Context Overflow Protection Plan

## Problem

When tools like `fetch_alphafold_structure` or `fetch_protein_structure` return large data (e.g., 676KB PDB file), the full `pdbData` string is included in the conversation history sent to the LLM, causing a token overflow error (375K tokens > 98K limit). The existing `sanitizeResultForLLM` method handles some specific cases but does NOT handle `pdbData` or other arbitrarily large string fields.

## Root Cause Analysis

The problem occurs at two levels:

1. **Tool return values include raw large data** -- `ProteinService.fetchAlphaFoldStructure()` returns `pdbData` (full PDB text, up to ~1MB) inside the result object
2. **`sanitizeResultForLLM` has no general large-field guard** -- it only has tool-specific switch cases and truncates `sequence` strings >1000 chars, but misses `pdbData`, `codingSequence`, `proteinSequence`, and any future large fields

## Solution: Two-Layer Defense

### Layer 1: Tool Return Value Redesign (Source Fix)

Keep large raw data OUT of tool result objects. Instead, return metadata + a reference that downstream consumers can use to access the data.

**`ProteinService.fetchAlphaFoldStructure()`** (`src/renderer/modules/chat/services/ProteinService.js:59-122`)

- Store `pdbData` in a temporary cache (Map on ProteinService or ChatManager)
- Return metadata only: `{ success, tool, uniprotId, format, dataLength, downloadUrl, _dataRef: <cache_key>, timestamp, message }`
- Downstream consumer `openProteinViewer()` already calls `downloadAlphaFoldStructure()` separately, so it's not affected
- For MCP clients that need the actual data, add the `pdbData` only when the call comes through MCP (not through ChatManager LLM path)

**`ChatManager.fetchProteinStructure()`** (`src/renderer/modules/ChatManager.js:11936-11979`)

- Same pattern: store `pdbData` in cache, return `_dataRef` instead

### Layer 2: General Sanitizer Safety Net (Defense in Depth)

Enhance `sanitizeResultForLLM()` (`src/renderer/modules/ChatManager.js:5099-5196`) to handle any oversized string field:

1. **Add `pdbData`/`pdb_data` specific handling** -- Replace with `{ _omitted: true, length: N, note: "Full PDB data omitted to prevent context overflow. Use downloadUrl or _dataRef to access." }`
2. **Add general large-string truncation** -- Any string field exceeding a threshold (e.g., 5000 chars) gets truncated with a summary
3. **Add total result size budget** -- After sanitization, if `JSON.stringify(sanitizedResult)` still exceeds a max budget (e.g., 50KB), apply aggressive truncation to the largest fields

### Implementation Details

#### File 1: `src/renderer/modules/chat/services/ProteinService.js`

- Add a `_structureDataCache` Map to the class
- In `fetchAlphaFoldStructure()`: store `pdbData` in cache, return `_dataRef` key instead of raw data
- Add `getCachedStructureData(refKey)` method for consumers that need the raw data
- Add `clearStructureDataCache()` for memory management

#### File 2: `src/renderer/modules/ChatManager.js`

- In `fetchProteinStructure()` (line ~11936): same cache-and-ref pattern for PDB ID path
- In `downloadAlphaFoldStructure()` (line ~12109): keep as-is (used by `openProteinViewer` which doesn't go through LLM)
- In `downloadPDBFile()` (line ~11851): keep as-is (also used by `openProteinViewer`)
- In `openProteinViewer()`: if it receives a `_dataRef`, retrieve from cache; otherwise keep existing flow

#### File 3: `src/renderer/modules/ChatManager.js` -- `sanitizeResultForLLM()`

- Add `fetch_alphafold_structure` and `fetch_protein_structure` cases that remove `pdbData`
- Add general string-length guard (any field > 5000 chars gets truncated)
- Add total serialized size budget check (max 50KB per result)
- Add `codingSequence`, `proteinSequence` to the existing `sequence` truncation logic

#### File 4: `src/renderer/modules/ChatManager.js` -- conversation history insertion point

- At line ~4897 where `sanitizeResultForLLM` is called, add a final size check log warning if the sanitized result is still large

### Key Principle

The LLM never needs the raw PDB data -- it only needs to know the structure was fetched successfully and can reference metadata. The actual structure data is consumed by the 3D viewer (which gets it via cache or re-download), not by the LLM.

### Other Tools Potentially Affected

These tools also return large data that should be reviewed:

- `get_coding_sequence` / `get_sequence` -- already handled by `sequence` truncation
- `export_fasta_sequence` / `export_current_view_fasta` -- could return very long sequences
- `blast_search` -- could return large result sets
- `get_annotation_data` / `list_annotations` -- could return many annotations

The general string-length guard in Layer 2 will catch all of these automatically.
