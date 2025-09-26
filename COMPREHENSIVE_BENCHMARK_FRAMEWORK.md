# Comprehensive Benchmark Framework for GenomeAIStudio

## Overview

This document defines a comprehensive testing framework for evaluating AI agent performance in GenomeAIStudio. The framework uses a triple classification system to categorize tests and provides detailed prompts for both automatic and manual evaluation.

## Classification Framework

### 1. Evaluation Method Classification
- **Automatic**: System can evaluate automatically based on tool selection and parameters
- **Manual**: Requires human verification of results and behavior

### 2. Complexity Classification
- **Simple** (5 base points): Single tool usage, straightforward parameters
- **Complex** (10 base points): Multi-step workflows, sophisticated parameter handling

### 3. Task Type Classification
1. **Navigation**: Browser navigation, positioning, zoom operations
2. **Analysis**: Data analysis including sequence analysis, codon usage, GC content
3. **Data Loading**: Loading genome files, annotations, reads, VCF, WIG files
4. **Search**: Finding genes, features, motifs by name or description
5. **External Database**: Accessing UniProt, AlphaFold databases

## Scoring System

### Base Scoring
- **Simple Tasks**: 5 points for completion, 3 points for correct tool selection only
- **Complex Tasks**: 10 points for completion, 6 points for correct tool selection only

### Bonus Points (Intelligent Assistance)
- **Simple Tasks**: +1 point for intelligent auxiliary behaviors
- **Complex Tasks**: +2 points for intelligent auxiliary behaviors

### Intelligent Assistance Examples
- Automatic navigation to gene location after analysis
- Cross-referencing results with related databases
- Providing contextual information or warnings
- Optimizing parameters based on data characteristics
- Suggesting follow-up analyses

---

## NAVIGATION TASKS

### Automatic Evaluation Tasks

#### NAV_AUTO_01 - **Simple** (5 points)
**Prompt**: "Navigate to genomic position 100000 on the current chromosome."
**Expected Tool**: `navigate_to_position`
**Expected Parameters**: 
```json
{
  "chromosome": "<current_chromosome>",
  "position": 100000
}
```
**Evaluation Criteria**: Correct tool selection + position parameter present
**Bonus Criteria**: Automatic chromosome detection or range suggestion

#### NAV_AUTO_02 - **Simple** (5 points)
**Prompt**: "Navigate to genomic position 3.5M"
**Expected Tool**: `navigate_to_position`
**Expected Parameters**: 
```json
{
  "chromosome": "<current_chromosome>",
  "position": 3500000
}
```
**Evaluation Criteria**: Correct tool selection + position parameter present
**Bonus Criteria**: Automatic chromosome detection or range suggestion

#### NAV_AUTO_03 - **Simple** (5 points)
**Prompt**: "Show me the genomic region from position 50000 to 75000."
**Expected Tool**: `navigate_to_position`
**Expected Parameters**:
```json
{
  "chromosome": "<current_chromosome>",
  "start": 50000,
  "end": 75000
}
```
**Evaluation Criteria**: Correct tool + both start and end parameters
**Bonus Criteria**: Range validation or optimization

#### NAV_AUTO_04 - **Simple** (5 points)
**Prompt**: "Get the current state of the genome browser."
**Expected Tool**: `get_current_state`
**Expected Parameters**: `{}`
**Evaluation Criteria**: Correct tool selection (no parameters required)

#### NAV_AUTO_05 - **Complex** (10 points)
**Prompt**: "Navigate to region 1130000 to 1300000 and analyze the genomic features in this range."
**Expected Tool**: `navigate_to_position`
**Expected Parameters**: 
```json
{
  "chromosome": "<current_chromosome>",
  "start": 1130000,
  "end": 1300000
}
```
**Evaluation Criteria**: Correct tool selection + both coordinate parameters
**Bonus Criteria**: Automatic range optimization + feature analysis integration

### Manual Evaluation Tasks

#### NAV_MANUAL_01 - **Simple** (5 points)
**Prompt**: "Jump to the lacZ gene location."
**Expected Tool**: `jump_to_gene`
**Expected Parameters**:
```json
{
  "geneName": "lacZ"
}
```
**Manual Verification**: "Please verify: 1) Browser navigates to lacZ gene, 2) Gene is highlighted/centered in view, 3) Navigation completes within 5 seconds."
**Bonus Criteria**: Additional gene information displayed

#### NAV_MANUAL_02 - **Simple** (5 points)
**Prompt**: "Open a new tab for genome browsing."
**Expected Tool**: `open_new_tab`
**Expected Parameters**: `{}`
**Manual Verification**: "Please confirm: 1) New browser tab opens successfully, 2) New tab is ready for genome visualization, 3) Original tab remains functional."

