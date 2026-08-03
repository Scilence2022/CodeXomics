---
name: primer_design
version: 2.0.0
description: |
  Design a validated PCR primer pair for a gene or genomic region in the loaded genome, with
  hairpin screening, genome-wide off-target checking, and the pair saved to the Primers track.

category: primer_design
tags:
  - primers
  - pcr
  - amplification
  - cloning
  - qpcr

triggers:
  - 'design primers for [gene]'
  - 'create PCR primers to amplify [region]'
  - 'I need primers for [gene]'
  - 'design qPCR primers for [region]'
  - 'primers covering [gene] with [N] bp upstream'

preconditions:
  - condition: genome_loaded
    description: A genome or sequence file must be loaded in CodeXomics
    check_tool: get_current_state
    required: true

# ─── Skill Inputs ─────────────────────────────────────────────────────────────
inputs:
  gene_or_region:
    type: string
    description: Gene name or locus_tag. For coordinates, pass chromosome/start/end instead.
    required: true
  upstream_bp:
    type: number
    description: Bases upstream of the gene start that the amplicon must include (default 0)
    default: 0
  downstream_bp:
    type: number
    description: Bases downstream of the gene end that the amplicon must include (default 0)
    default: 0
  target_tm:
    type: number
    description: Target melting temperature in °C (default 60)
    default: 60
  min_product_size:
    type: number
    description: Minimum amplicon size in bp (default 100)
    default: 100
  max_product_size:
    type: number
    description: Maximum amplicon size in bp (default 1000)
    default: 1000
  check_specificity:
    type: boolean
    description: Scan the loaded genome for off-target binding sites (default true)
    default: true
  save_to_track:
    type: boolean
    description: Save the pair to the Primers track (default true)
    default: true

# ─── Workflow Steps ────────────────────────────────────────────────────────────
steps:
  - id: check_state
    description: 'Confirm a genome is loaded and read the exact chromosome/contig names'
    tool: get_current_state
    on_error: abort
    store_result_as: state

  - id: design_pair
    description: >-
      Design the primer pair. design_primers resolves the gene itself and extracts the
      sequence with primer-binding buffer, so no separate lookup or get_sequence call is needed.
    tool: design_primers
    parameters:
      geneName: '{{input.gene_or_region}}'
      upstreamBp: '{{input.upstream_bp}}'
      downstreamBp: '{{input.downstream_bp}}'
      targetTm: '{{input.target_tm}}'
      minProductSize: '{{input.min_product_size}}'
      maxProductSize: '{{input.max_product_size}}'
    depends_on: [check_state]
    on_error: abort
    store_result_as: pair

  - id: navigate
    description: 'Bring the amplicon into view so the user can see it in genomic context'
    tool: jump_to_gene
    parameters:
      geneName: '{{input.gene_or_region}}'
    depends_on: [design_pair]
    on_error: skip

  - id: hairpin_forward
    description: 'Screen the forward primer for hairpin potential (not returned by design_primers)'
    tool: calculate_primer_properties
    parameters:
      sequence: '{{steps.pair.forward.sequence}}'
    depends_on: [design_pair]
    on_error: skip
    store_result_as: fwd_props

  - id: hairpin_reverse
    description: 'Screen the reverse primer for hairpin potential'
    tool: calculate_primer_properties
    parameters:
      sequence: '{{steps.pair.reverse.sequence}}'
    depends_on: [design_pair]
    on_error: skip
    store_result_as: rev_props

  - id: specificity_forward
    description: >-
      Scan the loaded genome for forward-primer binding sites. With no templateSequence the
      tool searches the active genome, which is the specificity question that matters here.
    tool: find_primer_binding_sites
    condition: '{{input.check_specificity}} == true'
    parameters:
      sequence: '{{steps.pair.forward.sequence}}'
      scoringMode: 'thermodynamic'
      maxMismatches: 3
      max3PrimeMismatches: 1
    depends_on: [design_pair]
    on_error: skip
    store_result_as: fwd_sites

  - id: specificity_reverse
    description: 'Scan the loaded genome for reverse-primer binding sites'
    tool: find_primer_binding_sites
    condition: '{{input.check_specificity}} == true'
    parameters:
      sequence: '{{steps.pair.reverse.sequence}}'
      scoringMode: 'thermodynamic'
      maxMismatches: 3
      max3PrimeMismatches: 1
    depends_on: [design_pair]
    on_error: skip
    store_result_as: rev_sites

  - id: save_forward
    description: 'Save the forward primer to the Primers track at its genomic binding site'
    tool: save_primer
    condition: '{{input.save_to_track}} == true'
    parameters:
      name: '{{input.gene_or_region}}_F'
      chromosome: '{{steps.pair.target.chromosome}}'
      start: '{{steps.pair.forward.genomicStart}}'
      end: '{{steps.pair.forward.genomicEnd}}'
      strand: '{{steps.pair.forward.strand}}'
      sequence: '{{steps.pair.forward.sequence}}'
      description: 'Tm {{steps.pair.forward.tm}}°C, GC {{steps.pair.forward.gcContent}}%'
    depends_on: [design_pair]
    on_error: skip

  - id: save_reverse
    description: 'Save the reverse primer to the Primers track'
    tool: save_primer
    condition: '{{input.save_to_track}} == true'
    parameters:
      name: '{{input.gene_or_region}}_R'
      chromosome: '{{steps.pair.target.chromosome}}'
      start: '{{steps.pair.reverse.genomicStart}}'
      end: '{{steps.pair.reverse.genomicEnd}}'
      strand: '{{steps.pair.reverse.strand}}'
      sequence: '{{steps.pair.reverse.sequence}}'
      description: 'Tm {{steps.pair.reverse.tm}}°C, GC {{steps.pair.reverse.gcContent}}%'
    depends_on: [design_pair]
    on_error: skip

