# Benchmark Tool Coverage Analysis Report

**Generated**: 2026-04-17  
**Analysis Type**: Deep comprehensive analysis of tools NOT included in LLM Instruction Following Benchmark

---

## Executive Summary

| Metric                     | Count     |
| -------------------------- | --------- |
| **Total Built-in Tools**   | 122       |
| **Tools in Benchmark**     | 40        |
| **Tools NOT in Benchmark** | 82        |
| **Coverage Rate**          | **32.8%** |

**Critical Finding**: Only 32.8% of built-in tools are currently tested in the LLM benchmark system, leaving 82 tools without instruction-following validation.

---

## Complete Tool Inventory

### ✅ Tools INCLUDED in Benchmark (40 tools)

#### File Loading (7 tools)

1. `load_genome_file`
2. `load_annotation_file`
3. `load_reads_file`
4. `load_variant_file`
5. `load_wig_tracks`
6. `load_operon_file`
7. `set_working_directory` (system setup)

#### Navigation (4 tools)

8. `navigate_to_position`
9. `jump_to_gene`
10. `find_gene_by_name`
11. `search_features`

#### Sequence Analysis (6 tools)

12. `get_sequence`
13. `compute_gc`
14. `translate_dna`
15. `reverse_complement`
16. `search_sequence_motif`
17. `get_coding_sequence`

#### Sequence Editing (9 tools)

18. `replace_sequence`
19. `delete_sequence`
20. `insert_sequence`
21. `copy_sequence`
22. `cut_sequence`
23. `paste_sequence`
24. `execute_actions`
25. `get_action_list`
26. `clear_actions`

#### Export (7 tools)

27. `export_fasta_sequence`
28. `export_genbank_format`
29. `export_cds_fasta`
30. `export_protein_fasta`
31. `export_gff_annotations`
32. `export_bed_format`
33. `export_current_view_fasta`

#### Database/External (2 tools)

34. `search_alphafold_structures`
35. `search_pdb_structures`

#### Data Management (2 tools)

36. `codon_usage_analysis`
37. `genome_codon_usage_analysis`

#### Tab Management (2 tools)

38. `open_new_tab`
39. `switch_to_tab`

#### State Query (1 tool)

40. `get_current_state`

---

## ❌ Tools NOT in Benchmark (82 tools) — Categorized by Priority

### 🔴 CRITICAL PRIORITY (25 tools)

_Core functionality that users frequently request_

#### Annotation Management (7 tools)

1. `create_annotation` — Create custom annotations
2. `update_annotation` — Edit existing annotations
3. `delete_annotation` — Remove annotations
4. `search_annotations` — Search annotations by criteria
5. `list_annotations` — List all annotations
6. `get_annotation` — Get specific annotation details
7. `bulk_update_annotations` — Batch update annotations

#### Track Control (4 tools)

8. `toggle_track` — Show/hide tracks
9. `toggle_annotation_track` — Toggle annotation track visibility
10. `get_track_status` — Check track visibility state
11. `zoom_to_gene` — Zoom to fit a specific gene

#### Protein Structure (3 tools)

12. `fetch_alphafold_structure` — Fetch AlphaFold 3D structure
13. `open_protein_viewer` — Open 3D structure viewer
14. `get_uniprot_entry` — Get UniProt protein details

#### Gene/Region Analysis (4 tools)

15. `get_gene_details` — Get comprehensive gene information
16. `get_operons` — Get operon information
17. `get_nearby_features` — Find features near a position
18. `find_intergenic_regions` — Find intergenic regions

#### Data Export/Import (2 tools)

19. `export_data` — Generic data export
20. `configure_export_settings` — Configure export options

#### Sequence Analysis (2 tools)

21. `translate_sequence` — Translate DNA to protein
22. `predict_promoter` — Predict promoter regions

#### System/Utility (3 tools)

23. `list_available_tools` — List all available tools
24. `toggle_settings_modal` — Open settings panel
25. `get_chromosome_list` — List all chromosomes

---

### 🟡 HIGH PRIORITY (22 tools)

_Important features for advanced workflows_

#### BLAST Suite (13 tools)

