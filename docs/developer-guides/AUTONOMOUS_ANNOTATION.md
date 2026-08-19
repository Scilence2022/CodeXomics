# Autonomous Annotation Workflow

CodeXomics treats Deep Gene Research (DGR) output as evidence for a proposed annotation change, never as an instruction to modify a genome directly. Research, proposal, approval, and commit are separate durable stages.

## Supported product modes

| Mode           | Agent entry point                                                                                                               | DGR connection                                                                                                                                                             | Transaction boundary                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| External agent | An MCP client such as Codex, Claude, or OpenClaw connects to CodeXomics in **tools mode**. It can also connect to DGR directly. | The external client calls DGR, or CodeXomics calls DGR through its main-process proxy.                                                                                     | Structured CodeXomics ChangeSet tools          |
| Internal agent | The CodeXomics ChatBox chooses the built-in research and ChangeSet tools.                                                       | The Electron main process proxies only the three durable annotation-workflow DGR tools for registered genome renderers; the renderer never receives the DGR bearer secret. | The same structured CodeXomics ChangeSet tools |

CodeXomics **agent mode** is a natural-language gateway to the ChatBox and intentionally exposes only `codexomics_chat`, `list_genome_windows`, and `switch_active_window`. Do not use agent mode as the transaction boundary for a structured annotation commit.

## Lifecycle

1. `resolve_annotation_target` returns an exact feature reference, assembly and feature hashes, and the current annotation revision.
2. `start_annotation_research` starts an idempotent DGR task bound to that target and to a bounded snapshot of its current scientific qualifiers. A client calling DGR directly must derive and pass the same `currentAnnotation` snapshot from the `annotation.qualifiers` returned by `resolve_annotation_target`.
3. `get_annotation_research_workflow` polls the durable task. On first completion, the Electron main process separately fetches `resultMode: "full"`, verifies the task, correlation, proposal, and exact CDS target, and stores a content-addressed JSON artifact under the CodeXomics application-data directory. Only bounded attachment metadata is written to the genome sidecar. A caller with `annotation:propose` materializes evidence-backed output as a reviewable `codexomics.annotation-change-set.v2`; a research-only caller durably records completion without losing the proposal, then a later propose-capable caller can materialize it. Direct DGR clients poll `get-task-status` with `resultMode: "annotation"`, call CodeXomics `archive_annotation_research` with the exact task, correlation, and resolved CDS identifier, and then pass `result.annotationProposal` plus `researchRun: taskId` to `create_annotation_changeset`. The CodeXomics ChatBox performs the final step for its own direct runs: when it polls a `deep-gene-research` task to completion it materializes the returned proposal as a reviewable ChangeSet automatically, bound to the task through `researchRun`. A proposal that is `draft_requires_evidence` or `draft_requires_target`, or one whose provenance chain is incomplete, is reported in the chat rather than forced through.
4. A curator reviews the generated diff and calls either `request_annotation_approval` or `reject_annotation_changeset`. Rejection records the reason and revokes any issued approval capability.
5. `apply_annotation_changeset` commits only if the approval capability, immutable ChangeSet hash, assembly identity, and target feature hash still match. An unrelated feature commit may advance the global revision and is safely rebased; a change to the proposed feature makes the ChangeSet stale.
6. `rollback_annotation_changeset` creates a new reviewed inverse ChangeSet. Rollback is never a hidden mutation.

The legacy `update_annotation`, `bulk_update_annotations`, and `merge_gene_research_report` tools create previews and ChangeSets rather than applying autonomous changes directly.

## Genome and annotation input boundary

Autonomous ChangeSets operate on the loaded genome's primary `currentAnnotations` collection:

- GenBank files with embedded features work directly.
- For FASTA plus GFF, load or merge the GFF features into the primary annotation set before resolving a target.
- Separate display-only annotation tracks are not commit targets.

Always resolve the target after the intended genome and primary annotations are loaded. Switching genomes or replacing that annotation collection invalidates an in-flight local operation.

## Safety invariants

