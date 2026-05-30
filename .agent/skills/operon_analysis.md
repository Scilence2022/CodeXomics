---
name: operon_analysis
version: 1.0.0
description: |
  Identify, characterise, and visualise an operon: discover co-regulated genes, analyse 
  the functional logic of their clustering, compute strand consistency, identify shared 
  regulatory elements, and generate a coordinated functional annotation for all members.

category: annotation
tags:
  - operon
  - co-regulation
  - prokaryote
  - gene_cluster
  - transcription
  - regulatory

triggers:
  - "analyse the operon containing [gene]"
  - "what genes are in the same operon as [gene]?"
  - "show me the operon structure near [position]"
  - "find co-regulated genes for [gene]"
  - "is [gene] in an operon?"
  - "characterize the [operon_name] operon"

preconditions:
  - condition: genome_loaded
    description: A prokaryotic genome with gene annotations must be loaded
    check_tool: get_current_state
    required: true

inputs:
  gene_identifier:
    type: string
    description: Gene name or locus_tag of any gene in the operon
    required: true
  include_function_annotation:
    type: boolean
    description: Whether to look up database annotations for all operon members (default true)
    default: true
  intergenic_threshold:
    type: number
    description: Maximum intergenic distance (bp) between genes considered co-operonic (default 150)
    default: 150

steps:
  - id: navigate_to_gene
    description: "Navigate the viewer to the seed gene"
    tool: jump_to_gene
    parameters:
      geneName: "{{input.gene_identifier}}"
    on_error: skip

  - id: get_seed_gene
    description: "Get full annotation of the seed gene"
    tool: get_gene_details
    parameters:
      identifier: "{{input.gene_identifier}}"
    on_error: abort
    store_result_as: seed_gene

  - id: find_operon
    description: "Identify the operon containing the seed gene"
    tool: get_operons
    parameters:
      chromosome: "{{steps.seed_gene.chromosome}}"
      position: "{{steps.seed_gene.start}}"
    depends_on: [get_seed_gene]
    on_error: abort
    store_result_as: operon_info

  - id: get_all_member_details
    description: "Get full gene details for every operon member"
    tool: get_gene_details
    parameters:
      identifier: "{{steps.operon_info.member_ids}}"   # batch call for all members
    depends_on: [find_operon]
    on_error: skip
    store_result_as: member_details

  - id: get_intergenic_regions
    description: "Calculate intergenic distances between operon members"
    tool: find_intergenic_regions
    parameters:
      chromosome: "{{steps.seed_gene.chromosome}}"
      start: "{{steps.operon_info.start}}"
      end: "{{steps.operon_info.end}}"
    depends_on: [find_operon]
    on_error: skip
    store_result_as: intergenic_data

  - id: get_wider_neighborhood
    description: "Map the genomic neighbourhood around the entire operon"
    tool: get_nearby_features
    parameters:
      chromosome: "{{steps.seed_gene.chromosome}}"
      position: "{{steps.operon_info.start}}"
      radius: 5000
    depends_on: [find_operon]
    on_error: skip
    store_result_as: neighborhood

  - id: get_operon_sequence
    description: "Extract the full DNA sequence of the operon locus"
    tool: get_sequence
    parameters:
      chromosome: "{{steps.seed_gene.chromosome}}"
      start: "{{steps.operon_info.start - 500}}"
      end: "{{steps.operon_info.end + 500}}"
    depends_on: [find_operon]
    on_error: skip
    store_result_as: operon_sequence

  - id: predict_promoter
    description: "Predict the promoter and regulatory elements upstream of the operon"
    tool: predict_promoter
    parameters:
      chromosome: "{{steps.seed_gene.chromosome}}"
      start: "{{steps.operon_info.start}}"
      strand: "{{steps.seed_gene.strand}}"
    depends_on: [find_operon]
    on_error: skip
    store_result_as: promoter_data

  - id: compute_operon_gc
    description: "Compute GC content across the entire operon"
    tool: compute_gc
    parameters:
      sequence: "{{steps.operon_sequence.sequence}}"
    depends_on: [get_operon_sequence]
    on_error: skip
    store_result_as: gc_data

  - id: annotate_members_with_uniprot
    description: "Look up UniProt annotations for all operon members"
    tool: search_uniprot_database
    parameters:
      query: "{{steps.operon_info.member_gene_names}}"
      limit: "{{steps.operon_info.member_count}}"
    condition: "{{input.include_function_annotation}} == true"
    depends_on: [find_operon]
    on_error: skip
    store_result_as: member_annotations

  - id: analyze_member_domains
    description: "Get domain architecture for each member (first UniProt hit)"
    tool: analyze_interpro_domains
    parameters:
      uniprotId: "{{steps.member_annotations.entries[0].accession}}"
    depends_on: [annotate_members_with_uniprot]
    condition: "{{input.include_function_annotation}} == true && {{steps.member_annotations.total}} > 0"
    on_error: skip
    store_result_as: domain_data

  - id: search_motifs
    description: "Search for transcription factor binding sites and -10/-35 boxes upstream"
    tool: search_sequence_motif
    parameters:
      sequence: "{{steps.operon_sequence.sequence}}"
      motif: "TATAAT"   # -10 box
    depends_on: [get_operon_sequence]
    on_error: skip
    store_result_as: regulatory_motifs

  parallel_groups:
    - group_id: operon_sequence_analysis
      steps: [get_intergenic_regions, get_wider_neighborhood, get_operon_sequence]
    - group_id: function_lookup
      steps: [annotate_members_with_uniprot]
    - group_id: sequence_features
      steps: [predict_promoter, search_motifs]

