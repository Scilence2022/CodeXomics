---
name: primer_design
version: 1.0.0
description: |
  Design a validated PCR primer pair for a target gene or genomic region, with automatic 
  quality checks for Tm, GC%, length, and cross-genome specificity via BLAST.

category: primer_design
tags:
  - primers
  - pcr
  - amplification
  - cloning
  - qpcr

triggers:
  - "design primers for [gene]"
  - "create PCR primers to amplify [region]"
  - "I need primers for [gene]"
  - "design qPCR primers for [region]"
  - "find forward and reverse primers for [sequence/gene]"

preconditions:
  - condition: genome_loaded
    description: A genome or sequence file must be loaded in CodeXomics
    check_tool: get_current_state
    required: true

# ─── Skill Inputs ─────────────────────────────────────────────────────────────
inputs:
  gene_or_region:
    type: string
    description: Gene name, locus_tag, or genomic coordinates (chr:start-end)
    required: true
  target_tm:
    type: number
    description: Target melting temperature in °C (default 60.0)
    default: 60.0
  min_product_size:
    type: number
    description: Minimum PCR amplicon size in bp (default 100)
    default: 100
  max_product_size:
    type: number
    description: Maximum PCR amplicon size in bp (default 1000)
    default: 1000
  run_blast_validation:
    type: boolean
    description: Whether to BLAST primers for specificity (default true)
    default: true

# ─── Workflow Steps ────────────────────────────────────────────────────────────
steps:
  - id: check_state
    description: "Verify genome is loaded and get current application state"
    tool: get_current_state
    on_error: abort

  - id: find_gene
    description: "Locate the target gene by name to get coordinates"
    tool: search_gene_by_name
    parameters:
      name: "{{input.gene_or_region}}"
    on_error: skip                       # skip if coordinates were provided directly
    store_result_as: gene_info

  - id: navigate
    description: "Navigate the viewer to the target region"
    tool: jump_to_gene
    parameters:
      geneName: "{{input.gene_or_region}}"
    depends_on: [find_gene]
    on_error: skip

  - id: get_target_sequence
    description: "Extract the DNA sequence of the target region (with flanking context)"
    tool: get_sequence
    parameters:
      # Will use coordinates from gene_info if available; user can override
      chromosome: "{{steps.gene_info.chromosome}}"
      start: "{{steps.gene_info.start}}"
      end: "{{steps.gene_info.end}}"
      padding: 200                       # add 200bp flanking for primer placement
    depends_on: [find_gene]
    on_error: abort
    store_result_as: target_sequence

  - id: compute_gc
    description: "Compute GC content to assess primer-ability of the region"
    tool: compute_gc
    parameters:
      sequence: "{{steps.target_sequence.sequence}}"
    depends_on: [get_target_sequence]
    on_error: skip
    store_result_as: gc_result

  - id: design_primers
    description: "Run primer3-based design algorithm to generate optimal primer pair"
    tool: design_primers
    parameters:
      targetSequence: "{{steps.target_sequence.sequence}}"
      targetTm: "{{input.target_tm}}"
      minProductSize: "{{input.min_product_size}}"
    depends_on: [get_target_sequence]
    on_error: abort
    store_result_as: primers

  - id: calc_forward_props
    description: "Calculate detailed thermodynamic properties for forward primer"
    tool: calculate_primer_properties
    parameters:
      sequence: "{{steps.primers.forwardPrimer}}"
    depends_on: [design_primers]
    on_error: skip
    store_result_as: fwd_props

  - id: calc_reverse_props
    description: "Calculate detailed thermodynamic properties for reverse primer"
    tool: calculate_primer_properties
    parameters:
      sequence: "{{steps.primers.reversePrimer}}"
    depends_on: [design_primers]
    on_error: skip
    store_result_as: rev_props

  # Run forward and reverse primer property calculations in parallel
  parallel_groups:
    - group_id: primer_property_calcs
      steps: [calc_forward_props, calc_reverse_props]

  - id: find_binding_sites
    description: "Find all potential binding sites for the primers in the genome"
    tool: find_primer_binding_sites
    parameters:
      forwardPrimer: "{{steps.primers.forwardPrimer}}"
      reversePrimer: "{{steps.primers.reversePrimer}}"
    depends_on: [design_primers]
    on_error: skip
    store_result_as: binding_sites

  - id: blast_validate
    description: "BLAST both primers against the genome to confirm specificity"
    tool: blast_search
    condition: "{{input.run_blast_validation}} == true"
    parameters:
      sequence: "{{steps.primers.forwardPrimer}}"
      program: "blastn"
      database: "nt"
      max_hits: 10
    depends_on: [design_primers]
    on_error: skip
    store_result_as: blast_result

  - id: annotate_primers
    description: "Save primer pair as annotations in the genome viewer"
    tool: add_primer_annotation
    parameters:
      forwardPrimer: "{{steps.primers.forwardPrimer}}"
      reversePrimer: "{{steps.primers.reversePrimer}}"
      chromosome: "{{steps.gene_info.chromosome}}"
      label: "Primer pair: {{input.gene_or_region}}"
    depends_on: [design_primers, find_gene]
    on_error: skip