parallel_groups:
  - group_id: primer_quality_checks
    steps: [hairpin_forward, hairpin_reverse, specificity_forward, specificity_reverse]
  - group_id: primer_track_writes
    steps: [save_forward, save_reverse]

outputs:
  summary_template: |
    ## 🧫 Primer pair for {{input.gene_or_region}}

    | | Forward | Reverse |
    |---|---|---|
    | Sequence (5'→3') | `{{steps.pair.forward.sequence}}` | `{{steps.pair.reverse.sequence}}` |
    | Length | {{steps.pair.forward.length}} nt | {{steps.pair.reverse.length}} nt |
    | Tm | {{steps.pair.forward.tm}}°C | {{steps.pair.reverse.tm}}°C |
    | GC | {{steps.pair.forward.gcContent}}% | {{steps.pair.reverse.gcContent}}% |
    | Position | {{steps.pair.forward.genomicStart}}–{{steps.pair.forward.genomicEnd}} ({{steps.pair.forward.strand}}) | {{steps.pair.reverse.genomicStart}}–{{steps.pair.reverse.genomicEnd}} ({{steps.pair.reverse.strand}}) |
    | Hairpin risk | {{steps.fwd_props.hasHairpinPotential}} | {{steps.rev_props.hasHairpinPotential}} |
    | Genome binding sites | {{steps.fwd_sites.sites.length}} | {{steps.rev_sites.sites.length}} |

    **Amplicon:** {{steps.pair.productSize}} bp ({{steps.pair.target.productStart}}–{{steps.pair.target.productEnd}}) · **ΔTm:** {{steps.pair.tmDifference}}°C

    Report every entry in `{{steps.pair.warnings}}` verbatim — it states when the requested
    upstream/downstream margin could not be met.

  actions_on_success:
    - navigate_to_result: true

expected_duration:
  min_seconds: 5
  max_seconds: 30
  note: 'Runs entirely against the loaded genome. Optional BLAST validation adds 30–60s of network time.'

