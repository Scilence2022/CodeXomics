---
# CodeXomics Agent Skill Template
# Copy this file to create a new skill.

name: skill_name # machine-readable identifier (snake_case)
version: 1.0.0
description: | # one-sentence summary for skill discovery
  A clear description of what this skill does and when to use it.

category: category_name # e.g. primer_design, annotation, research
tags:
  - tag1
  - tag2

# When should an agent invoke this skill?
triggers:
  - 'Example user utterance that should invoke this skill'
  - 'Another trigger phrase'

# What must be true before this skill can run
preconditions:
  - condition: genome_loaded
    description: A genome/sequence file must be open in CodeXomics
    check_tool: get_current_state
    required: true
  - condition: annotation_loaded
    description: Gene annotations must be available
    check_tool: get_current_state
    required: false

# The ordered steps of the skill workflow
steps:
  - id: step_1
    description: 'Short human-readable description'
    tool: tool_name_here
    parameters:
      param1: '{{input.param1}}' # reference skill inputs with {{input.*}}
      param2: '{{steps.step_0.result}}' # reference prior step results with {{steps.*}}
    on_error: abort # abort | skip | retry
    store_result_as: step1_result # optional: named variable for later reference

  - id: step_2
    description: 'Next step'
    tool: another_tool
    parameters:
      sequence: '{{steps.step1_result}}'
    depends_on: [step_1] # explicit dependency (for parallel scheduling)
    on_error: skip

  # Conditional step example
  - id: step_3
    description: 'Conditional step'
    tool: optional_tool
    condition: '{{steps.step_2.result}} != null'
    parameters:
      data: '{{steps.step_2.result}}'
    on_error: skip

# Parallel execution groups (optional)
# Steps in the same group run concurrently if they have no inter-dependencies
parallel_groups:
  - group_id: group_a
    steps: [step_2, step_3]

# What the skill produces, and how to present it
outputs:
  summary_template: |
    ## Results
    - **Key result**: {{steps.step1_result}}
    - **Secondary result**: {{steps.step_2.result}}

  actions_on_success:
    - navigate_to_result: true # navigate the viewer to the result location
    - highlight_features: true # highlight annotated features

# How long this skill typically takes
expected_duration:
  min_seconds: 5
  max_seconds: 60
  note: 'Duration depends on sequence length and network latency.'

# Additional guidance for the AI agent
agent_notes: |
  - Always validate results before presenting to the user.
  - If a step fails due to missing data, inform the user and suggest the precondition to fix.
  - Prefer batch tool calls where tools are independent.
---

## Overview

Detailed explanation of what this skill accomplishes, the bioinformatics rationale behind the
step order, and any edge cases to be aware of.

## Step-by-Step Explanation

### Step 1 — `tool_name_here`

Why this tool is called first...

### Step 2 — `another_tool`

What this step accomplishes and what the output means...

## Interpreting Results

How to read and communicate the final output to the user.

## Common Issues & Troubleshooting

| Problem                   | Likely Cause       | Solution                                     |
| ------------------------- | ------------------ | -------------------------------------------- |
| Tool returns empty result | No data loaded     | Check preconditions with `get_current_state` |
| Unexpected error          | Parameter mismatch | Validate inputs before calling               |
