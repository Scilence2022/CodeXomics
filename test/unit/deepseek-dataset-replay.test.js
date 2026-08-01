import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const replay = require('../../scripts/deepseek-dataset-replay.js');

const registryHash = 'a'.repeat(64);

function catalog() {
  const tool = (name, properties, required) => ({
    type: 'function',
    function: {
      name,
      description: `${name} test tool`,
      parameters: { type: 'object', properties, required, additionalProperties: false },
    },
  });
  return {
    schema_version: '2.0',
    registry_hash: registryHash,
    tools: [
      tool('get_sequence', { region: { type: 'string' } }, ['region']),
      tool('compute_gc', { sequence: { type: 'string' } }, ['sequence']),
    ],
  };
}

function options(overrides = {}) {
  return {
    model: 'deepseek-v4-flash',
    thinking: 'disabled',
    attempts: 1,
    split: 'dev',
    limit: Infinity,
    concurrency: 1,
    output: null,
    requestTimeoutMs: 1000,
    retries: 0,
    baseUrl: 'https://api.deepseek.com',
    ...overrides,
  };
}

function baseRecord(overrides = {}) {
  return {
    schema_version: '2.0',
    example_id: 'cx-replay-test-000001',
    split: 'dev',
    provenance: { source_type: 'expert_curated_seed', source_ref: 'test-fixture' },
    environment: { fixture_id: 'pinned-sequence-v1' },
    tool_catalog: {
      registry_hash: registryHash,
      candidate_tool_names: ['compute_gc', 'get_sequence'],
    },
    messages: [
      { role: 'system', content: 'Use supplied tools.' },
      { role: 'user', content: 'Get region A and compute its GC content.' },
    ],
    oracle: {
      decision: 'call',
      acceptable_calls: [
        { tool_name: 'get_sequence', parameters: { region: 'A' } },
        { tool_name: 'compute_gc', parameters: { sequence: 'ATGC' } },
      ],
      argument_provenance: [{ call_index: 1, source: 'call_1.result.sequence' }],
      terminal_predicates: [
        { type: 'result_field_equals', call_index: 1, path: 'result.sequence', value: 'ATGC' },
        {
          type: 'argument_from_result',
          call_index: 2,
          parameter: 'sequence',
          source: 'call_1.result.sequence',
        },
      ],
    },
    labels: { category: 'test', difficulty: 'multi_step', stateful: true },
    verification: {
      leakage_passed: true,
      fixture_executable: true,
      fixture_replay: {
        status: 'passed',
        fixture_outputs: [
          { call_index: 0, tool_name: 'get_sequence', result: { sequence: 'ATGC' } },
          { call_index: 1, tool_name: 'compute_gc', result: { gc: 0.5 } },
        ],
      },
    },
    ...overrides,
  };
}

function toolResponse(name, parameters, id) {
  return {
    model: 'deepseek-v4-flash-20260731',
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(parameters) } }],
        },
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 3 },
  };
}