- A DGR proposal can only modify the conservative qualifier allowlist. It cannot change coordinates, strand, feature type, translation, or sequence.
- Every proposed qualifier value must be linked to supporting evidence. A result with no safe evidence-backed claims remains `draft_requires_evidence`; it is not converted into a ChangeSet.
- A DGR proposal without an exact CodeXomics target is `draft_requires_target` and cannot be committed.
- Annotation-refinement research is restricted to resolved `CDS` features with a stable locus tag or protein identifier. A symbol-only or non-CDS target is rejected before CodeXomics contacts DGR.
- Literature-derived curation facts must use `target_literature`, exactly one non-mutating PubMed evidence record, an exact PMID/DOI identifier match, and a SHA-256-verified abstract span. GeneID-linked contextual papers may appear in the archived bibliography but cannot become facts or annotation operations.
- A completed full report must be archived and registered successfully before its proposal can become a ChangeSet. The report is capped at 16 MiB, stored with mode `0600`, and opened only after SHA-256 verification in a dedicated, local-only, paged JSON viewer.
- For research started directly through the DGR MCP server, pass the exact resolved CDS `target` and its bounded `currentAnnotation` snapshot to DGR, then call `archive_annotation_research` with the task ID, correlation ID, and resolved CDS identifier before `create_annotation_changeset`. CodeXomics re-derives the live snapshot and the main process rejects an omitted or mismatched DGR snapshot before storing the report. It also verifies the full task target, every citation-bound PubMed span, and the exact proposal hash; `researchRun` must then name that archived task.
- A DGR proposal may include `curationNote` plus an `addQualifier(note)` operation. CodeXomics accepts it only when the note text hash matches, every segment exactly reproduces its bound authoritative fact or authenticated PubMed abstract finding, all PMID metadata matches, and the aggregate note claim references the same supporting evidence. The existing CDS note is preserved; the evidence summary is added as a separate qualifier value after curator approval.
- Each ChangeSet binds its target, base revision, operations, evidence manifest, creator, idempotency request, and immutable hash.
- The ChangeSet creator cannot approve the same autonomous proposal. Approval requires either a different authenticated MCP curator or the trusted local confirmation UI.
- The approval token is a short-lived capability, returned when approval is issued and stored only as a secure hash. It is bound to one ChangeSet hash. If it expires or is lost, request approval again; reissuing it revokes the previous capability.
- `apply_annotation_changeset` is idempotent. A successful retry returns the existing commit receipt instead of applying the update twice.
- The source genome file is not edited. Research runs, ChangeSets, audit events, approvals, and commit receipts are written atomically to the adjacent `<genome-basename>.CodeXomics` sidecar. If the source directory is read-only, CodeXomics uses its application-data `sidecar/` fallback. Committed overlays are verified and replayed when the genome is reopened.
- If the source annotations and a committed overlay diverge, CodeXomics stops reconciliation rather than silently overwriting the live annotation.

## Service setup

Run DGR as a long-lived, single-process Node service with durable local storage. Use the same strong secret for the DGR service and the CodeXomics main-process proxy, but configure it separately in each process.

DGR process:

```bash
cd /ABSOLUTE/PATH/TO/deep-gene-research
export ACCESS_PASSWORD='replace-with-at-least-16-random-characters'
export MCP_TASK_STORAGE_FILE='/durable/path/deep-gene-research-tasks.json'
export DGR_WORKER_COUNT=1
# Optional: raises the documented NCBI E-utilities request allowance.
export NCBI_API_KEY='your-ncbi-api-key'
pnpm dev
```

CodeXomics Electron process:

```bash
cd /ABSOLUTE/PATH/TO/CodeXomics
export DGR_MCP_URL='http://127.0.0.1:3000/api/mcp'
export DGR_MCP_TOKEN='the-same-secret-as-dgr-access-password'
npm start
```

`DGR_MCP_URL` defaults to the local URL above. Remote DGR endpoints must use HTTPS. Do not put DGR authorization headers into renderer MCP settings: CodeXomics removes them and reads `DGR_MCP_TOKEN` only in the Electron main process.

The proxy accepts only `deep-gene-research`, `get-task-status`, and `cancel-research-run` tool calls, plus MCP discovery/prompt methods. IPC calls from non-genome renderers are rejected. A compromised registered genome renderer could still exercise those three DGR capabilities, so renderer isolation and the application content-security policy remain part of the trust boundary.

