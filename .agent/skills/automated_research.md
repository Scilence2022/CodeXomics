---
name: automated_research
version: 1.0.0
description: |
  Conduct a comprehensive, multi-source automated research report on a gene or genomic region:
  sequence analysis, functional annotation, protein structure, domain architecture, and 
  pathway context — synthesized into a structured research summary ready for publication.

category: research
tags:
  - research
  - literature
  - comprehensive_analysis
  - gene_function
  - structural_biology
  - pathways

triggers:
  - "research [gene] comprehensively"
  - "give me a full analysis of [gene]"
  - "write a research summary for [gene]"
  - "what do we know about [gene]?"
  - "do a deep dive on [gene/protein]"
  - "generate a research report for [region]"
  - "investigate [gene] across databases"

preconditions:
  - condition: genome_loaded
    description: A genome file must be loaded
    check_tool: get_current_state
    required: true

inputs:
  gene_identifier:
    type: string
    description: Gene name, locus_tag, or protein ID
    required: true
  organism:
    type: string
    description: Full organism name (improves all database queries)
    required: false
    default: ""
  depth:
    type: string
    description: "Research depth: 'quick' (3-5 tools), 'standard' (all), 'deep' (includes structural viewer)"
    default: standard
    enum: [quick, standard, deep]

steps:
  # ── Phase 1: Orientation (always runs) ────────────────────────────────────
  - id: get_state
    description: "Verify application state and loaded data"
    tool: get_current_state
    on_error: abort
    store_result_as: app_state

  - id: get_genome_info
    description: "Retrieve genome metadata"
    tool: get_genome_info
    on_error: skip
    store_result_as: genome_info

  - id: navigate_to_gene
    description: "Navigate to and focus on the target gene"
    tool: jump_to_gene
    parameters:
      geneName: "{{input.gene_identifier}}"
    on_error: skip

  - id: get_gene_details
    description: "Get all available gene annotation data from the loaded genome"
    tool: get_gene_details
    parameters:
      identifier: "{{input.gene_identifier}}"
    on_error: abort
    store_result_as: gene_details

  # ── Phase 2: Sequence Analysis ────────────────────────────────────────────
  - id: get_cds
    description: "Extract coding sequence"
    tool: get_coding_sequence
    parameters:
      identifier: "{{input.gene_identifier}}"
    depends_on: [get_gene_details]
    on_error: skip
    store_result_as: cds

  - id: translate_protein
    description: "Translate CDS to protein sequence"
    tool: translate_dna
    parameters:
      dna: "{{steps.cds.sequence}}"
      frame: 0
    depends_on: [get_cds]
    condition: "{{steps.cds.sequence}} != null"
    on_error: skip
    store_result_as: protein

  - id: compute_gc
    description: "Assess GC content and nucleotide composition"
    tool: compute_gc
    parameters:
      sequence: "{{steps.cds.sequence}}"
    depends_on: [get_cds]
    on_error: skip
    store_result_as: gc_stats

  - id: codon_usage
    description: "Analyze codon usage bias"
    tool: codon_usage_analysis
    parameters:
      sequence: "{{steps.cds.sequence}}"
    depends_on: [get_cds]
    on_error: skip
    store_result_as: codon_data

  - id: predict_promoter
    description: "Predict promoter elements upstream of the gene"
    tool: predict_promoter
    parameters:
      chromosome: "{{steps.gene_details.chromosome}}"
      start: "{{steps.gene_details.start}}"
      strand: "{{steps.gene_details.strand}}"
    depends_on: [get_gene_details]
    on_error: skip
    store_result_as: promoter_data

  # ── Phase 3: Genomic Context ──────────────────────────────────────────────
  - id: get_neighbors
    description: "Identify flanking genes and operon context"
    tool: get_nearby_features
    parameters:
      chromosome: "{{steps.gene_details.chromosome}}"
      position: "{{steps.gene_details.start}}"
      radius: 10000
    depends_on: [get_gene_details]
    on_error: skip
    store_result_as: neighborhood

  - id: find_intergenic
    description: "Identify intergenic regions around the gene"
    tool: find_intergenic_regions
    parameters:
      chromosome: "{{steps.gene_details.chromosome}}"
      start: "{{steps.gene_details.start}}"
      end: "{{steps.gene_details.end}}"
    depends_on: [get_gene_details]
    on_error: skip
    store_result_as: intergenic_data

  - id: get_operons
    description: "Check if the gene belongs to an operon"
    tool: get_operons
    parameters:
      chromosome: "{{steps.gene_details.chromosome}}"
      position: "{{steps.gene_details.start}}"
    depends_on: [get_gene_details]
    on_error: skip
    store_result_as: operon_data

  # ── Phase 4: Protein & Database Analysis ─────────────────────────────────
  - id: search_uniprot
    description: "Search UniProt for functionally characterized homologs"
    tool: search_uniprot_database
    parameters:
      query: "{{input.gene_identifier}}"
      organism: "{{input.organism}}"
      limit: 5
    on_error: skip
    store_result_as: uniprot_results

  - id: get_uniprot_details
    description: "Fetch full UniProt record for top hit"
    tool: get_uniprot_entry
    parameters:
      uniprotId: "{{steps.uniprot_results.entries[0].accession}}"
    depends_on: [search_uniprot]
    condition: "{{steps.uniprot_results.total}} > 0"
    on_error: skip
    store_result_as: uniprot_entry

  - id: analyze_domains
    description: "Perform domain architecture analysis via InterPro"
    tool: analyze_interpro_domains
    parameters:
      uniprotId: "{{steps.uniprot_results.entries[0].accession}}"
    depends_on: [get_uniprot_details]
    condition: "{{steps.uniprot_results.total}} > 0"
    on_error: skip
    store_result_as: domains

  - id: search_alphafold
    description: "Find AlphaFold predicted structure"
    tool: search_alphafold_by_gene
    parameters:
      geneName: "{{input.gene_identifier}}"
      organism: "{{input.organism}}"
    on_error: skip
    store_result_as: alphafold_info

  - id: open_structure_viewer
    description: "Open 3D structure in AlphaFold viewer (deep research only)"
    tool: open_alphafold_viewer
    parameters:
      uniprotId: "{{steps.uniprot_results.entries[0].accession}}"
    depends_on: [search_alphafold]
    condition: "{{input.depth}} == 'deep' && {{steps.alphafold_info.model_id}} != null"
    on_error: skip

  # ── Phase 5: Sequence Patterns & BLAST ───────────────────────────────────
  - id: blast_search
    description: "BLAST the CDS against NCBI for evolutionary context"
    tool: blast_search
    parameters:
      sequence: "{{steps.cds.sequence}}"
      program: "blastn"
      database: "nt"
      max_hits: 5
    depends_on: [get_cds]
    condition: "{{input.depth}} != 'quick'"
    on_error: skip
    store_result_as: blast_hits

  # Parallel execution groups
  parallel_groups:
    - group_id: sequence_analysis_parallel
      steps: [compute_gc, codon_usage, predict_promoter]
    - group_id: context_parallel
      steps: [get_neighbors, find_intergenic, get_operons]
    - group_id: database_parallel
      steps: [search_uniprot, search_alphafold]