#### NAV_MANUAL_03 - **Complex** (10 points)
**Prompt**: "Navigate to the araA gene and then expand the view to show 10kb upstream and downstream regions for regulatory element analysis."
**Expected Tools**: `jump_to_gene` → `navigate_to_position` (with calculated coordinates)
**Expected Parameters**:
```json
[
  {"geneName": "araA"},
  {"chromosome": "<auto>", "start": "<gene_start-10000>", "end": "<gene_end+10000>"}
]
```
**Manual Verification**: "Please verify: 1) Browser first navigates to araA gene, 2) View automatically expands to ~20kb region centered on araA, 3) Upstream/downstream regulatory regions are clearly visible, 4) Transition between steps is smooth."
**Bonus Criteria**: Automatic coordinate calculation + regulatory element highlighting

#### NAV_MANUAL_04 - **Complex** (10 points)
**Prompt**: "Find all genes containing 'DNA polymerase' in their description and navigation to the best hit."
**Expected Tools**: `search_features` → navigation tools
**Expected Parameters**:
```json
[
  {"query": "DNA polymerase", "caseSensitive": false},
  "Multiple navigate_to_position calls or overview generation"
]
```
**Manual Verification**: "Please confirm: 1) Search identifies DNA polymerase genes, 2) Navigate tools called"
**Bonus Criteria**: statistical summary

---

## ANALYSIS TASKS

### Automatic Evaluation Tasks

#### ANAL_AUTO_01 - **Simple** (5 points)
**Prompt**: "Calculate the GC content of this DNA sequence: ATGCGCATGCGCTAGC"
**Expected Tool**: `compute_gc`
**Expected Parameters**:
```json
{
  "sequence": "ATGCGCATGCGCTAGC",
  "include_statistics": true
}
```
**Evaluation Criteria**: Correct tool + exact sequence match
**Bonus Criteria**: Additional nucleotide composition analysis


#### ANAL_AUTO_02 - **Simple** (5 points)
**Prompt**: "Get the reverse complement of sequence ATGCGC"
**Expected Tool**: `reverse_complement`
**Expected Parameters**:
```json
{
  "sequence": "ATGCGC"
}
```
**Evaluation Criteria**: Correct tool + sequence parameter


#### ANAL_AUTO_03 - **Simple** (5 points)
**Prompt**: "Translate DNA sequence ATGCGATCGTAGC to protein"
**Expected Tool**: `translate_dna`
**Expected Parameters**:
```json
{
  "sequence": "ATGCGATCGTAGC"
}
```
**Evaluation Criteria**: Correct tool + sequence parameter
**Bonus Criteria**: Genetic code specification or frame analysis

### Manual Evaluation Tasks

#### ANAL_MANUAL_01 - **Simple** (5 points)
**Prompt**: "Analyze codon usage patterns for the lacZ gene"
**Expected Tool**: `codon_usage_analysis`
**Expected Parameters**:
```json
{
  "geneName": "lacZ",
  "include_statistics": true
}
```
**Manual Verification**: "Please verify: 1) Codon usage analysis is performed for lacZ, 2) Results show frequency tables and statistics, 3) Codon bias patterns are identified, 4) Results are clearly visualized."
**Bonus Criteria**: Navigated to lacZ gene

#### ANAL_MANUAL_02 - **Complex** (10 points)
**Prompt**: "Perform comprehensive codon usage analysis for araA gene."
**Expected Tools**: `codon_usage_analysis` + potentially additional analysis tools
**Expected Parameters**:
```json
{
  "geneName": "araA",
  "include_statistics": true,
  "genetic_code": "standard"
}
```
**Manual Verification**: "Please verify: 1) Detailed codon analysis is performed for araA, 2) Bias patterns are clearly identified, 3) Statistical comparisons are provided, 4) Results include significance testing, 5) Visualization effectively shows patterns."
**Bonus Criteria**: Navigated to araA gene



---

## DATA LOADING TASKS

### Automatic Evaluation Tasks

#### LOAD_AUTO_01 - **Simple** (5 points)
**Prompt**: "Load genome file from path /data/ecoli.fasta"
**Expected Tool**: `load_genome_file`
**Expected Parameters**:
```json
{
  "filePath": "/data/ecoli.fasta"
}
```
**Evaluation Criteria**: Correct tool + exact file path
**Bonus Criteria**: File format detection or validation

### Manual Evaluation Tasks

