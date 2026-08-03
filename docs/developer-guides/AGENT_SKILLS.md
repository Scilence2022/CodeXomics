# Agent Skills

A **Skill** is a reusable, multi-step workflow document that teaches the CodeXomics assistant how to
accomplish a domain task with the existing tool suite. Instead of the assistant improvising a chain of
ten tools, it discovers a skill and follows a workflow that a domain expert already validated.

```
Without skills:  request -> ad-hoc tool calls   -> inconsistent results
With skills:     request -> skill index -> get_skill -> expert workflow -> reliable results
```

## Progressive disclosure

Skills are cheap to have installed. Only a compact index — id, description, trigger phrases, and
requirements — is injected into the system prompt. A skill's full workflow body is loaded only when the
assistant decides the skill applies and calls `get_skill`.

| Stage                     | What the model sees          | Cost                    |
| ------------------------- | ---------------------------- | ----------------------- |
| Always (system prompt)    | `===AGENT SKILLS===` index   | ~1 line per skill       |
| On demand (`get_skill`)   | The full workflow body       | Only for the skill used |
| On demand (`list_skills`) | Filtered index with metadata | Only when asked         |

Skill bodies are never included in registry snapshots, so an installed-but-unused skill costs nothing
beyond its index line.

## Where skills live

| Source        | Location                           | Notes                                        |
| ------------- | ---------------------------------- | -------------------------------------------- |
| Built-in      | `.agent/skills/` in the app bundle | Ships with CodeXomics; read-only             |
| User-provided | `skills/` in the userData folder   | Open it from Settings, or add files yourself |

Open the user folder from **Multi-Agent Settings -> Skills -> Open Folder**. A user skill may not reuse
the id of a built-in skill; the loader reports an error diagnostic and keeps the built-in.

## Supported formats

Both layouts are discovered from either root.

### Anthropic Agent Skill format

A directory containing `SKILL.md` with `name` and `description` frontmatter. Supporting files in the
directory are exposed as skill resources.

```
skills/
└── codon-optimizer/
    ├── SKILL.md
    └── references/
        └── ecoli-usage.tsv
```

```markdown
---
name: codon-optimizer
description: Optimize a coding sequence for expression in a target host using codon usage tables.
license: MIT
allowed-tools: [get_coding_sequence, codon_usage_analysis, translate_dna]
---

# Codon Optimizer

1. Fetch the CDS with `get_coding_sequence`.
2. ...
```

### CodeXomics native format

A single `<skill_id>.md` file with richer frontmatter — ordered `steps`, `parallel_groups`,
`preconditions`, and an `outputs` template. `SKILL_REGISTRY.yaml` in the same directory supplies extra
discovery metadata (category, tags, duration, `requires_genome`, `requires_network`).

```markdown
---
name: primer_design
version: 1.0.0
description: |
  Design a validated PCR primer pair for a target gene or genomic region.
category: primer_design
triggers:
  - 'design primers for [gene]'
steps:
  - id: get_target_sequence
    tool: get_sequence
    ...
parallel_groups:
  - group_id: primer_property_calcs
    steps: [calc_forward_props, calc_reverse_props]
outputs:
  summary_template: |
    ...
---
```

`steps`, `parallel_groups`, and `outputs` are top-level frontmatter keys. Nesting `parallel_groups`
inside the `steps:` sequence is invalid YAML and the skill will be skipped with a diagnostic.

## Tools

| Tool          | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `list_skills` | Enumerate skills, optionally filtered by `category` or `query` |
| `get_skill`   | Load one skill's full workflow by `skill_id`                   |

`get_skill` returns both halves of the document. A native skill keeps its executable plan in the
frontmatter, so returning the Markdown alone would strip exactly the part the assistant runs:

- `workflow` — `inputs`, `preconditions`, `steps`, `parallel_groups`, `outputs`, `agent_notes`
- `guide` — the Markdown body: rationale, result interpretation, troubleshooting

Discovery metadata (name, description, tags, triggers) is omitted from `workflow`; it already
travels in the snapshot and the prompt index.

```json
{ "tool_name": "list_skills", "parameters": { "category": "annotation" } }
{ "tool_name": "get_skill", "parameters": { "skill_id": "primer_design" } }
```

Both are read-only system tools and are exempt from the repeated-call execution limits.

## Benchmark isolation

Skills are deliberately invisible to the benchmark. `LLMContextService.getSkillsContextString()`
returns an empty string whenever `ChatManager.isBenchmarkMode()` is true, so benchmark prompts are
byte-identical to what they were before skills existed, and the model is never tempted into
`list_skills` / `get_skill` calls that the oracle does not expect. Installing or enabling skills
therefore cannot move a benchmark score.

For the same reason, `list_skills` and `get_skill` are listed in `BUILTIN_TOOL_EXEMPTIONS` in
`test/unit/benchmark-suite-coverage.test.js` instead of being given benchmark cases.

## Enabling and disabling

Every skill has a toggle in **Multi-Agent Settings -> Skills**. Disabled ids are persisted to
`skills.disabledIds` in the app configuration. A disabled skill is dropped from the prompt index, hidden
from `list_skills`, and refused by `get_skill`.

## Architecture

```
.agent/skills/  +  userData/skills/
        |
        v
SkillRegistryService  (main process; parses, sanitizes, caches)
        |  IPC: skill-registry:get-snapshot | get-skill | get-resource | reload
        v
SkillService  (renderer; caches snapshot, applies enable/disable)
        |                              |
        v                              v
LLMContextService                 ChatManager.executeLocalTool
(prompt index)                    (list_skills / get_skill)
```

| Layer       | File                                                      |
| ----------- | --------------------------------------------------------- |
| Main        | `src/main/skill-registry-service.js`                      |
| IPC         | `src/main/ipc-handlers.js`, `src/preload.js`              |
| Renderer    | `src/renderer/modules/chat/services/SkillService.js`      |
| Prompt      | `src/renderer/modules/chat/services/LLMContextService.js` |
| Settings UI | `src/renderer/modules/SkillsSettingsManager.js`           |

The renderer never reads skill directories directly. It consumes sanitized JSON snapshots from the main
process, matching the boundary already used by the tool registry.

## Safety limits

- Skill ids must match `^[a-z0-9][a-z0-9_-]*$` and be at most 64 characters.
- Skill documents and resources are capped at 512 KB each.
- At most 200 skills per root, 50 resources per skill, 3 levels of bundle nesting.
- Symlinked entries are skipped.
- Resource reads are restricted to files the snapshot already declared, and resolved paths must stay
  inside the skill directory.
- A malformed skill produces a diagnostic (visible in the Skills tab) and is skipped; it never breaks
  the rest of the registry.

## Adding a skill

1. Put the skill in the user skills folder using either format.
2. Press **Reload** in the Skills tab.
3. Check the diagnostics area for parse warnings.
4. Ask the assistant something matching one of the skill's triggers, and confirm it calls `get_skill`.
