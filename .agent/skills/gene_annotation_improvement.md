---
name: gene_annotation_improvement
version: 1.0.0
description: |
  Enrich and improve the functional annotation of a gene by cross-referencing multiple 
  biological databases (UniProt, InterPro, AlphaFold) and synthesizing a comprehensive 
  evidence-based annotation summary.

category: annotation
tags:
  - annotation
  - gene_function
  - uniprot
  - interpro
  - protein_domains
  - evidence_based

triggers:
  - "improve annotation for [gene]"
  - "what is the function of [gene]?"
  - "get more information about [gene/protein]"
  - "annotate [gene] using databases"
  - "enrich [gene] annotation"
  - "find the function of [locus_tag]"
  - "what domains does [gene/protein] have?"

preconditions:
  - condition: genome_loaded
    description: A genome file with annotations must be loaded
    check_tool: get_current_state
    required: true

inputs:
  gene_identifier:
    type: string
    description: Gene name, locus_tag, or protein ID to annotate
    required: true
  organism:
    type: string
    description: Organism name for database searches (improves specificity)
    required: false
    default: ""
  include_structure:
    type: boolean
    description: Whether to fetch AlphaFold 3D structure information (default true)
    default: true
  include_pathways:
    type: boolean
    description: Whether to search for pathway associations (default true)
    default: true

steps:
  - id: navigate_to_gene
    description: "Navigate the viewer to the target gene"
    tool: jump_to_gene
    parameters:
      geneName: "{{input.gene_identifier}}"
    on_error: skip

  - id: get_gene_details
    description: "Retrieve comprehensive gene information from the loaded genome"
    tool: get_gene_details
    parameters:
      identifier: "{{input.gene_identifier}}"
    on_error: abort
    store_result_as: gene_details

  - id: get_coding_sequence
    description: "Extract the CDS nucleotide sequence"
    tool: get_coding_sequence
    parameters:
      identifier: "{{input.gene_identifier}}"
    depends_on: [get_gene_details]
    on_error: skip
    store_result_as: cds

  - id: translate_protein
    description: "Translate CDS to amino acid sequence for database searches"
    tool: translate_dna
    parameters:
      dna: "{{steps.cds.sequence}}"
      frame: 0
    depends_on: [get_coding_sequence]
    condition: "{{steps.cds.sequence}} != null"
    on_error: skip
    store_result_as: protein_sequence

  - id: search_uniprot
    description: "Search UniProt for functionally characterized homologs"
    tool: search_uniprot_database
    parameters:
      query: "{{input.gene_identifier}}"
      organism: "{{input.organism}}"
      limit: 5
    depends_on: [get_gene_details]
    on_error: skip
    store_result_as: uniprot_hits

  - id: get_uniprot_entry
    description: "Fetch detailed UniProt record for the top hit"
    tool: get_uniprot_entry
    parameters:
      uniprotId: "{{steps.uniprot_hits.entries[0].accession}}"
    depends_on: [search_uniprot]
    condition: "{{steps.uniprot_hits.total}} > 0"
    on_error: skip
    store_result_as: uniprot_entry

  - id: analyze_domains
    description: "Identify conserved protein domains via InterPro"
    tool: analyze_interpro_domains
    parameters:
      uniprotId: "{{steps.uniprot_hits.entries[0].accession}}"
    depends_on: [get_uniprot_entry]
    condition: "{{steps.uniprot_hits.total}} > 0"
    on_error: skip
    store_result_as: domain_analysis

  - id: search_alphafold
    description: "Find predicted 3D protein structure"
    tool: search_alphafold_by_gene
    parameters:
      geneName: "{{input.gene_identifier}}"
      organism: "{{input.organism}}"
    condition: "{{input.include_structure}} == true"
    on_error: skip
    store_result_as: alphafold_result

  - id: codon_usage
    description: "Analyze codon usage bias to infer expression level and horizontal gene transfer"
    tool: codon_usage_analysis
    parameters:
      sequence: "{{steps.cds.sequence}}"
    depends_on: [get_coding_sequence]
    condition: "{{steps.cds.sequence}} != null"
    on_error: skip
    store_result_as: codon_data

  - id: find_nearby_features
    description: "Identify genomic context — neighbouring genes, operons"
    tool: get_nearby_features
    parameters:
      chromosome: "{{steps.gene_details.chromosome}}"
      position: "{{steps.gene_details.start}}"
      radius: 5000
    depends_on: [get_gene_details]
    on_error: skip
    store_result_as: neighborhood

  # Run database searches in parallel (they are independent)
  parallel_groups:
    - group_id: database_searches
      steps: [search_uniprot, search_alphafold]
    - group_id: sequence_analysis
      steps: [get_coding_sequence, find_nearby_features]