outputs:
  summary_template: |
    # 📋 Research Report: {{input.gene_identifier}}

    **Genome:** {{steps.genome_info.name}} | **Date:** {{current_date}}

    ---

    ## 1. Gene Overview
    | Field | Value |
    |---|---|
    | Locus tag | {{steps.gene_details.locus_tag}} |
    | Gene name | {{steps.gene_details.gene}} |
    | Product | {{steps.gene_details.product}} |
    | Location | {{steps.gene_details.chromosome}}:{{steps.gene_details.start}}–{{steps.gene_details.end}} |
    | Strand | {{steps.gene_details.strand}} |
    | Length | {{steps.cds.length}} bp / {{steps.protein.length}} aa |

    ## 2. Sequence Analysis
    - **GC content:** {{steps.gc_stats.gcPercent}}%
    - **Codon usage:** {{steps.codon_data.summary}}
    - **Promoter prediction:** {{steps.promoter_data.summary}}

    ## 3. Protein Function (UniProt)
    - **Best match:** {{steps.uniprot_entry.protein_name}} ({{steps.uniprot_results.entries[0].accession}})
    - **Status:** {{steps.uniprot_entry.reviewed}}
    - **Function:** {{steps.uniprot_entry.function}}
    - **GO terms:** {{steps.uniprot_entry.go_terms}}
    - **Subcellular location:** {{steps.uniprot_entry.subcellular_location}}

    ## 4. Domain Architecture (InterPro)
    {{steps.domains.domains_table}}

    ## 5. 3D Structure (AlphaFold)
    - **Model:** {{steps.alphafold_info.model_id}}
    - **Coverage:** {{steps.alphafold_info.coverage}}%
    - **Mean confidence (pLDDT):** {{steps.alphafold_info.mean_plddt}}

    ## 6. Evolutionary Context (BLAST)
    {{steps.blast_hits.summary_table}}

    ## 7. Genomic Context
    - **Operon:** {{steps.operon_data.operon_name}} ({{steps.operon_data.gene_count}} genes)
    - **Flanking genes:** {{steps.neighborhood.summary}}

    ---
    ## 8. Summary & Conclusions
    > *Auto-generated synthesis — review and validate before publication.*
    >
    > {{input.gene_identifier}} encodes a {{steps.protein.length}}-aa protein with homology to
    > {{steps.uniprot_entry.protein_name}} ({{steps.uniprot_results.entries[0].accession}}).
    > Domain analysis reveals {{steps.domains.primary_domain}} architecture, consistent with
    > a role in {{steps.uniprot_entry.function}}. The gene is located in an operon context
    > with {{steps.operon_data.gene_count}} co-regulated genes, suggesting functional
    > coordination. {{steps.codon_data.hgt_note}}

  actions_on_success:
    - navigate_to_result: true
    - highlight_features: true