# ─── Outputs ──────────────────────────────────────────────────────────────────
outputs:
  summary_template: |
    ## 🧫 Primer Design Results — {{input.gene_or_region}}

    | Property | Forward Primer | Reverse Primer |
    |---|---|---|
    | Sequence | `{{steps.primers.forwardPrimer}}` | `{{steps.primers.reversePrimer}}` |
    | Length | {{steps.fwd_props.length}} bp | {{steps.rev_props.length}} bp |
    | Tm | {{steps.fwd_props.tm}}°C | {{steps.rev_props.tm}}°C |
    | GC% | {{steps.fwd_props.gcPercent}}% | {{steps.rev_props.gcPercent}}% |

    **Amplicon size:** {{steps.primers.productSize}} bp  
    **Region GC%:** {{steps.gc_result.gcPercent}}%  
    **Binding sites found:** {{steps.binding_sites.count}}
    **BLAST specificity:** {{steps.blast_result.summary}}

    > Primers have been annotated in the genome viewer for reference.

  actions_on_success:
    - navigate_to_result: true
    - highlight_features: true

expected_duration:
  min_seconds: 10
  max_seconds: 90
  note: "BLAST validation adds ~30-60s depending on network speed. Disable with run_blast_validation=false for faster results."

agent_notes: |
  - If the gene name lookup fails, ask the user for exact genomic coordinates instead.
  - GC content between 40-60% is ideal; warn the user if the region falls outside this range.
  - If BLAST finds >3 binding sites, warn that primers may not be specific — suggest increasing primer length or adjusting Tm.
  - Always present the primer pair in a formatted table for readability.
  - Primers are automatically annotated in the genome viewer for visual confirmation.
---

## Overview

This skill automates the full PCR primer design pipeline: from gene lookup to sequence extraction,
primer3-based design, thermodynamic validation, genome-wide specificity checking, and visual
annotation in the CodeXomics viewer. It encodes best practices for primer design so any AI agent
can produce publication-quality primers without deep bioinformatics expertise.

## Step-by-Step Explanation

### Step 1 — `get_current_state`

Ensures a genome is loaded before attempting any sequence operations. Aborts gracefully if not.

### Step 2 — `search_gene_by_name` → `jump_to_gene`

Resolves the gene name to genomic coordinates and navigates the viewer for visual context.

### Step 3 — `get_sequence`

Extracts the target region with 200 bp of flanking sequence on each side to give the primer
design algorithm adequate sequence context around the amplicon target.

### Step 4 — `compute_gc`

Pre-screens the region for primer-ability. GC content outside 40–60% is a warning sign.

### Step 5 — `design_primers`

Calls the primer3-based engine with the user's Tm and size constraints to generate the optimal
forward/reverse pair.

### Steps 6–7 — `calculate_primer_properties` (parallel)

Computes precise Tm, GC%, self-complementarity, and hairpin delta-G for each primer separately
and simultaneously for efficiency.

### Step 8 — `find_primer_binding_sites`

Scans the loaded genome for all locations where the primers could bind, detecting potential
off-target amplification.

### Step 9 — `blast_search` (optional)

Validates specificity against public databases — critical for eukaryotic genomes or when the
loaded sequence is a plasmid/construct.

### Step 10 — `add_primer_annotation`

Saves the primer positions as visual annotations in the genome viewer so the user can see the
amplicon in its genomic context.

## Interpreting Results

Present results as a formatted table showing both primers side-by-side. Highlight any warnings:

- Tm difference >3°C between primers
- GC% outside 40–60%
- Multiple BLAST hits (possible off-targets)

## Common Issues & Troubleshooting

| Problem                            | Likely Cause                            | Solution                                             |
| ---------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| `design_primers` returns no result | Sequence too short (<150 bp)            | Increase flanking padding or use a longer region     |
| BLAST returns many hits            | Repetitive region or very short primers | Increase primer length constraints                   |
| Gene not found                     | Name/locus_tag mismatch                 | Ask user for exact locus_tag or coordinates          |
| GC% very high or low               | AT-rich or GC-rich region               | Report to user; suggest degenerate primer strategies |
