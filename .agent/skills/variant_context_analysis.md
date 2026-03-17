---
name: variant_context_analysis
version: 1.0.0
description: |
  Analyse a genomic variant (SNP, indel, or structural variant) in its full biological context:
  affected gene(s), protein consequence, domain impact, conservation, and functional significance.

category: sequence_analysis
tags:
  - variants
  - snp
  - mutation
  - functional_impact
  - vcf

triggers:
  - "analyse variant at [position]"
  - "what does this SNP do?"
  - "explain the impact of [variant]"
  - "is this mutation functional?"
  - "annotate variant [chr:pos ref>alt]"
  - "what genes are affected by this variant?"

preconditions:
  - condition: genome_loaded
    description: A reference genome must be loaded
    check_tool: get_current_state
    required: true

inputs:
  chromosome:
    type: string
    description: Chromosome identifier (e.g., "chr1", "NC_000001")
    required: true
  position:
    type: number
    description: Genomic position of the variant (1-based)
    required: true
  ref_allele:
    type: string
    description: Reference allele nucleotide(s)
    required: false
  alt_allele:
    type: string
    description: Alternate (mutant) allele nucleotide(s)
    required: false
  window_size:
    type: number
    description: Base pairs around the variant to analyse (default 2000)
    default: 2000

steps:
  - id: navigate_to_variant
    description: "Navigate the viewer to the variant location"
    tool: navigate_to_position
    parameters:
      chromosome: "{{input.chromosome}}"
      start: "{{input.position - 500}}"
      end: "{{input.position + 500}}"
    on_error: skip

  - id: get_state
    description: "Check application state and loaded tracks"
    tool: get_current_state
    on_error: abort
    store_result_as: app_state

  - id: get_nearby_features
    description: "Identify all genomic features overlapping or near the variant"
    tool: get_nearby_features
    parameters:
      chromosome: "{{input.chromosome}}"
      position: "{{input.position}}"
      radius: "{{input.window_size}}"
    on_error: abort
    store_result_as: features

  - id: get_reference_sequence
    description: "Extract reference sequence around the variant for context"
    tool: get_sequence
    parameters:
      chromosome: "{{input.chromosome}}"
      start: "{{input.position - 100}}"
      end: "{{input.position + 100}}"
    on_error: abort
    store_result_as: ref_sequence

  - id: get_gc_context
    description: "Assess local GC context around the variant"
    tool: compute_gc
    parameters:
      sequence: "{{steps.ref_sequence.sequence}}"
    depends_on: [get_reference_sequence]
    on_error: skip
    store_result_as: local_gc

  - id: check_affected_gene
    description: "Get full gene details for the gene overlapping the variant"
    tool: get_gene_details
    parameters:
      identifier: "{{steps.features.overlapping_genes[0].gene_id}}"
    depends_on: [get_nearby_features]
    condition: "{{steps.features.overlapping_genes.length}} > 0"
    on_error: skip
    store_result_as: affected_gene

  - id: get_cds
    description: "Get the coding sequence of the affected gene"
    tool: get_coding_sequence
    parameters:
      identifier: "{{steps.features.overlapping_genes[0].gene_id}}"
    depends_on: [check_affected_gene]
    condition: "{{steps.affected_gene}} != null"
    on_error: skip
    store_result_as: cds

  - id: translate_ref
    description: "Translate the reference CDS to determine protein sequence"
    tool: translate_dna
    parameters:
      dna: "{{steps.cds.sequence}}"
      frame: 0
    depends_on: [get_cds]
    condition: "{{steps.cds.sequence}} != null"
    on_error: skip
    store_result_as: ref_protein

  - id: search_restriction_sites
    description: "Check if variant creates or destroys a restriction enzyme site"
    tool: find_restriction_sites
    parameters:
      sequence: "{{steps.ref_sequence.sequence}}"
      chromosome: "{{input.chromosome}}"
      start: "{{input.position - 100}}"
      end: "{{input.position + 100}}"
    depends_on: [get_reference_sequence]
    on_error: skip
    store_result_as: restriction_data

  - id: search_nearby_motifs
    description: "Search for regulatory motifs (promoter, binding sites) near variant"
    tool: search_sequence_motif
    parameters:
      sequence: "{{steps.ref_sequence.sequence}}"
      motif: "TATAAA"   # TATA box as example; will search multiple motifs
    depends_on: [get_reference_sequence]
    on_error: skip
    store_result_as: motif_data

  - id: lookup_protein_domains
    description: "Check if variant falls in a known protein domain"
    tool: search_uniprot_database
    parameters:
      query: "{{steps.affected_gene.locus_tag}}"
      limit: 1
    depends_on: [check_affected_gene]
    condition: "{{steps.affected_gene}} != null"
    on_error: skip
    store_result_as: uniprot_info

  - id: analyze_protein_domains
    description: "Get domain architecture to determine if variant is in a domain"
    tool: analyze_interpro_domains
    parameters:
      uniprotId: "{{steps.uniprot_info.entries[0].accession}}"
    depends_on: [lookup_protein_domains]
    condition: "{{steps.uniprot_info.total}} > 0"
    on_error: skip
    store_result_as: domain_map

  parallel_groups:
    - group_id: sequence_context
      steps: [get_gc_context, search_restriction_sites, search_nearby_motifs]
    - group_id: protein_analysis
      steps: [lookup_protein_domains]