outputs:
  summary_template: |
    ## 🔬 Annotation Report — {{input.gene_identifier}}

    ### Basic Information
    - **Locus tag:** {{steps.gene_details.locus_tag}}
    - **Location:** {{steps.gene_details.chromosome}}:{{steps.gene_details.start}}–{{steps.gene_details.end}} ({{steps.gene_details.strand}})
    - **CDS length:** {{steps.cds.length}} bp → {{steps.protein_sequence.length}} aa

    ### UniProt Evidence
    - **Top match:** {{steps.uniprot_entry.protein_name}} ({{steps.uniprot_hits.entries[0].accession}})
    - **Reviewed:** {{steps.uniprot_entry.reviewed}}
    - **Function:** {{steps.uniprot_entry.function}}
    - **GO terms:** {{steps.uniprot_entry.go_terms}}

    ### Protein Domains (InterPro)
    {{steps.domain_analysis.domains_table}}

    ### 3D Structure
    - **AlphaFold model:** {{steps.alphafold_result.model_id}} (confidence: {{steps.alphafold_result.confidence}})

    ### Codon Usage
    - {{steps.codon_data.summary}}

    ### Genomic Neighbourhood
    - {{steps.neighborhood.summary}}

    ---
    > **Suggested annotation update:**  
    > *product*: {{steps.uniprot_entry.protein_name}}  
    > *function*: {{steps.uniprot_entry.function}}  
    > *db_xref*: UniProtKB:{{steps.uniprot_hits.entries[0].accession}}

  actions_on_success:
    - navigate_to_result: true
    - highlight_features: true

expected_duration:
  min_seconds: 15
  max_seconds: 120
  note: "Database queries (UniProt, InterPro, AlphaFold) are the main latency factor."

agent_notes: |
  - Always present a "Suggested annotation update" block with the recommended product name 
    and function for the user to review.
  - If UniProt returns 0 hits, try an advanced search with the protein sequence directly 
    (`advanced_uniprot_search` with sequence query).
  - Warn the user if the gene is annotated as "hypothetical protein" and no homologs are found 
    — this could indicate a truly novel gene.
  - Cross-reference domain architecture from InterPro with the GO terms from UniProt to build 
    a more confident functional description.
  - Unusual codon usage may indicate horizontal gene transfer — flag this for the user.
---

## Overview

Many genome annotations contain a significant proportion of genes labelled as "hypothetical 
protein" or with low-confidence functional descriptions. This skill systematically interrogates 
UniProt (curated protein function), InterPro (domain architecture), and AlphaFold (3D structure)
to upgrade these annotations with evidence-based functional descriptions.

The skill follows the principle of **evidence hierarchy**: experimental > reviewed (Swiss-Prot) > 
computational (TrEMBL) > domain-only evidence.

## Step-by-Step Explanation

### Step 1 — `jump_to_gene`
Visual navigation to the target locus — gives the user immediate context before 
the database queries complete.

### Step 2 — `get_gene_details`
Retrieves coordinates, strand, product name, and any existing qualifiers already in the 
annotation file. This is the baseline we are trying to improve.

### Steps 3–4 — `get_coding_sequence` → `translate_dna`
Extracts CDS and protein sequence — essential for sequence-based database searches if the 
gene ID alone doesn't return a UniProt hit.

### Step 5 — `search_uniprot_database`
Queries UniProt by gene name (± organism). Returns a ranked list of homologs.

### Step 6 — `get_uniprot_entry`
Fetches the full annotated record for the top UniProt hit, including function text, 
GO terms, subcellular location, and literature references.

### Step 7 — `analyze_interpro_domains`
Catalogues the protein's domain architecture — often the most reliable functional evidence 
for un-characterized genes.

### Step 8 — `search_alphafold_by_gene` (conditional)
Retrieves structural information. AlphaFold structure can reveal functional sites even when 
sequence similarity is low (structural analogues).

### Step 9 — `codon_usage_analysis`
Codon bias analysis can reveal genes acquired by horizontal gene transfer (unusual codon 
usage compared to the rest of the genome).

### Step 10 — `get_nearby_features`
Genomic neighbourhood (flanking genes, operon context) provides indirect functional evidence 
through the principle of "guilt by association".

## Interpreting Results

Always present:
1. A comparison of the **original annotation** vs. **suggested new annotation**
2. The **evidence chain** (which database, which accession, how confident)
3. A note on whether the top UniProt hit is **reviewed (Swiss-Prot)** or unreviewed (TrEMBL)

## Common Issues & Troubleshooting

| Problem | Likely Cause | Solution |
|---|---|---|
| No UniProt hits | Novel protein or unusual name | Try `advanced_uniprot_search` with protein sequence |
| InterPro returns no domains | Very short gene or non-coding | Report protein length; check if annotation is correct |
| AlphaFold model not found | Non-model organism | Try `search_alphafold_by_sequence` with the protein sequence |
| Gene truly novel | No homologs anywhere | Report as "novel protein, no known homologs" with supporting evidence |
