# CodeXomics Agent Skills

This directory contains the **built-in Agent Skills** that ship with CodeXomics — reusable, composable
multi-step workflows that teach AI agents how to accomplish complex bioinformatics tasks using
the CodeXomics tool suite.

These skills are loaded at runtime by `SkillRegistryService` and surfaced to the in-app assistant
through the `list_skills` and `get_skill` tools. Users can add their own skills — in this format or in
the Anthropic `SKILL.md` bundle format — under the `skills/` folder in their userData directory, and
manage them from **Multi-Agent Settings -> Skills**.

For the runtime architecture, formats, and limits, see
[`docs/developer-guides/AGENT_SKILLS.md`](../../docs/developer-guides/AGENT_SKILLS.md).

## What Are Agent Skills?

A Skill encodes domain expertise: the _correct sequence of MCP tool calls_, with logic for
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
└── primer_design.md             ← PCR primer design pipeline
```

## Available Skills

| Skill                             | Trigger Keywords                           | Tools Used | Duration |
| --------------------------------- | ------------------------------------------ | ---------- | -------- |
| [primer_design](primer_design.md) | "design primers", "PCR primers", "amplify" | 6          | ~20s     |

Only one skill ships built-in. A skill earns its place by encoding knowledge the assistant would
otherwise get wrong — the exact tool for the job, the parameter names, the failure modes. A
workflow that just restates what the tool descriptions already say is better left out, because
every installed skill costs a line in the system prompt.

## How AI Agents Should Use Skills

Inside CodeXomics, steps 1–3 are handled for you: the skill index is already in the system prompt, and
`get_skill` returns the parsed workflow. External agents reading this directory directly should follow
the manual path below.

### Step 1 — Discover Available Skills

In-app: the `===AGENT SKILLS===` prompt section, or call `list_skills`.
Externally: read `SKILL_REGISTRY.yaml` to get the list of skills and their trigger keywords.

### Step 2 — Match User Intent to a Skill

Compare the user's request against `triggers` in the registry. Use `selection_guidance`
in the registry to resolve ambiguous cases.

### Step 3 — Parse the Skill File

In-app: call `get_skill` with the `skill_id`.
Externally: load the matching `skill.md` file and extract the YAML frontmatter for the structured
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
inputs: { parameter schema }
steps: [ordered tool execution plan]
parallel_groups: [independent steps that can run concurrently]
outputs: { result template and viewer actions }
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