#### LOAD_MANUAL_01 - **Simple** (5 points)
**Prompt**: "Load a genome file using the file selection dialog."
**Expected Tool**: `load_genome_file`
**Expected Parameters**:
```json
{
  "showFileDialog": true
}
```
**Manual Verification**: "Please verify: 1) File selection dialog opens properly, 2) Dialog supports FASTA/GenBank formats, 3) File filtering works correctly, 4) Dialog interface is user-friendly."

#### LOAD_MANUAL_02 - **Simple** (5 points)
**Prompt**: "Load annotation data for the current genome."
**Expected Tool**: `load_annotation_file`
**Expected Parameters**: `{}`
**Manual Verification**: "Please verify: 1) Annotation loading interface appears, 2) Compatible annotation formats are supported, 3) File selection is intuitive, 4) Loading progress is indicated."

#### LOAD_MANUAL_03 - **Simple** (5 points)
**Prompt**: "Load aligned reads data for genome visualization."
**Expected Tool**: `load_reads_file`
**Expected Parameters**: `{}`
**Manual Verification**: "Please verify: 1) Reads file dialog opens, 2) BAM/SAM formats are supported, 3) File size handling is appropriate, 4) Integration with genome view is prepared."

#### LOAD_MANUAL_04 - **Simple** (5 points)
**Prompt**: "Load WIG track data for quantitative visualization."
**Expected Tool**: `load_wig_tracks`
**Expected Parameters**: `{}`
**Manual Verification**: "Please verify: 1) WIG file loading interface appears, 2) Track configuration options are available, 3) Quantitative data handling is prepared, 4) Visualization parameters can be set."

#### LOAD_MANUAL_05 - **Complex** (10 points)
**Prompt**: "Set up a complete genomic analysis environment by loading genome file, gene annotations, variant data (VCF), and expression tracks (WIG) in the optimal order for integrated analysis."
**Expected Tools**: `load_genome_file` → `load_annotation_file` → `load_variant_file` → `load_wig_tracks`
**Manual Verification**: "Please verify: 1) All four data types load successfully, 2) Loading order is optimal for integration, 3) Data layers are properly aligned, 4) Cross-references between layers work, 5) Integrated view is functional, 6) Performance remains acceptable."
**Bonus Criteria**: Dependency detection + automatic optimization + conflict resolution

#### LOAD_MANUAL_06 - **Complex** (10 points)
**Prompt**: "Create a multi-track comparative analysis setup by loading reference genome, sample reads, and variant calls, then configure tracks for mutation impact visualization."
**Expected Tools**: Multiple loading tools + configuration
**Manual Verification**: "Please verify: 1) Reference genome loads first, 2) Sample reads align properly, 3) Variant calls integrate correctly, 4) Track layering is logical, 5) Mutation impacts are visualizable, 6) Comparative analysis is enabled."
**Bonus Criteria**: Automatic track ordering + visualization optimization

---

## SEARCH TASKS

### Automatic Evaluation Tasks

#### SEARCH_AUTO_01 - **Simple** (5 points)
**Prompt**: "Search for the gene lacZ by name."
**Expected Tool**: `search_gene_by_name`
**Expected Parameters**:
```json
{
  "name": "lacZ"
}
```
**Evaluation Criteria**: Correct tool + gene name parameter

#### SEARCH_AUTO_02 - **Simple** (5 points)
**Prompt**: "Find genes related to 'ribosome' function."
**Expected Tool**: `search_features`
**Expected Parameters**:
```json
{
  "query": "ribosome",
  "caseSensitive": false
}
```
**Evaluation Criteria**: Correct tool + search query
**Bonus Criteria**: Case sensitivity handling