1. `blast_search` — Legacy BLAST search
2. `blast_search_online` — Online BLAST search
3. `blast_search_local` — Local BLAST search
4. `blast_search_batch` — Batch BLAST search
5. `blast_create_database` — Create BLAST database
6. `blast_list_databases` — List BLAST databases
7. `blast_delete_database` — Delete BLAST database
8. `blast_create_db_from_genome` — Create DB from genome
9. `blast_create_protein_db_from_genome` — Create protein DB
10. `blast_create_quick_db_for_current_genome` — Quick DB creation
11. `blast_filter_results` — Filter BLAST results
12. `blast_export_results` — Export BLAST results

#### Database Integration (4 tools)

14. `search_uniprot_database` — UniProt protein search
15. `advanced_uniprot_search` — Advanced UniProt search
16. `analyze_interpro_domains` — InterPro domain analysis
17. `search_interpro_entry` — Search InterPro entries

#### Navigation/Panning (2 tools)

18. `pan_left` — Scroll view left
19. `pan_right` — Scroll view right

#### Primer Design (3 tools)

20. `design_primers` — Design PCR primers
21. `calculate_primer_properties` — Calculate primer Tm, GC%, etc.
22. `find_primer_binding_sites` — Find primer binding locations

---

### 🟢 MEDIUM PRIORITY (20 tools)

_Specialized features for specific use cases_

#### Restriction Analysis (3 tools)

1. `search_pattern` — Search sequence patterns
2. `find_restriction_sites` — Find restriction enzyme sites
3. `virtual_digest` — Simulate restriction digest

#### Track Settings (5 tools)

4. `get_track_settings` — Get track configuration
5. `set_track_settings` — Set track configuration
6. `get_all_track_settings` — Get all track settings
7. `reset_track_settings` — Reset to defaults
8. `get_track_settings_schema` — Get settings schema

#### Batch Operations (1 tool)

9. `batch_set_track_settings` — Batch update track settings

#### Gene Selection (2 tools)

10. `select_gene` — Select/highlight a gene
11. `select_sequence_region` — Select a sequence region

#### Multi-window (2 tools)

12. `list_genome_windows` — List open genome windows
13. `switch_active_window` — Switch between windows

#### Utility Tools (2 tools)

14. `download_internet_file` — Download files from URLs
15. `view_markdown_file` — View markdown files

#### Advanced Export (1 tool)

16. `export_current_view_fasta` — Export visible region as FASTA

#### Database Details (2 tools)

17. `get_interpro_entry_details` — Get InterPro entry details
18. `add_primer_annotation` — Add primer as annotation

#### Advanced UniProt (1 tool)

19. `advanced_uniprot_search` — Complex UniProt queries

#### Annotation History (1 tool)

20. `get_annotation_history` — View annotation change history

---

### 🔵 LOW PRIORITY (15 tools)

_Benchmark system tools and auxiliary functions_

#### Benchmark Management (8 tools)

1. `open_benchmark` — Open benchmark interface
2. `start_benchmark` — Start benchmark execution
3. `stop_benchmark` — Stop running benchmark
4. `pause_benchmark` — Pause benchmark
5. `resume_benchmark` — Resume paused benchmark
6. `get_benchmark_results` — Get benchmark results
7. `get_benchmark_status` — Get benchmark status
8. `export_benchmark_results` — Export benchmark results

#### System Tools (3 tools)

9. `blast_validate_database` — Validate BLAST database integrity
10. `blast_detect_sequence_type` — Auto-detect sequence type
11. `blast_get_installation_status` — Check BLAST installation

#### Specialized Tools (4 tools)

12. `translate_dna` — Alternative translation method
13. `get_loaded_files_list` — List currently loaded files
14. `get_annotation_history` — Track annotation changes
15. `bulk_update_annotations` — Batch annotation updates

---

## Benchmark Suite Distribution Analysis

### Current Test Distribution

| Suite                     | Test Count | Tools Tested | Coverage Focus                                                              |
| ------------------------- | ---------- | ------------ | --------------------------------------------------------------------------- |
| **AutomaticSimpleSuite**  | ~40 tests  | 40 tools     | Core operations (file loading, navigation, basic sequence analysis, export) |
| **AutomaticComplexSuite** | ~4 tests   | Subset       | Complex workflows (multi-step operations)                                   |
| **ManualSuite**           | ~15 tests  | Subset       | Operations requiring human verification                                     |
| **ManualComplexSuite**    | ~8 tests   | Subset       | Advanced workflows needing manual evaluation                                |