agent_notes: |
  - Call design_primers ONCE with geneName. It resolves the gene, extracts the region with
    binding buffer, and designs the pair. Do NOT chain find_gene_by_name → get_sequence →
    design_primers; get_sequence has no padding parameter and the manual chain drops the
    genomic coordinate mapping that save_primer needs.
  - For coordinates instead of a gene, pass chromosome/start/end to design_primers. Use an exact
    name from the loaded chromosome list in get_current_state.
  - Results are nested: forward/reverse are objects. Use pair.forward.sequence, not
    pair.forwardPrimer. Genomic positions are genomicStart/genomicEnd, present only when the
    design was anchored to a gene or coordinates.
  - upstream/downstream are biological, not coordinate-based. On a reverse-strand gene,
    upstream means HIGHER coordinates. design_primers already handles this; do not flip it.
  - find_primer_binding_sites takes ONE primer per call, so the forward and reverse checks are
    two separate calls. Omit templateSequence to search the loaded genome.
  - Exactly one binding site per primer is the specific case. Two or more means possible
    off-target amplification: report the extra sites with their coordinates and Tm, and offer to
    redesign with a tighter Tm window or a shifted target interval.
  - design_primers returns { error } rather than throwing when no pair satisfies the
    constraints. Surface that message and suggest widening max_product_size or lowering
    target_tm — do not retry silently with the same parameters.
  - Only reach for blast_search when specificity must be checked against organisms outside the
    loaded genome. It requires blastType ('blastn') and database ('nt'); maxTargets, not max_hits.
    For "is this pair specific in this genome", find_primer_binding_sites is the correct tool.
  - Warn when Tm difference exceeds 3°C, when either GC falls outside 40–60%, or when either
    primer reports hasHairpinPotential.
---

## Overview

Designs a PCR primer pair against the genome currently loaded in CodeXomics, screens it, and
writes it to the Primers track so the amplicon is visible in genomic context.

The design step is a single `design_primers` call. That tool already performs gene lookup,
sequence extraction with primer-binding buffer, and coordinate mapping back to the genome — so
the older pattern of resolving the gene and fetching sequence by hand is both unnecessary and
lossy, because it discards the genomic mapping the later steps need.

## Workflow

| #   | Step                             | Purpose                                             |
| --- | -------------------------------- | --------------------------------------------------- |
| 1   | `get_current_state`              | Confirm a genome is loaded; read exact contig names |
| 2   | `design_primers`                 | Resolve gene, extract region, design the pair       |
| 3   | `jump_to_gene`                   | Show the amplicon in context                        |
| 4   | `calculate_primer_properties` ×2 | Hairpin screening (parallel)                        |
| 5   | `find_primer_binding_sites` ×2   | Genome-wide off-target scan (parallel)              |
| 6   | `save_primer` ×2                 | Write both primers to the Primers track             |

Steps 4 and 5 are independent of each other and run as one parallel group.

## What each step adds

**`design_primers`** returns `forward` and `reverse` objects — each with `sequence`, `tm`,
`gcContent`, `length`, and, when anchored to a gene or coordinates, `genomicStart`,
`genomicEnd`, and `strand`. Alongside them: `productSize`, `tmDifference`, a `target` block
describing the amplicon interval and how much upstream/downstream margin was achieved, and
`warnings` when a requested margin could not be met.

**`calculate_primer_properties`** is not a repeat of the design output. Tm, GC, and length are
already known; the field worth having is `hasHairpinPotential`.

**`find_primer_binding_sites`** answers the specificity question that matters for a loaded
genome. With `scoringMode: 'thermodynamic'` each site carries a predicted binding Tm, so a weak
partial match is distinguishable from a real off-target. One site per primer is the clean result.

**`save_primer`** needs `name`, `chromosome`, `start`, `end` — which is why the design step must
keep its genomic mapping. It writes to the Primers track and makes the track visible.

## Interpreting results

| Signal                     | Reading                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `tmDifference` > 3°C       | Unequal annealing; redesign with a tighter Tm window         |
| `gcContent` outside 40–60% | AT- or GC-rich region; expect weaker or non-specific binding |
| `hasHairpinPotential` true | Primer may self-fold; prefer an alternative pair             |
| `sites.length` > 1         | Off-target binding; report coordinates and Tm of extra sites |
| `warnings` non-empty       | Requested upstream/downstream margin not fully met           |

## Troubleshooting

| Problem                              | Cause                              | Action                                                          |
| ------------------------------------ | ---------------------------------- | --------------------------------------------------------------- |
| `design_primers` returns `{ error }` | No pair satisfies the constraints  | Widen `max_product_size`, lower `target_tm`; don't retry as-is  |
| Gene not found                       | Name/locus_tag mismatch            | Ask for the exact locus_tag, or pass chromosome/start/end       |
| `save_primer` fails                  | Design lacked genomic coordinates  | Re-run `design_primers` with `geneName` or explicit coordinates |
| Many binding sites                   | Repetitive region or short primers | Raise `minBindingTm`, or shift the target interval              |
| Upstream margin not met              | Chromosome boundary reached        | Reported in `warnings`; relay it rather than silently accepting |