describe('DeepSeek dataset semantic replay', () => {
  it('accepts only environment-based credentials and validates replay CLI flags', () => {
    const parsed = replay.parseArgs([
      '--split',
      'holdout',
      '--limit',
      '5',
      '--concurrency',
      '3',
      '--thinking',
      'enabled',
      '--attempts',
      '2',
    ]);
    expect(parsed).toMatchObject({
      split: 'holdout',
      limit: 5,
      concurrency: 3,
      thinking: 'enabled',
      attempts: 2,
      promotionCandidatesOnly: true,
    });
    expect(parsed).not.toHaveProperty('apiKey');
    expect(() => replay.parseArgs(['--api-key', 'secret'])).toThrow('Unknown argument');
  });

  it('defaults to replaying only rows that can be promoted to training', () => {
    expect(replay.isPromotionCandidate(baseRecord())).toBe(true);
    expect(
      replay.isPromotionCandidate(
        baseRecord({
          verification: { leakage_passed: true, fixture_executable: false },
        })
      )
    ).toBe(false);
    expect(
      replay.isPromotionCandidate(
        baseRecord({ oracle: { decision: 'no_call', acceptable_calls: [], terminal_predicates: [] } })
      )
    ).toBe(true);
    expect(replay.parseArgs(['--all-candidates']).promotionCandidatesOnly).toBe(false);
  });

  it('replays pinned dependent fixture outputs without sending oracle assistant messages', async () => {
    const runtime = replay.createCatalogRuntime(catalog());
    const record = baseRecord();
    const requestChat = vi
      .fn()
      .mockResolvedValueOnce(toolResponse('get_sequence', { region: 'A' }, 'observed_1'))
      .mockImplementationOnce(async (_options, messages) => {
        expect(messages.filter(message => message.role === 'assistant')).toHaveLength(1);
        expect(messages.at(-1)).toEqual({
          role: 'tool',
          tool_call_id: 'observed_1',
          name: 'get_sequence',
          content: '{"sequence":"ATGC"}',
        });
        return toolResponse('compute_gc', { sequence: 'ATGC' }, 'observed_2');
      });

    const result = await replay.replayExample(record, 1, options(), runtime, requestChat);

    expect(result.taxonomy).toBe('pass');
    expect(result.evaluation.details.assessmentMode).toBe('contract');
    expect(result.evaluation.details.executionExact).toBe(false);
    expect(result.calls).toEqual(record.oracle.acceptable_calls);
    expect(result.fixture_outputs).toEqual(
      record.verification.fixture_replay.fixture_outputs.map(output => ({ ...output, provenance: null }))
    );
    expect(result.terminal_predicate_results.every(item => item.passed)).toBe(true);
    expect(requestChat).toHaveBeenCalledTimes(2);
  });

  it('uses an explicit non-execution acknowledgement for independent sequential calls', async () => {
    const runtime = replay.createCatalogRuntime(catalog());
    const record = baseRecord({
      oracle: { ...baseRecord().oracle, argument_provenance: [] },
      verification: { leakage_passed: true, fixture_replay: { status: 'not_run', fixture_outputs: [] } },
    });
    const requestChat = vi
      .fn()
      .mockResolvedValueOnce(toolResponse('get_sequence', { region: 'A' }, 'observed_1'))
      .mockImplementationOnce(async (_options, messages) => {
        expect(JSON.parse(messages.at(-1).content)).toEqual({
          acknowledged: true,
          assessment_tier: 'native-function-contract',
          domain_result_available: false,
        });
        return toolResponse('compute_gc', { sequence: 'ATGC' }, 'observed_2');
      });

    const result = await replay.replayExample(record, 1, options(), runtime, requestChat);
    expect(result.taxonomy).toBe('pass');
    expect(result.fixture_outputs).toEqual([]);
  });

  it('applies decision-specific semantic checks instead of accepting arbitrary no-call text', async () => {
    const runtime = replay.createCatalogRuntime(catalog());
    const decisionRecord = decision =>
      baseRecord({
        example_id: `cx-decision-${decision}-001`,
        messages: [
          { role: 'system', content: 'Use supplied tools.' },
          { role: 'user', content: decision === 'ask_clarification' ? 'Go to the gene.' : 'Explain GC without tools.' },
        ],
        oracle: { decision, acceptable_calls: [], argument_provenance: [], terminal_predicates: [] },
        labels: { category: 'decision', difficulty: 'decision', stateful: false },
        verification: { leakage_passed: true },
      });
    const response = content => async () => ({
      model: 'deepseek-v4-flash-20260731',
      choices: [{ message: { role: 'assistant', content } }],
    });

    const clarification = await replay.replayExample(
      decisionRecord('ask_clarification'),
      1,
      options(),
      runtime,
      response('Which gene name or locus identifier should I use?')
    );
    const emptyMeaning = await replay.replayExample(decisionRecord('no_call'), 1, options(), runtime, response('OK'));

    expect(clarification.taxonomy).toBe('pass');
    expect(clarification.decision_assessment.reason).toBe('clarification_detected');
    expect(emptyMeaning.taxonomy).toBe('no_call');
    expect(emptyMeaning.decision_assessment.reason).toBe('non_substantive_response');
  });

  it('applies the same decision semantics to Chinese responses', () => {
    expect(replay.assessDecisionResponse('ask_clarification', '请提供基因名称或位点标识符。')).toEqual({
      passed: true,
      reason: 'clarification_detected',
    });
    expect(replay.assessDecisionResponse('unavailable_tool', '当前没有支持该操作的工具，无法执行。')).toEqual({
      passed: true,
      reason: 'unavailability_disclosed',
    });
    expect(replay.assessDecisionResponse('no_call', '我已经成功完成了基因组分析，结果一切正常。')).toEqual({
      passed: false,
      reason: 'false_execution_claim',
    });
    expect(replay.assessDecisionResponse('no_call', 'GC 含量表示序列中鸟嘌呤与胞嘧啶所占的比例。')).toEqual({
      passed: true,
      reason: 'substantive_non_tool_response',
    });
    expect(replay.assessDecisionResponse('refuse', '抱歉，我不能协助执行破坏性操作。')).toEqual({
      passed: true,
      reason: 'refusal_disclosed',
    });
    expect(replay.assessDecisionResponse('refuse', 'That sounds good to me.')).toEqual({
      passed: false,
      reason: 'refusal_not_disclosed',
    });
  });

  it('emits an immutable one-row sidecar contract without replacing the oracle', async () => {
    const runtime = replay.createCatalogRuntime(catalog());
    const record = baseRecord();
    const requestChat = vi
      .fn()
      .mockResolvedValueOnce(toolResponse('get_sequence', { region: 'A' }, 'observed_1'))
      .mockResolvedValueOnce(toolResponse('compute_gc', { sequence: 'ATGC' }, 'observed_2'));
    const result = await replay.replayExample(record, 1, options(), runtime, requestChat);
    const row = replay.buildSidecarRow(record, [result], options(), runtime);

    expect(Object.keys(row).sort()).toEqual(
      [
        'example_id',
        'registry_hash',
        'canonical_oracle_hash',
        'canonical_calls',
        'terminal_predicates',
        'status',
        'reason_code',
        'semantic_verdict',
        'model_family',
        'model_id',
        'observed_calls',
        'fixture_outputs',
        'terminal_predicate_results',
        'provenance',
      ].sort()
    );
    expect(row.canonical_calls).toEqual(record.oracle.acceptable_calls);
    expect(row.canonical_calls).not.toBe(record.oracle.acceptable_calls);
    expect(row.observed_calls).toEqual(result.calls);
    expect(row.status).toBe('passed');
    expect(row.provenance).toMatchObject({
      runner: 'codexomics-dataset-replay',
      runner_version: '1.0.0',
      comparison_mode: 'semantic_canonical_equivalence',
      execution_assessed: false,
    });
  });

  it('reports explicit strong-model thresholds separately for single and multi-step attempts', () => {
    const result = (difficulty, success) => ({
      example_id: `${difficulty}-${success}`,
      difficulty,
      taxonomy: success ? 'pass' : 'args',
      success,
      duration_ms: 1,
      usage: {},
    });
    const gate = replay.buildStrongModelGate([
      ...Array.from({ length: 20 }, () => result('single_call', true)),
      ...Array.from({ length: 9 }, () => result('multi_step', true)),
      result('multi_step', false),
    ]);

    expect(gate.groups.single_call.minimum_accuracy).toBe(0.95);
    expect(gate.groups.single_call.passed).toBe(true);
    expect(gate.groups.multi_step.minimum_accuracy).toBe(0.9);
    expect(gate.groups.multi_step.accuracy).toBe(0.9);
    expect(gate.groups.multi_step.passed).toBe(true);
  });

  it('passes fixture_call_succeeded predicates when the observed call matches pinned fixture output', async () => {
    const runtime = replay.createCatalogRuntime(catalog());
    const record = baseRecord({
      oracle: {
        ...baseRecord().oracle,
        acceptable_calls: [{ tool_name: 'compute_gc', parameters: { sequence: 'ATGC' } }],
        argument_provenance: [],
        terminal_predicates: [{ type: 'fixture_call_succeeded', tool_name: 'compute_gc' }],
      },
      verification: {
        leakage_passed: true,
        fixture_executable: true,
        fixture_replay: {
          status: 'passed',
          reason_code: 'passed',
          fixture_outputs: [
            {
              call_index: 0,
              tool_name: 'compute_gc',
              result: { success: true, gc: 0.5 },
              provenance: { fixture_id: 'pinned-sequence-v1' },
            },
          ],
        },
      },
    });
    const requestChat = vi.fn().mockResolvedValueOnce(toolResponse('compute_gc', { sequence: 'ATGC' }, 'observed_1'));

    const result = await replay.replayExample(record, 1, options(), runtime, requestChat);

    expect(result.taxonomy).toBe('pass');
    expect(result.terminal_predicate_results).toEqual([
      {
        predicate_index: 0,
        passed: true,
        source: 'semantic_call_observation_and_pinned_fixture_output',
        execution_assessed: false,
      },
    ]);
    const row = replay.buildSidecarRow(record, [result], options(), runtime);
    expect(row.status).toBe('passed');
    expect(row.reason_code).toBe('passed');
    expect(row.semantic_verdict).toBe('passed');
  });

  it('blocks benchmark-derived records before invoking the provider', async () => {
    const runtime = replay.createCatalogRuntime(catalog());
    const unsafe = baseRecord({
      provenance: { source_type: 'automatic_simple', source_ref: 'benchmark-suites/AutomaticSimpleSuite.js' },
    });
    const requestChat = vi.fn();
    const result = await replay.replayExample(unsafe, 1, options(), runtime, requestChat);

    expect(result.taxonomy).toBe('fixture_missing');
    expect(result.fixture_error).toContain('benchmark-derived source is forbidden');
    expect(requestChat).not.toHaveBeenCalled();
  });
});