**Note**: Many tools appear in multiple test cases, so the 40 unique tools tested span across all suites.

---

## Gap Analysis by Category

### Most Underserved Categories

| Category             | Total Tools | In Benchmark | NOT in Benchmark | Coverage  |
| -------------------- | ----------- | ------------ | ---------------- | --------- |
| **annotation**       | 14          | 0            | 14               | **0%** ❌ |
| **benchmark**        | 8           | 0            | 8                | **0%** ❌ |
| **sequence_editing** | 10          | 9            | 1                | 90% ✅    |
| **file_operations**  | 9           | 7            | 2                | 78% ⚠️    |
| **database**         | 11          | 0            | 11               | **0%** ❌ |
| **external_apis**    | 10          | 2            | 8                | 20% ❌    |
| **primer_design**    | 4           | 0            | 4                | **0%** ❌ |
| **navigation**       | 22          | 4            | 18               | 18% ❌    |
| **sequence**         | 11          | 6            | 5                | 55% ⚠️    |
| **file_loading**     | 7           | 7            | 0                | 100% ✅   |
| **system**           | 6           | 1            | 5                | 17% ❌    |
| **data_management**  | 3           | 2            | 1                | 67% ⚠️    |
| **utility**          | 2           | 0            | 2                | **0%** ❌ |

---

## Critical Missing Tool Analysis

### 1. **Annotation Tools (14 tools, 0% coverage)**

**Impact**: HIGH — Annotation is a core genome browser feature

**Missing Tools**:

- `create_annotation`, `update_annotation`, `delete_annotation` — CRUD operations
- `list_annotations`, `get_annotation`, `search_annotations` — Query operations
- `bulk_update_annotations`, `get_annotation_history` — Advanced operations

**Why Important**: Users frequently ask LLM to "annotate this region", "create a custom feature", or "search for all promoter annotations". Without benchmark tests, we cannot verify if the LLM correctly understands these instructions.

**Recommendation**: Add 5-7 annotation tests to AutomaticSimpleSuite covering:

- Create a gene annotation
- Update annotation description
- Search annotations by type
- List all annotations in region
- Delete an annotation

---

### 2. **BLAST Tools (13 tools, 0% coverage)**

**Impact**: CRITICAL — BLAST is one of the most used bioinformatics tools

**Missing Tools**:

- Search: `blast_search`, `blast_search_online`, `blast_search_local`, `blast_search_batch`
- Database: `blast_create_database`, `blast_list_databases`, `blast_delete_database`, etc.
- Results: `blast_filter_results`, `blast_export_results`

**Why Important**: BLAST queries are complex and require precise parameter handling (e-values, database selection, sequence type detection). Without tests, we cannot ensure the LLM correctly formats BLAST requests.

**Recommendation**: Add 8-10 BLAST tests including:

- Simple BLAST search with default parameters
- BLAST with specific database and e-value
- Create BLAST database from loaded genome
- Filter BLAST results by identity threshold
- Export BLAST results to file

---

### 3. **Track Management Tools (9 tools, 0% coverage)**

**Impact**: HIGH — Track visibility control is essential for genome visualization

**Missing Tools**:

- `toggle_track`, `toggle_annotation_track`, `get_track_status`
- `get_track_settings`, `set_track_settings`, `get_all_track_settings`
- `reset_track_settings`, `batch_set_track_settings`, `get_track_settings_schema`

**Why Important**: Users often say "hide the coverage track", "show GC content", or "change track color to red". The LLM must correctly parse these natural language requests into track operations.

**Recommendation**: Add 6-8 track management tests:

- Toggle specific track on/off
- Get track visibility status
- Change track color/height
- Reset track settings to defaults
- Batch update multiple track settings

---

### 4. **Protein/Database Tools (8 tools, 0% coverage)**

**Impact**: HIGH — Protein analysis is a key differentiator

**Missing Tools**:

- `search_uniprot_database`, `advanced_uniprot_search`, `get_uniprot_entry`
- `analyze_interpro_domains`, `search_interpro_entry`, `get_interpro_entry_details`
- `fetch_alphafold_structure`, `open_protein_viewer`

