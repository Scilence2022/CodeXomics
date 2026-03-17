# CodeXomics Agent Skills

This directory contains **Agent Skills** for the CodeXomics MCP Server — reusable, composable 
multi-step workflows that teach AI agents how to accomplish complex bioinformatics tasks using 
the CodeXomics tool suite.

## What Are Agent Skills?

A Skill encodes domain expertise: the *correct sequence of MCP tool calls*, with logic for 
parallelism, error handling, conditional branching, and result synthesis. Rather than an AI 
agent figuring out the right chain of 10+ tools on its own, it discovers and executes a Skill.

```
Without Skills:   AI agent → ad-hoc tool calls → inconsistent results
With Skills:      AI agent → SKILL_REGISTRY.yaml → expert workflow → reliable results
```

## Structure

```
.agent/skills/
├── SKILL_REGISTRY.yaml          ← Machine-readable index of all skills (start here)
├── SKILL_TEMPLATE.md            ← Template for creating new skills
├── primer_design.md             ← PCR primer design pipeline
├── gene_annotation_improvement.md  ← Evidence-based annotation enrichment
├── automated_research.md        ← Comprehensive gene research report
├── variant_context_analysis.md  ← Genomic variant functional context
└── operon_analysis.md           ← Prokaryotic operon characterization
```

## Available Skills

| Skill | Trigger Keywords | Tools Used | Duration |
|---|---|---|---|
| [primer_design](primer_design.md) | "design primers", "PCR primers", "amplify" | 10 | ~30s |
| [gene_annotation_improvement](gene_annotation_improvement.md) | "gene function", "improve annotation", "protein domains" | 10 | ~45s |
| [automated_research](automated_research.md) | "research", "comprehensive analysis", "deep dive" | 18 | ~90s |
| [variant_context_analysis](variant_context_analysis.md) | "variant", "SNP", "mutation impact" | 12 | ~30s |
| [operon_analysis](operon_analysis.md) | "operon", "co-regulated genes" | 11 | ~45s |

## How AI Agents Should Use Skills

### Step 1 — Discover Available Skills
Read `SKILL_REGISTRY.yaml` to get the list of skills and their trigger keywords.

### Step 2 — Match User Intent to a Skill
Compare the user's request against `triggers` in the registry. Use `selection_guidance` 
in the registry to resolve ambiguous cases.

### Step 3 — Parse the Skill File
Load the matching `skill.md` file and extract the YAML frontmatter for the structured 
workflow definition (`steps`, `parallel_groups`, `outputs`).

### Step 4 — Check Preconditions
Run the `check_tool` specified in `preconditions` before starting the main workflow.

### Step 5 — Execute the Workflow
Follow the steps in order. Respect `depends_on` chains and run `parallel_groups` 
concurrently where specified.

### Step 6 — Present Results
Use `outputs.summary_template` to format the final response for the user.

## Skill Specification Format

Each skill file has two parts:

### YAML Frontmatter (machine-readable)
```yaml
---
name: skill_id
version: 1.0.0
description: One-line summary for discovery
triggers: [list of user intent patterns]
preconditions: [what must be loaded/available]
inputs: {parameter schema}
steps: [ordered tool execution plan]
parallel_groups: [independent steps that can run concurrently]
outputs: {result template and viewer actions}
agent_notes: |
  Expert guidance for edge cases
---
```

### Markdown Body (human-readable explanation)
- Bioinformatics rationale for the step order
- Detailed explanation of each tool's role  
- Result interpretation guidance
- Troubleshooting table

## Creating New Skills

1. Copy `SKILL_TEMPLATE.md` and fill in all YAML fields
2. Add an entry to `SKILL_REGISTRY.yaml`
3. Verify all `tool:` references exist in the MCP server's tool list
4. Test by running the skill against a real genome

## Tool Availability Notes

Skills reference tools at two levels:
- **Registry-backed tools** (have YAML files in `tools_registry/`) — fully registered
- **Agent-layer tools** — implemented in `ChatManager.js`, `AnalysisAgent.js`, and 
  `MultiAgentSystem.js`; available via MCP but not yet with YAML definitions:
  - `get_nearby_features`, `find_intergenic_regions`, `get_operons`, `find_restriction_sites`

Both sets are accessible through the CodeXomics MCP Server endpoint.
