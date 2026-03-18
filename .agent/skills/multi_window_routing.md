---
name: multi_window_routing
version: 1.0.0
description: |
  Manage multiple CodeXomics genome browser windows to route tool actions, compare sequences, or perform cross-genome analysis.

category: workspace_management
tags:
  - multi_window
  - connection_routing
  - workspace
  - comparison

# When should an agent invoke this skill?
triggers:
  - "list open windows"
  - "what genomes are open"
  - "switch to window"
  - "switch genome"
  - "compare between windows"
  - "search in all open genomes"
  - "route commands to"

# What must be true before this skill can run
preconditions:
  - condition: server_running
    description: The CodeXomics MCP server must be running and able to list windows.
    check_tool: list_genome_windows
    required: true

# The ordered steps of the skill workflow
steps:
  - id: list_windows
    description: "Discover all currently active CodeXomics windows and their loaded genomes."
    tool: list_genome_windows
    parameters: {}
    on_error: abort
    store_result_as: active_windows

  - id: target_selection
    description: "Select the target window based on the user's request and the available genomes."
    tool: switch_active_window
    condition: "{{input.target_window_id}} != null"
    parameters:
      windowId: "{{input.target_window_id}}"
    on_error: abort
    store_result_as: active_window_focus

# What the skill produces, and how to present it
outputs:
  summary_template: |
    ## Multi-Window Execution
    - **Found Windows**: {{steps.active_windows.windowCount}}
    - **Active Window**: Switched to `{{steps.active_window_focus.genomeName}}` (ID: `{{steps.active_window_focus.windowId}}`)
  
  actions_on_success: []

# How long this skill typically takes
expected_duration:
  min_seconds: 1
  max_seconds: 5
  note: "Window switching is instantaneous."

# Additional guidance for the AI agent
agent_notes: |
  - Always call `list_genome_windows` first if you don't know the exact `windowId` (e.g., 'win_1', 'win_2', 'default').
  - The `switch_active_window` tool globally changes where all subsequent client-side sequence and annotation tools are routed.
  - To perform a cross-genome comparison, you must: 
      1) Switch to window A.
      2) Extract sequence/data from A.
      3) Switch to window B.
      4) Extract sequence/data from B.
      5) Compare locally in your context.
---

## Overview

CodeXomics supports opening multiple genome browser windows concurrently. Each window maintains its own separate WebSocket connection to the MCP server.

This skill teaches the AI agent how to dynamically route its tool calls to different active windows. This is critical for tasks that involve querying specific genomes when multiple are open, or for performing comparative genomics tasks (like aligning a sequence from one genome against another).

## Step-by-Step Explanation

### Step 1 — `list_genome_windows`
Before attempting to interact with a genome, the agent needs to know what is available. This tool returns an array of open windows, including their `windowId`, the name of the loaded genome (`genomeName`), and which window is currently focused.

### Step 2 — `switch_active_window`
This tool instructs the MCP server to route all subsequent client-side tool calls (like `get_sequence`, `jump_to_gene`, `get_current_state`) to the specified `windowId`. It also physically focuses the window on the user's screen.

## Cross-Genome Comparison Pattern

To perform comparisons between two loaded genomes, use the following pattern:
1. Execute `list_genome_windows` to find standard IDs.
2. Execute `switch_active_window` for the first genome.
3. Call extraction tools (e.g., `get_coding_sequence`).
4. Execute `switch_active_window` for the second genome.
5. Call extraction tools.
6. Analyze and compare the extracted data.

## Common Issues & Troubleshooting

| Problem | Likely Cause | Solution |
|---|---|---|
| `switch_active_window` fails | Invalid `windowId` | Ensure you used the exact `windowId` string returned by `list_genome_windows`. |
| Tools target the wrong genome | Forgot to switch window | Always call `switch_active_window` before executing localized tools if you are working with multiple genomes. |
| Window count is 0 | No CodeXomics windows connected | Ask the user to open a genome in CodeXomics. |