expected_duration:
  min_seconds: 30
  max_seconds: 180
  note: "Deep mode with BLAST + structure viewer can take up to 3 minutes. Standard mode is 30-90s."

agent_notes: |
  - Parallelize all independent database queries (Phase 4 steps especially).
  - Begin with the Phase 1 orientiation steps synchronously — they provide context for all others.
  - If `input.depth == 'quick'`, skip BLAST and structure viewer; only run through Phase 3.
  - Flag any discrepancy between the current annotation (gene_details.product) and the 
    database-derived function (uniprot_entry.function) — these are annotation improvement opportunities.
  - The summary section should be written in natural language (not just data) — synthesize 
    the evidence into a coherent biological narrative.
  - Always cite the data source (UniProt accession, InterPro entry IDs) so the user can verify.
---

## Overview

This skill orchestrates a complete gene research pipeline, analogous to what a bioinformatics
analyst would do over several hours. The agent runs it in minutes by parallelising independent
database queries. The output is a structured, citation-backed research summary.

Key design principle: **evidence convergence** — multiple independent lines of evidence 
(sequence, structure, domain, evolutionary) are gathered and synthesised into a single confident
conclusion.

## Research Depth Modes

| Mode | Steps Run | Typical Duration | Use Case |
|---|---|---|---|
| `quick` | Phases 1–3 only | 15–30s | Fast context check |
| `standard` | All phases, no viewer | 30–90s | Routine research |
| `deep` | All phases + structure viewer | 60–180s | Publication preparation |

## Step-by-Step Explanation

### Phase 1 — Orientation
Ensures the application is in the right state, navigates to the gene, and establishes 
the genomic coordinate baseline.

### Phase 2 — Sequence Analysis (parallel)
GC content, codon bias, and promoter prediction all run simultaneously since they are 
computationally independent. Unusual codon bias is a horizontal gene transfer signal.

### Phase 3 — Genomic Context (parallel)
Operon membership, intergenic regions, and flanking genes run in parallel. This provides
"guilt by association" functional evidence — co-operonic genes are often functionally related.

### Phase 4 — Database Analysis (parallel)
UniProt and AlphaFold searches launch simultaneously. InterPro domain analysis runs after
UniProt since it needs the accession number.

### Phase 5 — BLAST (conditional)
Only runs in `standard` or `deep` modes. Identifies the closest characterized homologs
across all sequenced organisms.

## Interpreting Results

The final output section (Section 8 "Summary & Conclusions") is the most important — it
synthesizes all evidence into a natural-language paragraph. The agent should rewrite this
section in proper scientific language rather than just filling in template slots.

## Common Issues & Troubleshooting

| Problem | Likely Cause | Solution |
|---|---|---|
| Phases 4–5 return empty | Non-model organism protein | Try sequence-based UniProt search |
| Contradictory function from different sources | Paralogous proteins matched | Report all candidates; let user choose |
| Very long runtime | BLAST + many database calls | Use `depth=quick` for exploratory work |
| Gene not in operons | Monocistronic gene | Report this as biologically meaningful |