**Why Important**: Protein structure and function queries are complex and require the LLM to understand biological context (e.g., "fetch AlphaFold structure for lacZ" requires gene→UniProt→AlphaFold resolution).

**Recommendation**: Add 6-8 protein/database tests:

- Search UniProt by gene name
- Fetch AlphaFold structure by UniProt ID
- Analyze protein domains by sequence
- Get detailed InterPro entry information
- Advanced UniProt search with multiple filters

---

### 5. **Primer Design Tools (4 tools, 0% coverage)**

**Impact**: MEDIUM — Specialized but important for molecular biology workflows

**Missing Tools**:

- `design_primers`, `calculate_primer_properties`
- `find_primer_binding_sites`, `add_primer_annotation`

**Why Important**: Primer design requires precise parameter specification (Tm range, GC%, product size). The LLM must correctly translate user requirements into tool parameters.

**Recommendation**: Add 3-4 primer design tests:

- Design primers with default parameters
- Design primers with specific Tm range
- Calculate properties of existing primer
- Find binding sites for a primer sequence

---

### 6. **Restriction Analysis Tools (3 tools, 0% coverage)**

**Impact**: MEDIUM — Essential for cloning and molecular biology

**Missing Tools**:

- `find_restriction_sites`, `virtual_digest`, `search_pattern`

**Why Important**: Restriction site analysis is a common molecular biology task requiring the LLM to understand enzyme names, recognition sequences, and digest patterns.

**Recommendation**: Add 3 restriction analysis tests:

- Find restriction sites in a region
- Simulate virtual digest with multiple enzymes
- Search for custom sequence pattern

---

### 7. **Navigation Enhancements (14 tools not in benchmark)**

**Impact**: MEDIUM — Basic navigation is covered, but advanced features are not

**Missing Tools**:

- `zoom_in`, `zoom_out`, `zoom_to_gene`
- `pan_left`, `pan_right`
- `select_gene`, `select_sequence_region`
- `list_genome_windows`, `switch_active_window`
- `get_chromosome_list`

**Why Important**: While basic navigation (`navigate_to_position`, `jump_to_gene`) is tested, advanced navigation like zooming, panning, and multi-window management are not.

**Recommendation**: Add 5-7 navigation enhancement tests:

- Zoom in/out by specific factor
- Pan left/right by base pairs
- Select a gene by name
- Switch between genome windows
- List available chromosomes

---

## Recommendations for Benchmark Expansion

### Phase 1: Critical Tools (Add 25 tests)

**Target**: Increase coverage from 32.8% → **53%**

1. **Annotation CRUD** (5 tests)
   - Create, update, delete, search, list annotations

2. **BLAST Basics** (5 tests)
   - Online search, local search, create database, filter results, export

3. **Track Control** (5 tests)
   - Toggle tracks, get status, change settings, reset, batch update

4. **Protein/Database** (5 tests)
   - UniProt search, AlphaFold fetch, InterPro analysis, domain search

5. **System/Utility** (5 tests)
   - List tools, toggle settings, get chromosome list, list windows, switch window

### Phase 2: High Priority Tools (Add 22 tests)

**Target**: Increase coverage from 53% → **71%**

1. **Advanced BLAST** (5 tests)
   - Batch search, database management, validation, sequence type detection

2. **Primer Design** (4 tests)
   - Design primers, calculate properties, find binding sites, add annotation

3. **Restriction Analysis** (3 tests)
   - Find sites, virtual digest, pattern search

4. **Advanced Navigation** (5 tests)
   - Zoom, pan, select gene/region, multi-window

5. **Track Settings Advanced** (5 tests)
   - Get/set/reset schema, batch operations

### Phase 3: Complete Coverage (Add 35 tests)

**Target**: Increase coverage from 71% → **100%**

1. **Benchmark Self-Testing** (8 tests)
   - Open, start, stop, pause, resume, get results, get status, export

2. **Advanced Export** (2 tests)
   - Configure export settings, generic export

3. **Annotation Advanced** (3 tests)
   - Bulk update, history, advanced search

4. **Utility Tools** (2 tests)
   - Download file, view markdown

5. **Specialized Tools** (20 tests)
   - Remaining edge cases and advanced workflows

