import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const DynamicToolsSnapshotAdapter = require('../../src/renderer/modules/DynamicToolsSnapshotAdapter.js');
const {
  applyStrongModelReplay,
  canonicalOracleHash,
  canonicalizeToolCall,
  canonicalizeToolSchema,
  checkLeakage,
  deterministicCandidateTarget,
  inferSourceStatefulness,
  inferToolCallStatefulness,
  loadAutomaticBenchmarks,
  materializeCandidates,
  mutateCall,
  normalizeText,
  resolveResultReferences,
  splitAssignmentForSources,
  splitForFamily,
  toCanonicalNativeFunctionTool,
  validateAndResolveCalls,
} = require('../../scripts/tool-calling-dataset.js');
const {
  assertTrainingEligible,
  compactNativeTool,
  expandRecord,
  getTrainingEligibility,
  preserveNativeTool,
  selectToolNames,
} = require('../../scripts/prepare-mlx-tool-data.js');

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tools_registry/generated/tool-registry-manifest.json'), 'utf8')
);
const adapter = new DynamicToolsSnapshotAdapter(manifest, { agentSystemEnabled: false });

describe('tool-calling dataset release pipeline', () => {
  it('uses exactly the 172 automatic tests as leakage fingerprints', () => {
    const benchmarks = loadAutomaticBenchmarks();
    expect(benchmarks).toHaveLength(172);
  });

  it('rejects an exact benchmark prompt without exposing it to training output', () => {
    const benchmarks = loadAutomaticBenchmarks();
    const benchmark = benchmarks[0];
    const result = checkLeakage({ user_query: benchmark.normalizedPrompt, calls: [] }, benchmarks);
    expect(normalizeText(benchmark.normalizedPrompt)).not.toBe('');
    expect(result).toEqual({ passed: false, reason: 'exact_prompt_hash' });
  });

  it('assigns a scenario family deterministically to one split', () => {
    expect(splitForFamily('registry:compute_gc:0')).toBe(splitForFamily('registry:compute_gc:0'));
  });

  it('canonicalizes documented parameter and tool aliases against the current registry', () => {
    const result = canonicalizeToolCall(
      {
        tool_name: 'insert_sequence',
        parameters: {
          chromosome: 'U00096',
          start: 12,
          newSequence: 'ATGC',
          reverseComplement: true,
        },
      },
      manifest,
      adapter
    );
    expect(result).toMatchObject({
      valid: true,
      call: {
        tool_name: 'insert_sequence',
        parameters: {
          chromosome: 'U00096',
          position: 12,
          sequence: 'ATGC',
          reverse_complement: true,
        },
      },
    });
    expect(
      canonicalizeToolCall({ tool_name: 'remove_tab', parameters: { tab_name: 'Results' } }, manifest, adapter).call
        .tool_name
    ).toBe('close_tab');
  });

  it('retains descriptions, defaults, examples, and source constraints in canonical schemas', () => {
    const toggle = adapter.toolsByName.get('toggle_track');
    const nativeTool = toCanonicalNativeFunctionTool(toggle);
    expect(nativeTool.function.description).toContain('Show or hide');
    expect(nativeTool.function.parameters.properties.track_name.description).toContain('Canonical track identifier');
    expect(nativeTool.function.parameters.properties.track_name.examples).toContain('genes');
    expect(nativeTool.function.parameters.properties.clientId.default).toBe('default');
    expect(nativeTool.function.parameters.properties.trackName).toBeUndefined();
    expect(canonicalizeToolSchema(toggle).additionalProperties).toBe(false);
  });

  it('resolves dependent-call fixture references and records argument provenance', () => {
    const fixtureOutputs = [
      { tool_name: 'get_sequence', result: { sequence: 'ATGCCG' }, provenance: { fixture: 'u00096-v1' } },
    ];
    const result = resolveResultReferences(
      { sequence: { $from: 'call_1.result.sequence' }, reading_frame: 1 },
      fixtureOutputs
    );
    expect(result).toMatchObject({
      resolved: true,
      value: { sequence: 'ATGCCG', reading_frame: 1 },
      provenance: [{ parameter_path: '$.sequence', source: 'call_1.result.sequence' }],
    });
  });

  it('materializes five pinned dependent workflows from prior fixture results', () => {
    const workflowSources = fs
      .readFileSync(path.join(repoRoot, 'datasets/tool-calling-v1/sources/workflow-seeds.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    const expectedFamilies = [
      'workflow:gene_region',
      'workflow:reverse_complement',
      'workflow:translation_check',
      'workflow:annotation_inspection',
      'workflow:protein_lookup',
    ];
    for (const familyId of expectedFamilies) {
      const source = workflowSources.find(
        candidate => candidate.family_id === familyId && candidate.fixture_replay?.status === 'passed'
      );
      expect(source, familyId).toBeDefined();
      const result = validateAndResolveCalls(source, manifest, adapter);
      expect(result.valid, `${familyId}: ${result.errors?.join('; ')}`).toBe(true);
      expect(result.fixtureReplayPassed).toBe(true);
      expect(result.argumentProvenance.length).toBeGreaterThan(0);
      expect(JSON.stringify(result.calls)).not.toContain('$from');
      expect(result.fixtureOutputs.every(output => output.provenance.source === 'deterministic_fixture_runner')).toBe(
        true
      );
    }
    const tampered = JSON.parse(
      JSON.stringify(
        workflowSources.find(
          candidate =>
            candidate.family_id === 'workflow:reverse_complement' && candidate.fixture_replay?.status === 'passed'
        )
      )
    );
    tampered.fixture_outputs[1].result.reverse_complement = 'AAAAAAAAAAAA';
    expect(validateAndResolveCalls(tampered, manifest, adapter)).toMatchObject({
      valid: false,
      reason: 'fixture_execution_failed',
    });
  });

  it('keeps atomic sources and every composition containing them in one split component', () => {
    const atomicA = { family_id: 'a', atomic_source_ids: ['a'] };
    const atomicB = { family_id: 'b', atomic_source_ids: ['b'] };
    const composition = { family_id: 'a+b', atomic_source_ids: ['a', 'b'] };
    const atomicC = { family_id: 'c', atomic_source_ids: ['c'] };
    const assign = splitAssignmentForSources([atomicA, atomicB, composition, atomicC]);
    expect(assign(atomicA)).toEqual(assign(atomicB));
    expect(assign(composition)).toEqual(assign(atomicA));
    expect(assign(atomicC).componentId).not.toBe(assign(atomicA).componentId);
  });

  it('quarantines registry mutations and only marks conservative read-only calls stateless', () => {
    expect(inferToolCallStatefulness({ tool_name: 'close_tab', parameters: {} }, adapter)).toMatchObject({
      stateful: true,
    });
    expect(inferToolCallStatefulness({ tool_name: 'export_fasta_sequence', parameters: {} }, adapter)).toMatchObject({
      stateful: true,
    });
    expect(inferToolCallStatefulness({ tool_name: 'get_sequence', parameters: {} }, adapter)).toMatchObject({
      stateful: false,
    });
    expect(
      inferToolCallStatefulness(
        { tool_name: 'find_gene_by_name', parameters: { name: 'synA17', navigate_to_gene: false } },
        adapter
      )
    ).toMatchObject({ stateful: false });
    expect(
      inferToolCallStatefulness({ tool_name: 'find_gene_by_name', parameters: { name: 'synA17' } }, adapter)
    ).toMatchObject({ stateful: true });
    expect(
      inferSourceStatefulness(
        {
          calls: [
            { tool_name: 'get_sequence', parameters: {} },
            { tool_name: 'toggle_track', parameters: { track_name: 'genes', visible: false } },
          ],
        },
        adapter
      )
    ).toMatchObject({ stateful: true });
  });

  it('uses 20-24 deterministic hard candidates and randomizes the gold position', () => {
    const positions = new Set();
    for (let index = 0; index < 12; index += 1) {
      const source = {
        family_id: `candidate-family-${index}`,
        user_query: 'Hide the genes track and keep related navigation controls available.',
      };
      const calls = [{ tool_name: 'toggle_track', parameters: { track_name: 'genes', visible: false } }];
      const result = materializeCandidates(source, calls, adapter);
      expect(result.candidateToolNames).toHaveLength(
        deterministicCandidateTarget(`${source.family_id}\n${source.user_query}`)
      );
      expect(result.candidateToolNames.length).toBeLessThanOrEqual(24);
      positions.add(result.candidateToolNames.indexOf('toggle_track'));
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it('builds only schema-valid semantic preference negatives', () => {
    const example = {
      schema_version: '2.0',
      example_id: 'cx-preference-test',
      scenario_family_id: 'preference-test',
      split: 'train',
      messages: [
        { role: 'system', content: 'Use tools.' },
        { role: 'user', content: 'Hide genes.' },
      ],
      tool_catalog: {
        candidate_tool_names: ['toggle_track', 'get_current_state', 'navigate_to_position'],
      },
      oracle: {
        decision: 'call',
        acceptable_calls: [{ tool_name: 'toggle_track', parameters: { track_name: 'genes', visible: false } }],
      },
    };
    const preference = mutateCall(example, adapter);
    expect(preference.verification).toMatchObject({
      chosen_schema_valid: true,
      rejected_schema_valid: true,
      semantic_mismatch: true,
      training_eligible: false,
    });
    expect(preference.rejected_error_type).toMatch(/semantic_argument_mismatch|wrong_tool/);
  });

  it('applies sidecar replay by semantic verdict without replacing the canonical oracle', () => {
    const example = {
      example_id: 'cx-replay-sidecar',
      oracle: {
        acceptable_calls: [{ tool_name: 'get_current_state', parameters: {} }],
        terminal_predicates: [{ type: 'call_contract_matched', tool_name: 'get_current_state' }],
      },
      strong_model_replay: {
        canonical_calls: [{ tool_name: 'get_current_state', parameters: {} }],
        fixture_outputs: [],
      },
    };
    const replay = {
      example_id: example.example_id,
      registry_hash: manifest.registryHash,
      canonical_oracle_hash: canonicalOracleHash(example),
      canonical_calls: example.oracle.acceptable_calls,
      terminal_predicates: example.oracle.terminal_predicates,
      status: 'passed',
      reason_code: 'passed',
      semantic_verdict: 'passed',
      model_family: 'strong-model-control',
      model_id: 'strong-model-version',
      observed_calls: [
        {
          tool_name: 'get_current_state',
          parameters: { clientId: 'default', include_tracks: true, include_data_summary: true },
        },
      ],
      fixture_outputs: [],
      terminal_predicate_results: [{ predicate_index: 0, passed: true }],
      provenance: {
        runner: 'test-runner',
        runner_version: '1',
        generated_at: '2026-08-01T00:00:00.000Z',
        request_hash: 'request-hash',
        response_hash: 'response-hash',
      },
    };
    const result = applyStrongModelReplay(example, replay, manifest, adapter);
    expect(result.errors).toBeUndefined();
    expect(result.example.oracle.acceptable_calls).toEqual([{ tool_name: 'get_current_state', parameters: {} }]);
    expect(result.example.strong_model_replay.observed_calls[0].parameters).not.toEqual({});
    expect(result.example.strong_model_replay.semantic_verdict).toBe('passed');
  });

  it('keeps a gold-first 6-tool training catalog with compact schemas in MLX conversion', () => {
    const sourceTool = {
      type: 'function',
      function: {
        name: 'demo',
        description: 'A full description that must not be truncated.',
        parameters: {
          type: 'object',
          properties: { mode: { type: 'string', description: 'Mode details', default: 'safe', examples: ['safe'] } },
        },
      },
    };
    expect(preserveNativeTool(sourceTool)).toEqual(sourceTool);
    const compact = compactNativeTool(sourceTool);
    expect(compact.function.parameters.properties.mode.type).toBe('string');
    expect(compact.function.parameters.properties.mode.default).toBe('safe');
    expect(compact.function.parameters.properties.mode.description).toBeUndefined();
    expect(compact.function.parameters.properties.mode.examples).toBeUndefined();
    const candidateNames = Array.from({ length: 24 }, (_unused, index) => `tool_${index}`);
    const record = {
      example_id: 'cx-eligible',
      scenario_family_id: 'eligible',
      labels: { stateful: false },
      verification: { schema_valid: true, fixture_executable: true },
      strong_model_replay: {
        status: 'passed',
        semantic_verdict: 'passed',
        comparison_mode: 'semantic_canonical_equivalence',
      },
      tool_catalog: { candidate_tool_names: candidateNames },
      oracle: { decision: 'call', acceptable_calls: [{ tool_name: 'tool_11', parameters: {} }] },
      messages: [
        { role: 'user', content: 'Run it.' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'tool_11', arguments: '{}' } }],
        },
      ],
    };
    expect(selectToolNames(record)).toEqual(['tool_11', 'tool_0', 'tool_1', 'tool_2', 'tool_3', 'tool_4']);
    const toolMap = new Map(
      candidateNames.map(name => [name, { ...sourceTool, function: { ...sourceTool.function, name } }])
    );
    const converted = expandRecord(record, toolMap);
    expect(converted[0].tools).toHaveLength(6);
    expect(converted[0].tools[0].function.name).toBe('tool_11');
    expect(converted[0].tools[1].function.name).toBe('tool_0');
    expect(converted[0].tools[0].function.parameters.properties.mode.default).toBe('safe');
    expect(converted[0].tools[0].function.parameters.properties.mode.description).toBeUndefined();
  });

  it('blocks MLX training until semantic strong-model replay and state evidence pass', () => {
    expect(() =>
      assertTrainingEligible({
        example_id: 'cx-not-replayed',
        labels: { stateful: false },
        verification: { schema_valid: true },
        strong_model_replay: { status: 'not_run', comparison_mode: 'semantic_canonical_equivalence' },
      })
    ).toThrow(/strong_model_replay_not_passed/);
    expect(() =>
      assertTrainingEligible({
        example_id: 'cx-stateful',
        labels: { stateful: true },
        verification: { schema_valid: true, state_verified: false },
        strong_model_replay: {
          status: 'passed',
          semantic_verdict: 'passed',
          comparison_mode: 'semantic_canonical_equivalence',
        },
      })
    ).toThrow(/stateful_record_not_state_verified/);
    expect(
      getTrainingEligibility({
        example_id: 'cx-independent',
        labels: { stateful: false },
        oracle: { decision: 'no_call', argument_provenance: [] },
        verification: { schema_valid: true },
        strong_model_replay: {
          status: 'passed',
          semantic_verdict: 'passed',
          comparison_mode: 'semantic_canonical_equivalence',
        },
      })
    ).toEqual({ eligible: true, reason: 'eligible', reasons: [] });
  });
});
