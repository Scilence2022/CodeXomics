# CodeXomics Tool-Calling Dataset v2

This directory contains the production data contract and a reproducible seed release for tuning small models to call CodeXomics tools.

## Scope and leakage boundary

- Evaluation scope: 143 automatic-simple tests and 29 automatic-complex tests.
- Manual and manual-complex tests are not loaded, fingerprinted, scored, or exported by this pipeline.
- The 172 automatic benchmark prompts and expected calls are evaluation-only. The builder loads them only in memory to reject exact prompts, near-duplicate prompts with the same tool target, and copied multi-step tool graphs. Neither benchmark answers nor a strong model's literal replay JSON may be copied back into training labels.
- Benchmark text and expected results are never written to a dataset release.
- All paraphrases, translations, preference pairs, and multi-turn variants must share one `scenario_family_id`; the family is assigned to a split before examples are emitted.

The committed `holdout.jsonl` is a public engineering holdout, not a secret final test. Keep the final acceptance set outside the repository and pass it through the same validator before use.

## Release contents

- `schema/example.schema.json`: versioned SFT/multi-turn record contract.
- `schema/preference.schema.json`: chosen/rejected preference-pair contract.
- `schema/strong-model-replay.schema.json`: immutable semantic-replay sidecar contract.
- `sources/decision-seeds.jsonl`: independent no-call, clarification, and unavailable-tool seeds.
- `sources/workflow-seeds.jsonl`: independently authored multi-step seeds.
- `release/train.jsonl`, `dev.jsonl`, `holdout.jsonl`: accepted examples only.
- `release/candidate-preferences.jsonl`: deterministic, Schema-valid semantic hard negatives awaiting source replay promotion; never train from this file.
- `release/preferences.jsonl`: the promoted subset whose source rows passed every training-eligibility gate, for DPO/RPO.
- `release/tool-catalog.json`: the exact strict native function schemas used by the release.
- `release/rejections.json`: hashes and reason codes only; rejected benchmark-like text is not persisted.
- `release/manifest.json`: registry hash, benchmark fingerprint hash, counts, file hashes, and release gates.

## Build and validate

```bash
npm run dataset:build
npm run dataset:validate
```

Additional expert-reviewed or model-generated candidates can be supplied without changing the builder:

```bash
node scripts/tool-calling-dataset.js build --input /absolute/path/candidates.jsonl
```

Strong-model results are supplied as an immutable JSONL sidecar and applied by rebuilding the release:

```bash
node scripts/tool-calling-dataset.js build \
  --replay-results /absolute/path/strong-model-replay.jsonl \
  --output /absolute/path/release-v2
```

Each sidecar line has this contract:

```json
{
  "example_id": "cx-...",
  "registry_hash": "...",
  "canonical_oracle_hash": "...",
  "canonical_calls": [{ "tool_name": "get_current_state", "parameters": {} }],
  "terminal_predicates": [{ "type": "call_contract_matched", "tool_name": "get_current_state" }],
  "status": "passed",
  "reason_code": "passed",
  "semantic_verdict": "passed",
  "model_family": "strong-model-control",
  "model_id": "pinned-model-version",
  "observed_calls": [{ "tool_name": "get_current_state", "parameters": { "include_tracks": true } }],
  "fixture_outputs": [],
  "terminal_predicate_results": [{ "predicate_index": 0, "passed": true }],
  "provenance": {
    "runner": "codexomics-dataset-replay",
    "runner_version": "1.0.0",
    "generated_at": "2026-08-01T00:00:00.000Z",
    "request_hash": "...",
    "response_hash": "..."
  }
}
```

The builder rejects unknown example IDs and stale registry/oracle hashes. It records both raw and canonicalized observations, but never replaces `oracle.acceptable_calls` with provider output. Failed and blocked replays remain diagnosable through the reason taxonomy; only semantic `passed` rows can enter MLX conversion.

Each input line must contain a unique `family_id`, `user_query`, and either:

- `calls: [{"tool_name":"...","parameters":{...}}]`, or
- a non-call `decision` (`no_call`, `ask_clarification`, `refuse`, or `unavailable_tool`) plus `assistant_text`.

Accepted calls use canonical tool and parameter names from the current registry. Schema validation is only a call-shape gate; it is never called execution. Each record reports one explicit validation tier:

- `schema_valid`: the canonical call satisfies the current JSON Schema.
- `fixture_executable`: a pinned fixture runner executed the call and recorded its output and provenance.
- `state_verified`: fixture execution also satisfied the declared terminal state predicates.

Schema-only rows use `call_contract_matched` predicates. They never claim `tool_completed`; completion and final-state predicates may only be asserted by fixture/state runners with recorded evidence. A strong-model replay proves model behavior, not CodeXomics tool execution.

Dependent workflows may use `parameters_template` values such as `{"$from":"call_1.result.sequence"}`. The builder resolves those references from pinned fixture outputs, stores concrete canonical calls in the oracle, and records `argument_provenance`. A referenced workflow is rejected unless its fixture replay passed.

For the committed synthetic-genome and pinned-UniProt workflows, `codexomics-pinned-readonly-fixture-v1` executes every supported operation deterministically, feeds the actual prior result into the next template, compares recomputed outputs with the declared expectations, validates result Schemas, and evaluates terminal predicates. Merely setting `fixture_replay.status="passed"` is insufficient: unknown runners, fixtures, tools, altered outputs, forward references, and failed predicates are rejected.

Every training-promoted record must also have a passed strong-model replay. That replay keeps the observed response separate from the canonical oracle and is judged by `semantic_canonical_equivalence`; provider-specific literal JSON is not treated as the only correct serialization. Replay status and reason codes make provider failures, semantic mismatches, fixture failures, and terminal-state failures distinguishable.

The MLX converter filters records independently and reports exclusion counts by reason. Every call-producing row requires both passed fixture execution and passed strong-model semantic replay; a stateful row additionally requires `state_verified=true`. Schema-only Registry and stateful coverage seeds remain in the candidate release for future replay but cannot enter SFT or promoted preferences, and they do not block unrelated eligible rows. No-call and clarification rows do not require a tool fixture.

Registry-derived statefulness is conservative. Mutating verbs and mutation/file/task/plugin categories enter state-verification quarantine; compositions inherit statefulness when any atomic part is stateful. Recognized read-only calls may remain stateless, and parameter-sensitive tools such as `find_gene_by_name` are stateful unless navigation is explicitly disabled. Unknown side-effect behavior is quarantined rather than presumed read-only.

Candidate catalogs contain at most 24 tools, retain production Schema descriptions/defaults/examples, use deterministic hard distractors, and deterministically randomize the gold tool position. Atomic sources and every composition that contains them are assigned through connected split components, so an atomic source cannot enter one split while its composition enters another.

## Data promotion policy

Do not train directly from `sources/` or `rejections.json`. Train only from accepted release files. Before a larger release:

1. Add provenance and licensing for every external source.
2. Keep complete scenario families in one split.
3. Run Schema validation, pinned fixture replay, terminal-state verification where applicable, and strong-model semantic replay.
4. Human-review sequence mutation, destructive actions, strand/coordinate-sensitive calls, and every safety example.
5. Keep the current 172 automatic tests and all direct paraphrases out of every training and preference file.
6. Generate a genuinely private final test after training data is frozen. Never use the 143+29 benchmark answers as repair labels or replay feedback.

The committed release is a verified seed corpus, not the recommended final training volume. Scale it with independently generated, execution-verified candidates; do not create volume by paraphrasing the public benchmark.