---

## Implementation Strategy

### Step 1: Create Benchmark Tests for Critical Tools

**File to Modify**: `src/renderer/modules/benchmark-suites/AutomaticSimpleSuite.js`

**Example Test Addition** (Annotation):

```javascript
{
  id: 'annotation_auto_01',
  name: 'Create Gene Annotation',
  type: 'function_call',
  category: 'annotation',
  complexity: 'simple',
  evaluation: 'automatic',
  instruction: 'Create a gene annotation at position 1000-2000 named "test_gene" with type "gene"',
  expectedResult: {
    tool_name: 'create_annotation',
    parameters: {
      start: 1000,
      end: 2000,
      name: 'test_gene',
      type: 'gene',
    },
  },
  maxScore: 5,
  bonusScore: 1,
  timeout: 30000,
  evaluator: this.evaluateAnnotationCreationCall.bind(this),
}
```

### Step 2: Add Evaluator Methods

**File to Modify**: `src/renderer/modules/benchmark-suites/BenchmarkEvaluatorBase.js`

Add evaluation methods for each new tool category:

- `evaluateAnnotationCreationCall()`
- `evaluateBLASTSearchCall()`
- `evaluateTrackToggleCall()`
- `evaluateProteinFetchCall()`
- etc.

### Step 3: Update Manual Suites

**Files to Modify**:

- `src/renderer/modules/benchmark-suites/ManualSuite.js`
- `src/renderer/modules/benchmark-suites/ManualComplexSuite.js`

Add manual evaluation tests for tools requiring visual verification:

- Track visibility changes
- Genome window switching
- 3D structure viewer opening
- Settings modal interactions

### Step 4: Test Execution & Validation

Run expanded benchmark suite to ensure:

1. All new tests execute without errors
2. LLM correctly identifies and calls the tools
3. Parameters are correctly formatted
4. Evaluators properly assess success/failure

---

## Conclusion

**Current State**: 32.8% tool coverage (40/122 tools)  
**Target State**: 100% tool coverage (122/122 tools)  
**Gap**: 82 tools missing from benchmark

**Priority Order**:

1. ✅ **Annotation Tools** (14 tools) — Most critical gap
2. ✅ **BLAST Suite** (13 tools) — Core bioinformatics functionality
3. ✅ **Track Management** (9 tools) — Essential visualization control
4. ✅ **Protein/Database** (8 tools) — Key differentiator
5. ✅ **Primer Design** (4 tools) — Molecular biology workflows
6. ✅ **Restriction Analysis** (3 tools) — Cloning operations
7. ✅ **Navigation Enhancements** (14 tools) — Advanced UX
8. ✅ **System/Utility** (17 tools) — Platform features

**Estimated Effort**:

- Phase 1 (Critical): 2-3 days
- Phase 2 (High Priority): 2-3 days
- Phase 3 (Complete): 3-4 days
- **Total**: 7-10 days

**Business Impact**:

- Improved LLM instruction following accuracy across all tool categories
- Better user experience with fewer failed tool calls
- Comprehensive quality assurance for the AI assistant
- Reduced support tickets from incorrect tool usage

---

## Appendix: Complete Tool Lists

### All 122 Built-in Tools (Alphabetical)

See the full list in the analysis above. The 82 tools NOT in benchmark are clearly marked in the priority sections.

### Benchmark Test Files

- `src/renderer/modules/benchmark-suites/AutomaticSimpleSuite.js` — 40 tests
- `src/renderer/modules/benchmark-suites/AutomaticComplexSuite.js` — 4 tests
- `src/renderer/modules/benchmark-suites/ManualSuite.js` — ~15 tests
- `src/renderer/modules/benchmark-suites/ManualComplexSuite.js` — ~8 tests
- `src/renderer/modules/benchmark-suites/BenchmarkEvaluatorBase.js` — Evaluator methods

### Tool Registry Files

- `tools_registry/builtin_tools_integration.js` — 122 tool mappings
- `tools_registry/tool_categories.yaml` — Category definitions
- `tools_registry/<category>/*.yaml` — Individual tool schemas (143 YAML files)

---

**Report Generated**: 2026-04-17  
**Analysis Version**: 1.0  
**Next Review**: After Phase 1 implementation