DGR fails closed when `ACCESS_PASSWORD` is absent or shorter than 16 characters. `DGR_ALLOW_UNAUTHENTICATED_DEV=true` is a global, development-only bypass; it is not a loopback restriction and must never be enabled on a shared or production host.

The current DGR durable queue uses one JSON ledger with a process-local write lock. Keep exactly one long-lived Node process and do not share its task file with another process. Vercel, Cloudflare Pages, and other ephemeral-function deployments are unsuitable for durable queued MCP research. Horizontal deployment requires a database-backed queue and cross-process leases.

## External agent mode

Start CodeXomics with its network MCP server in tools mode and keep the Electron genome window open:

```bash
export DGR_MCP_URL='http://127.0.0.1:3000/api/mcp'
export DGR_MCP_TOKEN='the-dgr-access-password'
```

Configure scoped keys, reserve approval and commit for a separate curator identity, and then start the app and server:

```bash
export CODEXOMICS_MCP_API_KEYS_JSON='{
  "research-agent": {
    "apiKey": "replace-with-a-long-research-agent-key",
    "permissions": ["annotation:read", "annotation:research", "annotation:propose"]
  },
  "curator": {
    "apiKey": "replace-with-a-different-long-curator-key",
    "permissions": ["annotation:read", "annotation:approve", "annotation:commit"]
  }
}'
npm run start-with-mcp
```

This command starts the MCP listener inside Electron and routes genome operations directly over authenticated main-process IPC. It does not launch a second privileged standalone server or expose an internal bridge credential to renderer JavaScript.

Combined startup is fail-fast: invalid authentication, port conflicts, or any other MCP startup failure is shown to the operator and terminates the process with a non-zero exit status.

Alternatively, `CODEXOMICS_MCP_MASTER_KEY` configures one administrative credential that can call every tool. It is convenient for an isolated operator session but should not be given to an unattended research agent. Configure either the master key or scoped keys before startup; authentication otherwise fails closed.

CodeXomics supports these annotation scopes:

| Scope                   | Purpose                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `annotation:read`       | Resolve targets and inspect annotations, ChangeSets, and audit events                |
| `annotation:research`   | Start, poll, and cancel target-bound DGR workflows                                   |
| `annotation:propose`    | Create qualifier ChangeSets and reviewed rollbacks                                   |
| `annotation:approve`    | Approve or reject a ChangeSet and issue/revoke its short-lived capability            |
| `annotation:commit`     | Apply an approved ChangeSet                                                          |
| `annotation:structural` | Use structural edit/delete/batch-create tools; do not grant this to a research agent |

Every non-admin scoped key is denied access to tools outside the annotation scope map. `CODEXOMICS_MCP_ENABLE_LOCAL_BYPASS=true` is an explicit development escape hatch, not the default; do not use it in production.

Configure the external client with the research key:

```json
{
  "mcpServers": {
    "codexomics-research": {
      "url": "http://127.0.0.1:3002/mcp",
      "transportType": "streamable-http",
      "headers": {
        "Authorization": "Bearer RESEARCH_AGENT_KEY"
      }
    },
    "deep-gene-research": {
      "url": "http://127.0.0.1:3000/api/mcp",
      "transportType": "streamable-http",
      "headers": {
        "Authorization": "Bearer DGR_ACCESS_PASSWORD"
      }
    }
  }
}
```

Do not place the curator key in an unattended research agent's configuration. A curator can approve from a separate MCP client or from CodeXomics' trusted local confirmation UI.

Two supported external sequences are:

```text
# CodeXomics-managed DGR orchestration
resolve_annotation_target
  -> start_annotation_research
  -> get_annotation_research_workflow (repeat until terminal)
  -> inspect ChangeSet preview and evidence
  -> curator: request_annotation_approval
  -> curator: apply_annotation_changeset

# Direct DGR orchestration
CodeXomics: resolve_annotation_target
  -> derive bounded currentAnnotation from the returned annotation.qualifiers
  -> DGR: deep-gene-research(target, currentAnnotation, idempotencyKey, correlationId)
  -> DGR: get-task-status(taskId, resultMode="annotation")
  -> CodeXomics: archive_annotation_research(taskId, correlationId, identifier)
  -> CodeXomics: create_annotation_changeset(annotationProposal, researchRun=taskId)
  -> inspect ChangeSet preview and evidence
  -> curator approval and apply
```