outputs:
  summary_template: |
    ## 🧬 Variant Context Report
    **Position:** {{input.chromosome}}:{{input.position}}
    {{#if input.ref_allele}}**Change:** {{input.ref_allele}} → {{input.alt_allele}}{{/if}}

    ### Affected Features
    - **Overlapping gene(s):** {{steps.features.overlapping_genes_list}}
    - **Feature type:** {{steps.features.overlapping_type}}
    - **Within CDS:** {{steps.features.in_cds}}
    - **Within regulatory region:** {{steps.features.in_regulatory}}

    ### Protein Impact (predicted)
    - **Affected protein:** {{steps.affected_gene.product}}
    - **Codon position:** {{steps.cds.codon_position}}
    - **Amino acid change:** {{steps.ref_protein.amino_acid_change}}
    - **Domain affected:** {{steps.domain_map.overlapping_domain}}

    ### Sequence Context
    - **Reference sequence (±100bp):** `{{steps.ref_sequence.sequence}}`
    - **Local GC%:** {{steps.local_gc.gcPercent}}%
    - **Restriction site change:** {{steps.restriction_data.summary}}

    ### Regulatory Impact
    - **Nearby motifs:** {{steps.motif_data.summary}}

  actions_on_success:
    - navigate_to_result: true
    - highlight_features: true

expected_duration:
  min_seconds: 10
  max_seconds: 60

agent_notes: |
  - Always distinguish between synonymous, non-synonymous, nonsense, and frameshift variants.
  - If the variant is intergenic, report distance to nearest gene and whether it might affect a promoter.
  - If the variant falls within an InterPro domain, highlight this as potentially functional.
  - Destruction/creation of restriction sites can be biochemically important — always report.
---

## Overview

This skill places a genomic variant in its full biological and molecular context: what gene, 
what codon, what protein domain, what regulatory region, and what molecular consequences. It 
is designed to answer the central question in variant analysis: *"Is this variant functional?"*

## Step-by-Step Explanation

### Step 1 — Navigation
Centres the genome viewer on the variant so the user has immediate visual context.

### Step 2 — `get_nearby_features`
The pivotal step: determines whether the variant falls in a coding region, UTR, intron, 
intergenic region, or regulatory element.

### Steps 3–4 — Sequence Extraction & GC Context
Retrieves 200 bp of reference sequence around the variant to enable downstream analyses.

### Steps 5–6 — Gene & CDS
If the variant overlaps a gene, retrieves its annotation and coding sequence for protein
consequence prediction.

### Step 7 — `translate_dna`
Determines whether the variant would cause a synonymous, missense, nonsense, or frameshift 
change at the protein level.

### Steps 8–9 — Restriction Sites & Motifs (parallel)
Often-overlooked but important: restriction site changes affect genotyping assays; motif 
disruption affects transcription factor binding.

### Steps 10–11 — Domain Mapping
Maps the variant position to known protein domains to determine structural/functional impact.

## Common Issues & Troubleshooting

| Problem | Likely Cause | Solution |
|---|---|---|
| No overlapping features | Truly intergenic | Report distance to nearest gene (upstream/downstream) |
| Protein translation mismatch | Variant at exon-intron boundary | Flag as potential splice site variant |
| Multiple overlapping genes | Overlapping annotation | Report all and let user select |
