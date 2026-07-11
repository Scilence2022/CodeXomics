# Autonomous Annotation Workflow

CodeXomics treats Deep Gene Research output as evidence for a proposed annotation change, never as an instruction to modify a genome directly.

## Lifecycle

1. `resolve_annotation_target` returns a stable feature reference, feature hash, and annotation revision.
2. `start_annotation_research` starts a Deep Gene Research task bound to that reference.
3. `get_annotation_research_workflow` retrieves the durable task result and creates a `codexomics.annotation-change-set.v2` proposal.
4. A curator reviews the generated diff and calls `request_annotation_approval`.
5. `apply_annotation_changeset` atomically commits only if the feature hash and annotation revision still match.
6. `rollback_annotation_changeset` creates a new reviewed inverse ChangeSet; rollback is never a hidden mutation.

The legacy `update_annotation`, `bulk_update_annotations`, and `merge_gene_research_report` tools now create previews/ChangeSets rather than applying autonomous changes directly.

## Safety invariants

- A research proposal can only modify a restricted qualifier allowlist.
- It cannot change coordinates, strand, feature type, translation, or sequence.
- Each ChangeSet has a target feature hash, base revision, idempotency key, evidence list, audit events, and a short-lived approval capability.
- The ledger is persisted in the loaded genome's `.CodeXomics` sidecar under `annotationCuration`; the source genome remains unchanged until a reviewed export is made.
- A DGR proposal without a CodeXomics target is a `draft_requires_target` and cannot be committed.

## Local development configuration

CodeXomics MCP binds to `127.0.0.1` by default. Configure a bearer key for external agents:

```bash
export CODEXOMICS_MCP_MASTER_KEY='replace-with-a-long-random-secret'
export DGR_MCP_TOKEN='replace-with-the-dgr-access-password'
export ACCESS_PASSWORD="$DGR_MCP_TOKEN"
```

DGR now fails closed unless `ACCESS_PASSWORD` is configured. `DGR_ALLOW_INSECURE_LOCAL=true` exists only for non-production local development.

## External agent sequence

External Codex, Claude, or OpenClaw agents should use CodeXomics tools mode:

```text
resolve_annotation_target
  -> DGR deep-gene-research(target, idempotencyKey)
  -> DGR get-task-status
  -> create_annotation_changeset
  -> human approval
  -> apply_annotation_changeset
```

Do not use CodeXomics agent mode as a wrapper around a structured annotation commit. That mode intentionally translates calls into natural-language ChatBox prompts and is not the transaction boundary.