The CodeXomics-managed sequence archives and attaches the completed report automatically. A task sent directly to DGR is not associated with a CodeXomics workflow until the explicit `archive_annotation_research` call verifies and registers it; after that call, the same report appears in the resolved CDS feature's **Resources** tab and can support a ChangeSet.

Reuse the same idempotency key only for the same semantic request. Reusing it with different research parameters or a different annotation proposal is rejected.

## Internal ChatBox mode

For an internal-only workflow, the CodeXomics network MCP server is not required. Start DGR, launch Electron with `DGR_MCP_URL` and `DGR_MCP_TOKEN`, load the genome and its primary annotations, and ask ChatBox to research the target gene.

The built-in workflow uses the same deterministic sequence:

```text
ChatBox intent
  -> start_annotation_research
  -> durable DGR task
  -> get_annotation_research_workflow
  -> evidence-bound ChangeSet preview
  -> trusted local curator confirmation
  -> apply_annotation_changeset
```

ChatBox may choose the research intent, but it does not free-form the target binding, task association, proposal conversion, approval, or commit checks. If a DGR task is still running, call `get_annotation_research_workflow` again later. Use `cancel_annotation_research` to request cancellation; the task record remains available for audit.

### Automatic task polling and progress

A research run takes minutes, and the model cannot be relied on to poll it. `ChatManager` detects a queued task descriptor in any successful tool result — the `{ taskId, status, taskUrl, progressUrl }` envelope from `deep-gene-research`, or the `{ workflow: { taskId, status, progress, step } }` envelope from `start_annotation_research` / `get_annotation_research_workflow` — and starts its own five-second poll. Workflow-kind tasks are polled through `AnnotationResearchWorkflowService` so its durable finalization still runs; direct tasks poll `get-task-status`. Polling is idempotent per `taskId`, tolerates several consecutive transport failures before giving up, and the conversation prompt tells the model **not** to poll or resubmit the run itself.

Each tracked run is surfaced twice:

- A **status bubble** in the transcript, rewritten in place on every poll and carrying the full task detail and, on completion, the report links and outcome.
- A **progress dock** pinned between the transcript and the composer. The bubble stays where the run was submitted and scrolls out of view as soon as the conversation moves on, so the dock is what makes a long run legible: gene, status, progress bar, current step, and a ticking elapsed clock that keeps reading as alive even while the percentage sits still. It also carries per-run cancel and jump-to-bubble actions. Completed runs clear themselves after a short linger; failures stay until dismissed.

### Automatic ChangeSet materialization

Both entry points end at a reviewable ChangeSet without a further curator command:

- **Workflow runs.** On the completing poll, `AnnotationResearchWorkflowService` archives the report, binds the proposal, and calls `createAnnotationChangeset` itself when the caller holds `annotation:propose`. A research-only caller records completion with the proposal preserved, and a later propose-capable caller materializes that exact snapshot.
- **Direct runs.** `ChatManager.autoCreateResearchChangeSet` merges the returned proposal through `merge_gene_research_report`, binding it to the run with `researchRun: taskId`.

The ChangeSet is created `awaiting_approval` and is never applied — approval and commit are unchanged. Materialization is deliberately fail-closed and reports the reason in the chat instead of forcing a proposal through:

| Situation                                                      | Outcome                                                              |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `draft_requires_evidence`                                      | Not created; the run found no evidence-backed claims safe to propose |
| `draft_requires_target`                                        | Not created; the proposal is not bound to an exact genome feature    |
| No genome annotations loaded                                   | Not created; load the genome and merge the report explicitly         |
| Incomplete provenance chain (unarchived report, hash mismatch) | Not created; the underlying validation error is shown verbatim       |
| Proposal already satisfied by the current annotation           | Not needed; nothing is written                                       |

Deduplication for direct runs goes through the ledger, not an idempotency key. The merge stamps each proposal with the current time, so a re-processed task hashes differently and a fixed key would be rejected as a _conflicting reuse_ rather than returning the ChangeSet that already exists. `ChatManager` therefore looks the run up by `researchRun` before creating anything, and reports the existing ChangeSet when one is found.