outputs:
  summary_template: |
    ## 🧬 Operon Analysis — {{steps.operon_info.operon_name}}

    **Seed gene:** {{input.gene_identifier}}  
    **Location:** {{steps.seed_gene.chromosome}}:{{steps.operon_info.start}}–{{steps.operon_info.end}}  
    **Strand:** {{steps.seed_gene.strand}}  
    **Member count:** {{steps.operon_info.member_count}}  
    **Total length:** {{steps.operon_info.total_length}} bp  
    **GC%:** {{steps.gc_data.gcPercent}}%

    ### Operon Members
    | Order | Gene | Locus Tag | Length (aa) | Function | Domain |
    |---|---|---|---|---|---|
    {{steps.member_details.table_rows}}

    ### Intergenic Distances
    {{steps.intergenic_data.distances_table}}

    > ⚠️ Gaps >{{input.intergenic_threshold}} bp may indicate operon boundaries or internal promoters.

    ### Regulatory Elements
    - **Predicted promoter:** {{steps.promoter_data.summary}}
    - **-10 box (TATAAT):** {{steps.regulatory_motifs.summary}}

    ### Functional Synthesis
    Based on the domain architectures and UniProt annotations of members, this operon 
    likely encodes: {{steps.member_annotations.inferred_function}}

    ### Genomic Neighbourhood
    {{steps.neighborhood.summary}}

  actions_on_success:
    - navigate_to_result: true
    - highlight_features: true

expected_duration:
  min_seconds: 20
  max_seconds: 90
  note: "Duration scales with the number of operon members (UniProt lookups per member)."

agent_notes: |
  - Always check strand consistency: all genes in a true operon should be on the same strand.
  - Large intergenic distances (>150 bp) may indicate internal promoters — flag these.
  - Report the functional logic of the gene order: is there a metabolic pathway logic? 
    (e.g., biosynthetic enzymes ordered by reaction step)
  - If members have diverse functions, this may indicate a regulon, not a simple operon.
  - Always predict the -10 and -35 box positions to validate the operon's transcriptional unit status.
---

## Overview

Operons are the fundamental unit of prokaryotic gene regulation — a cluster of genes transcribed
as a single polycistronic mRNA and sharing a promoter. Understanding operon structure provides
insight into co-regulation, metabolic pathway organization, and functional gene clusters.

This skill goes beyond simple operon detection by characterising the _biological logic_ of the
gene grouping — are the members sequential steps in a metabolic pathway? Components of the
same protein complex? Stress response genes?

## Step-by-Step Explanation

### Step 1 — Navigation + Seed Gene

Establishes the starting point from the user-provided gene.

### Step 2 — `get_operons`

The core step: returns operon membership based on strand, intergenic distance, and
annotation clustering patterns.

### Step 3 — `get_gene_details` (batch)

Retrieves annotations for all operon members simultaneously.

### Steps 4–5 — Sequence & Intergenic Analysis (parallel)

Maps the exact operon boundaries and flags any unusually large intergenic gaps that might
indicate internal promoters or operon sub-structure.

### Step 6 — `predict_promoter`

Identifies the primary promoter elements (-10 and -35 hexamers, TSS) at the 5' end of the
operon — essential for confirming that genes are a single transcriptional unit.

### Steps 7–8 — UniProt + InterPro (conditional, parallel)

When `include_function_annotation=true`, enriches each member with curated protein function
and domain architecture data.

### Step 9 — Motif Search

Searches for regulatory motifs (sigma factor binding sites, ribosome binding sites) within
the operon sequence.

## Interpreting Results

The most important deliverable is the **functional synthesis**: what is the collective job of
this operon? Look for:

- **Metabolic pathway logic** — genes encoding sequential enzymatic steps
- **Structural complex logic** — protein subunits that assemble together
- **Regulatory logic** — regulators + their target genes in the same operon

## Common Issues & Troubleshooting

| Problem                     | Likely Cause                         | Solution                                      |
| --------------------------- | ------------------------------------ | --------------------------------------------- |
| Only one gene returned      | Monocistronic gene                   | Report as monocistronic; not an operon        |
| Mixed-strand genes returned | Divergent promoter or error          | Check geometry carefully; report to user      |
| Very large intergenic gap   | Internal promoter or operon boundary | Flag explicitly; may be two operons           |
| No promoter predicted       | Non-standard sigma factor            | Report; may be regulated by alternative sigma |