#### SEARCH_AUTO_03 - **Simple** (5 points)
**Prompt**: "Find the gene with locus tag b0344."
**Expected Tool**: `search_gene_by_name`
**Expected Parameters**:
```json
{
  "name": "b0344"
}
```
**Evaluation Criteria**: Correct tool + locus tag
  "name": "b0344"
}
```
**Evaluation Criteria**: Correct tool + locus tag

### Manual Evaluation Tasks

#### SEARCH_MANUAL_01 - **Simple** (5 points)
**Prompt**: "Search for genes with locus tags starting with 'b003'."
**Expected Tool**: `search_gene_by_name` or `search_features`
**Expected Parameters**:
```json
{
  "name": "b003",
  "exact_match": false
}
```
**Manual Verification**: "Please verify: 1) Search identifies genes with locus tags b0030, b0031, etc., 2) Partial matching works correctly, 3) Results are comprehensive, 4) Search performance is acceptable."

#### SEARCH_MANUAL_02 - **Complex** (10 points)
**Prompt**: "Search for all genes involved in 'amino acid biosynthesis' and create a chromosomal distribution map showing their locations and functional clustering."
**Expected Tools**: `search_features` → navigation/visualization tools
**Expected Parameters**:
```json
[
  {"query": "amino acid biosynthesis", "caseSensitive": false},
  "Multiple navigation calls for distribution analysis"
]
```
**Manual Verification**: "Please verify: 1) Comprehensive gene identification for amino acid biosynthesis, 2) Chromosomal positions are mapped, 3) Distribution patterns are visualized, 4) Functional clustering is identified, 5) Results enable pathway analysis."
**Bonus Criteria**: Clustering analysis + pathway integration + statistical significance

#### SEARCH_MANUAL_03 - **Complex** (10 points)
**Prompt**: "Find all genes with names containing 'ara' and perform integrated analysis of their chromosomal clustering."
**Expected Tools**: `search_gene_by_name` → analysis tools
**Expected Parameters**:
```json
[
  {"name": "ara", "exact_match": false},
  "Sequence retrieval and analysis for identified genes"
]
```
**Manual Verification**: "Please verify: 1) All ara genes are identified, 2) Chromosomal clustering is assessed, 3) Results are integrated coherently, 4) Comparative analysis is meaningful."
**Bonus Criteria**: Automated clustering analysis

---

## EXTERNAL DATABASE TASKS

### Automatic Evaluation Tasks

#### EXT_AUTO_01 - **Simple** (5 points)
**Prompt**: "Search UniProt database for protein lacZ."
**Expected Tool**: `uniprot_search`
**Expected Parameters**:
```json
{
  "sequence": "<lacZ_protein_sequence>",
  "blastType": "blastp",
  "database": "nr"
}
```
**Evaluation Criteria**: Correct tool selection
**Note**: Parameter structure needs verification against actual API

#### EXT_AUTO_02 - **Simple** (5 points)
**Prompt**: "Get AlphaFold structure prediction for gene araA."
**Expected Tool**: `alphafold_search`
**Expected Parameters**:
```json
{
  "sequence": "<araA_protein_sequence>",
  "blastType": "blastp",
  "database": "nr"
}
```
**Evaluation Criteria**: Correct tool selection

### Manual Evaluation Tasks

#### EXT_MANUAL_01 - **Complex** (10 points)
**Prompt**: "Perform comprehensive protein analysis for araA gene: retrieve UniProt annotation and AlphaFold structure prediction, then integrate results for functional characterization."
**Expected Tools**: `uniprot_search` + `alphafold_search`
**Manual Verification**: "Please verify: 1) Both database searches execute successfully, 2) Results are comprehensive and relevant, 3) Data integration maintains cross-references, 4) Functional characterization is coherent, 5) Structural and functional data correlate."
**Bonus Criteria**: Automatic data integration + cross-validation + confidence scoring

---

## MIXED COMPLEXITY WORKFLOW TASKS

### Advanced Integration Tasks (15 points each)

#### WORKFLOW_MANUAL_01 - **Complex** (15 points)
**Prompt**: "Perform complete comparative genomics analysis: load two bacterial genomes, identify orthologs of lacZ gene, compare their codon usage patterns and assess evolutionary conservation."
**Expected Tools**: Multiple loading tools → `search_gene_by_name` → `codon_usage_analysis`
**Manual Verification**: "Please verify: 1) Both genomes load successfully, 2) lacZ orthologs are identified accurately, 3) Codon usage comparison is statistically robust, 4) Evolutionary analysis is comprehensive, 5) Results integration is scientifically meaningful."
**Bonus Criteria**: Automated ortholog detection + statistical significance testing + evolutionary timeline

#### WORKFLOW_MANUAL_02 - **Complex** (15 points)
**Prompt**: "Design and validate genome analysis workflow: load genome and annotation files, analyze sequence composition, and generate comprehensive reports."
**Expected Tools**: `load_genome_file` → `load_annotation_file` → `get_sequence` → `compute_gc` → analysis
**Manual Verification**: "Please verify: 1) Genome and annotations load successfully, 2) Sequence analysis is comprehensive, 3) Reports are generated with meaningful insights, 4) Workflow is efficient and logical, 5) Results meet analysis objectives."
**Bonus Criteria**: Automated workflow optimization + comprehensive reporting
---

## EVALUATION RUBRIC

### Automatic Evaluation Criteria

1. **Tool Selection (60% of points)**
   - Correct tool identified: Full points
   - Related/alternative tool: 50% points
   - Wrong category: 20% points
   - No tool/invalid: 0 points

2. **Parameter Accuracy (40% of points)**
   - All required parameters correct: Full points
   - Most parameters correct: 75% points
   - Some parameters correct: 50% points
   - Wrong parameters: 25% points
   - No parameters when required: 0 points

### Manual Evaluation Criteria

1. **Task Completion (50% of points)**
   - Complete successful execution: Full points
   - Partial completion with correct approach: 75% points
   - Attempt with some success: 50% points
   - Minimal progress: 25% points
   - No meaningful progress: 0 points

2. **Technical Accuracy (30% of points)**
   - Scientifically accurate and appropriate: Full points
   - Mostly accurate with minor issues: 75% points
   - Some accuracy concerns: 50% points
   - Major technical problems: 25% points
   - Fundamentally flawed: 0 points

3. **User Experience (20% of points)**
   - Smooth, intuitive operation: Full points
   - Generally good with minor issues: 75% points
   - Acceptable with some friction: 50% points
   - Problematic user experience: 25% points
   - Poor or confusing interface: 0 points

### Bonus Point Criteria

Bonus points are awarded for intelligent assistance behaviors:

- **Contextual Awareness**: Understanding of genomic context and biological relevance
- **Proactive Assistance**: Suggesting related analyses or providing relevant warnings
- **Parameter Optimization**: Intelligent parameter selection based on data characteristics
- **Cross-Reference Integration**: Connecting results across different tools and databases
- **Educational Value**: Providing explanations or biological insights
- **Workflow Efficiency**: Optimizing sequences of operations for better performance

---

## IMPLEMENTATION GUIDELINES

### Test Execution Protocol

1. **Environment Setup**
   - Load standard E. coli K-12 genome (U00096)
   - Ensure all external API connections are functional
   - Initialize benchmark framework with timeout settings
   - Clear cache and reset browser state

2. **Test Sequence**
   - Execute tests in randomized order to prevent learning effects
   - Allow 30-second timeout for simple tasks, 60 seconds for complex tasks
   - Record all interactions and intermediate states
   - Capture screenshots for manual evaluation tasks

3. **Data Collection**
   - Tool selection accuracy
   - Parameter specification correctness
   - Execution time and success rate
   - User interface responsiveness
   - Result quality and scientific accuracy

4. **Statistical Analysis**
   - Calculate category-wise performance metrics
   - Identify patterns in failure modes
   - Assess learning curve across test sessions
   - Generate confidence intervals for score distributions

### Quality Assurance

1. **Test Validation**
   - Each test case validated by domain experts
   - Expected results verified through manual execution
   - Parameter specifications checked against tool documentation
   - Evaluation criteria calibrated across multiple evaluators

2. **Bias Mitigation**
   - Balanced representation across all task categories
   - Multiple difficulty levels within each category
   - Diverse biological contexts and organisms
   - Randomized test selection to prevent memorization

3. **Continuous Improvement**
   - Regular review and update of test cases
   - Incorporation of new tools and capabilities
   - Refinement of evaluation criteria based on experience
   - Community feedback integration

---

## SUMMARY STATISTICS

### Test Distribution
- **Total Tests**: 22 tests
  - Navigation: 9 tests (4 manual, 5 automatic)
  - Analysis: 6 tests (2 manual, 3 automatic) 
  - Data Loading: 7 tests (6 manual, 1 automatic)
  - Search: 6 tests (3 manual, 3 automatic)
  - External Database: 3 tests (1 manual, 2 automatic)
  - Workflow Integration: 2 tests (2 manual, 0 automatic)

### Evaluation Distribution
- **Automatic Evaluation**: 14 tests (64%)
- **Manual Evaluation**: 13 tests (36%)

### Point Distribution by Complexity
- **Simple Tasks**: 16 × 5 = 80 base points
- **Complex Tasks**: 4 × 10 = 40 base points  
- **Workflow Tasks**: 2 × 15 = 30 base points
- **Total Base Points**: 150 points
- **Maximum with Bonuses**: 200 points (150 + 50 potential bonus points)

### Performance Benchmarks
- **Excellent Performance**: 90%+ (180+ points)
- **Good Performance**: 80-89% (160-179 points)
- **Acceptable Performance**: 70-79% (140-159 points)
- **Needs Improvement**: 60-69% (120-139 points)
- **Poor Performance**: <60% (<120 points)

---

This comprehensive benchmark framework provides thorough evaluation of AI agent capabilities across all major functional areas of GenomeAIStudio while maintaining scientific rigor and practical applicability.