## Restart and recovery behavior

- DGR persists task parameters, status, progress, attempt count, result, errors, and idempotency association to `MCP_TASK_STORAGE_FILE` with atomic replacement.
- On restart, DGR returns interrupted `pending` and `in_progress` tasks to the durable queue. The retry budget is four total execution attempts, including attempts before a restart.
- A `cancel_requested` task becomes `cancelled` during recovery rather than restarting.
- If the DGR ledger is corrupt, it is quarantined and the queue remains locked until an operator reconciles or restores a verified ledger. Do not delete the quarantine and start from an empty ledger without checking duplicate-work and idempotency consequences.
- CodeXomics associates the DGR `taskId` with one genome target in `annotationResearchRuns`. Polling a task from another genome is rejected.
- The default research idempotency key hashes the full workspace/feature target and normalized intent. Explicit keys are checked against that same complete binding before a duplicate can be returned.
- The first completed annotation proposal is stored as a bounded snapshot with its integrity hash. A later `annotation:propose` caller materializes that exact snapshot even if a subsequent DGR status response omits it.
- The full DGR task result is not copied into the renderer or sidecar. CodeXomics stores it in `gene_attachments/dgr/` under the application-data directory and records a hash-bound attachment in the associated gene's **Resources** tab. Reopening the attachment uses the dedicated JSON viewer; a missing registration is recovered idempotently on a later completed-task poll while DGR still retains the task.
- A legacy v2 annotation ledger without an integrity-version marker is upgraded only after its original raw-JSON SHA-256 ChangeSet, approval, receipt, index, and live feature chain can be proven. Legacy plaintext approval capabilities are revoked before the migrated ledger is saved, and the save completes before any overlay is replayed. Weak legacy FNV records or ambiguous feature states require manual reconciliation.
- CodeXomics restores committed annotation overlays from the genome sidecar only after validating the ledger, ChangeSet and receipt hashes, target chain, and source feature state.

For each run, retain the DGR task ledger and the matching sidecar selected by CodeXomics together. Back them up before moving or replacing the source genome.

## Current production boundaries

- Sidecar writes use an atomic replace and optimistic storage revision. This prevents stale writes between windows in one CodeXomics process, but it is not a distributed filesystem lock. Do not edit the same sidecar from multiple CodeXomics processes or machines.
- ChangeSet and receipt hashes detect application-level corruption and accidental mutation, but they are stored beside the payload and are not signatures against a malicious local file writer. Protect sidecars with operating-system permissions and verified backups; hostile-storage deployments need an HMAC/signature key held outside the sidecar or an external append-only audit service.
- Sidecar JSON is capped at 64 MiB before parsing or writing. Annotation ledgers are also capped at 10,000 ChangeSets, 20,000 approval records, 100,000 audit events, and 200 simultaneously pending ChangeSets per principal. Per-genome research workflow history is capped at 2,000 records and 8 MiB, with at most 100 active runs per principal. Before a remote DGR task starts, CodeXomics projects a worst-case task ID into the exact durable workflow record and rejects requests that cannot be associated safely. These are safety ceilings, not an automated archival system; export and reconcile long-running curation history before reaching them.
- DGR uses one shared bearer secret and has no per-user task ownership. Put it behind a trusted network boundary; multi-tenant deployments need an identity-aware gateway and task-level authorization.
- CodeXomics scoped keys are static environment configuration. Enterprise deployments still need external secret rotation, identity federation, revocation workflows, and centralized audit export.
- The file-backed DGR queue is intentionally single-process. Database storage, cross-process leases, and distributed workers remain prerequisites for horizontal scaling.
- MCP timeouts bound the client request and all transports use the same policy. Because an atomic commit cannot be revoked safely once its durable write begins, a client that times out at that boundary must query the ChangeSet and retry with the same idempotency key rather than assuming failure.
- Legacy SSE is a compatibility transport with authenticated session expiry, 25-second keepalives, bounded backpressure teardown, and limits of 64 streams globally and 8 per credential principal. Prefer streamable HTTP for new agent integrations.
- Evidence linkage and automated validation reduce unsafe proposals, but they do not establish biological truth. A qualified curator remains responsible for the final annotation decision.
