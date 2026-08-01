#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE = path.join(REPO_ROOT, 'datasets', 'tool-calling-v1', 'release');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'finetuning', 'qwen3.5-4b', 'data');
const MAX_TOOLS = 6;

function parseArgs(argv) {
  const options = { source: DEFAULT_SOURCE, output: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source') options.source = path.resolve(argv[++index]);
    else if (arg === '--output') options.output = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function writeJsonl(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    records.map(record => JSON.stringify(record)).join('\n') + (records.length > 0 ? '\n' : '')
  );
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function getExpectedToolNames(record) {
  return new Set(
    (record.oracle?.acceptable_calls || [])
      .map(call => call?.tool_name)
      .filter(Boolean)
  );
}

function selectToolNames(record) {
  const expected = getExpectedToolNames(record);
  const candidates = [...new Set(record.tool_catalog?.candidate_tool_names || [])];
  if ([...expected].some(name => !candidates.includes(name))) {
    throw new Error(`${record.example_id}: expected tool missing from candidate catalog`);
  }
  if (candidates.length <= MAX_TOOLS) return candidates;
  const goldFirst = [...expected, ...candidates.filter(name => !expected.has(name))];
  return goldFirst.slice(0, MAX_TOOLS);
}

function preserveNativeTool(tool) {
  return JSON.parse(JSON.stringify(tool));
}

const COMPACT_PROPERTY_KEYS = new Set([
  'type',
  'enum',
  'const',
  'default',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems',
  'minProperties',
  'maxProperties',
  'format',
  'items',
  'properties',
  'required',
  'additionalProperties',
  'oneOf',
  'anyOf',
  'allOf',
]);

function compactSchema(schema, isRoot = false) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema;
  const compact = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'description') {
      if (isRoot && typeof value === 'string') compact.description = value.slice(0, 160);
      continue;
    }
    if (key === 'examples' || key === 'title' || key === '$comment') continue;
    if (['properties', 'items', 'additionalProperties', 'not'].includes(key) && value && typeof value === 'object') {
      if (key === 'properties') {
        compact.properties = Object.fromEntries(
          Object.entries(value).map(([name, propertySchema]) => [name, compactSchema(propertySchema)])
        );
      } else {
        compact[key] = compactSchema(value);
      }
      continue;
    }
    if (['oneOf', 'anyOf', 'allOf'].includes(key) && Array.isArray(value)) {
      compact[key] = value.map(item => compactSchema(item));
      continue;
    }
    if (COMPACT_PROPERTY_KEYS.has(key)) compact[key] = value;
  }
  return compact;
}

function compactNativeTool(tool) {
  const cloned = preserveNativeTool(tool);
  const fn = cloned.function || {};
  fn.parameters = compactSchema(fn.parameters || { type: 'object', properties: {} }, true);
  return cloned;
}

function getTrainingEligibility(record) {
  const reasons = [];
  if (record.verification?.schema_valid !== true) reasons.push('schema_not_valid');
  if (record.strong_model_replay?.status !== 'passed') reasons.push('strong_model_replay_not_passed');
  if (record.strong_model_replay?.semantic_verdict !== 'passed') {
    reasons.push('strong_model_semantic_verdict_not_passed');
  }
  if (record.strong_model_replay?.comparison_mode !== 'semantic_canonical_equivalence') {
    reasons.push('strong_model_comparison_mode_invalid');
  }
  if (record.labels?.stateful && record.verification?.state_verified !== true) {
    reasons.push('stateful_record_not_state_verified');
  }
  if (record.oracle?.decision === 'call' && record.verification?.fixture_executable !== true) {
    reasons.push('tool_call_not_fixture_executable');
  }
  if ((record.oracle?.argument_provenance || []).length > 0 && record.verification?.fixture_executable !== true) {
    reasons.push('dependent_workflow_not_fixture_executable');
  }
  return {
    eligible: reasons.length === 0,
    reason: reasons[0] || 'eligible',
    reasons,
  };
}

function assertTrainingEligible(record) {
  const eligibility = getTrainingEligibility(record);
  if (!eligibility.eligible) {
    throw new Error(`${record.example_id}: training-ineligible (${eligibility.reason})`);
  }
}

function cleanMessage(message) {
  const cleaned = { role: message.role };
  if (message.content !== undefined) cleaned.content = message.content;
  if (message.name) cleaned.name = message.name;
  if (message.tool_call_id) cleaned.tool_call_id = message.tool_call_id;
  if (Array.isArray(message.tool_calls)) {
    cleaned.tool_calls = message.tool_calls.map(toolCall => {
      const normalized = JSON.parse(JSON.stringify(toolCall));
      const rawArguments = normalized.function?.arguments;
      if (typeof rawArguments === 'string') {
        try {
          normalized.function.arguments = JSON.parse(rawArguments);
        } catch (error) {
          throw new Error(`Invalid tool-call arguments JSON for ${normalized.function?.name || 'unknown'}: ${error.message}`);
        }
      }
      if (
        !normalized.function ||
        !normalized.function.arguments ||
        Array.isArray(normalized.function.arguments) ||
        typeof normalized.function.arguments !== 'object'
      ) {
        throw new Error(`Qwen3.5 requires object arguments for ${normalized.function?.name || 'unknown'}`);
      }
      return normalized;
    });
  }
  return cleaned;
}

function expandRecord(record, toolMap) {
  assertTrainingEligible(record);
  const selectedNames = selectToolNames(record);
  const tools = selectedNames.map(name => {
    const tool = toolMap.get(name);
    if (!tool) throw new Error(`${record.example_id}: unknown tool ${name}`);
    return compactNativeTool(tool);
  });
  const messages = (record.messages || []).map(cleanMessage);
  const examples = [];

  messages.forEach((message, index) => {
    if (message.role !== 'assistant' || !Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
      return;
    }
    examples.push({
      messages: messages.slice(0, index + 1),
      tools,
      metadata: {
        source_example_id: record.example_id,
        scenario_family_id: record.scenario_family_id,
        supervised_target: 'tool_call',
        turn_index: index,
      },
    });
  });

  if (examples.length === 0) {
    const lastAssistantIndex = messages.findLastIndex(message => message.role === 'assistant');
    if (lastAssistantIndex === -1) throw new Error(`${record.example_id}: no assistant target`);
    examples.push({
      messages: messages.slice(0, lastAssistantIndex + 1),
      tools,
      metadata: {
        source_example_id: record.example_id,
        scenario_family_id: record.scenario_family_id,
        supervised_target: record.oracle?.decision || 'respond',
        turn_index: lastAssistantIndex,
      },
    });
  }
  return examples;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const releaseManifestPath = path.join(options.source, 'manifest.json');
  const releaseManifest = readJson(releaseManifestPath);
  if (releaseManifest.benchmark_scope?.automatic_simple !== 143) {
    throw new Error('Expected exactly 143 automatic-simple leakage fingerprints');
  }
  if (releaseManifest.benchmark_scope?.automatic_complex !== 29) {
    throw new Error('Expected exactly 29 automatic-complex leakage fingerprints');
  }
  if (releaseManifest.benchmark_scope?.manual_tests_included !== 0) {
    throw new Error('Manual benchmark data must not be included');
  }

  const catalog = readJson(path.join(options.source, 'tool-catalog.json'));
  const toolMap = new Map(catalog.tools.map(tool => [tool.function.name, tool]));
  const splitMap = [
    ['train', 'train.jsonl'],
    ['dev', 'valid.jsonl'],
    ['holdout', 'test.jsonl'],
  ];
  const outputStats = {};
  const preparedSplits = splitMap.map(([sourceSplit, outputFilename]) => {
    const sourcePath = path.join(options.source, `${sourceSplit}.jsonl`);
    const sourceRecords = readJsonl(sourcePath);
    const eligibility = sourceRecords.map(record => ({ record, ...getTrainingEligibility(record) }));
    const eligibleRecords = eligibility.filter(item => item.eligible).map(item => item.record);
    const filteredReasonCounts = eligibility
      .filter(item => !item.eligible)
      .reduce((counts, item) => {
        counts[item.reason] = (counts[item.reason] || 0) + 1;
        return counts;
      }, {});
    const filteredGateCounts = eligibility
      .filter(item => !item.eligible)
      .flatMap(item => item.reasons)
      .reduce((counts, reason) => {
        counts[reason] = (counts[reason] || 0) + 1;
        return counts;
      }, {});
    return { sourceSplit, outputFilename, sourceRecords, eligibleRecords, filteredReasonCounts, filteredGateCounts };
  });
  const totalEligibleRecords = preparedSplits.reduce((count, split) => count + split.eligibleRecords.length, 0);

  for (const {
    sourceSplit,
    outputFilename,
    sourceRecords,
    eligibleRecords,
    filteredReasonCounts,
    filteredGateCounts,
  } of preparedSplits) {
    const baseExamples = eligibleRecords.flatMap(record => expandRecord(record, toolMap));
    const examples = baseExamples;
    const outputPath = path.join(options.output, outputFilename);
    writeJsonl(outputPath, examples);
    outputStats[sourceSplit] = {
      source_records: sourceRecords.length,
      eligible_source_records: eligibleRecords.length,
      filtered_source_records: sourceRecords.length - eligibleRecords.length,
      filtered_reason_counts: filteredReasonCounts,
      unmet_gate_counts: filteredGateCounts,
      supervised_examples: examples.length,
      tool_call_targets: examples.filter(example => example.metadata.supervised_target === 'tool_call').length,
      response_targets: examples.filter(example => example.metadata.supervised_target !== 'tool_call').length,
      max_tools: examples.length > 0 ? Math.max(...examples.map(example => example.tools.length)) : 0,
      tool_count_histogram: examples.reduce((counts, example) => {
        counts[example.tools.length] = (counts[example.tools.length] || 0) + 1;
        return counts;
      }, {}),
      sha256: sha256File(outputPath),
    };
  }

  const tokenStats = {
    schema_version: '2.0',
    status: totalEligibleRecords === 0 ? 'not_run_no_promoted_records' : 'pending_tokenizer_verification',
    model: null,
    max_seq_length: null,
    manual_tests_included: 0,
    splits: Object.fromEntries(
      [
        ['train', 'train'],
        ['valid', 'dev'],
        ['test', 'holdout'],
      ].map(([outputName, sourceSplit]) => {
        const records = outputStats[sourceSplit].supervised_examples;
        const emptyValue = records === 0 ? 0 : null;
        return [
          outputName,
          {
            records,
            min_tokens: emptyValue,
            p50_tokens: emptyValue,
            p95_tokens: emptyValue,
            p99_tokens: emptyValue,
            max_tokens: emptyValue,
            max_prompt_offset: emptyValue,
            sha256: outputStats[sourceSplit].sha256,
          },
        ];
      })
    ),
  };
  fs.writeFileSync(path.join(options.output, 'token-stats.json'), JSON.stringify(tokenStats, null, 2) + '\n');

  const manifest = {
    schema_version: '2.0',
    format: 'mlx-lm-tools-jsonl',
    source_release_manifest_sha256: sha256File(releaseManifestPath),
    source_registry_hash: releaseManifest.registry_hash,
    benchmark_scope: {
      automatic_simple: 143,
      automatic_complex: 29,
      manual_tests_included: 0,
      use: 'leakage-gate-only',
    },
    max_candidate_tools: MAX_TOOLS,
    tool_schema_profile: {
      function_descriptions_preserved: 'truncated_160',
      property_descriptions_included: false,
      defaults_preserved: true,
      examples_preserved: false,
      source_semantics_preserved: true,
      structural_constraints_preserved: true,
      candidate_order_preserved: true,
      deterministic_random_gold_position: true,
      semantically_hard_distractors: true,
      all_gold_tools_always_included: true,
      compact_training_schema: 'compact-v1',
    },
    train_decision_repeat: 1,
    training_eligibility: {
      strong_model_semantic_replay_required: true,
      fixture_execution_required_for_tool_calls: true,
      state_verification_required_for_stateful_records: true,
      literal_provider_json_is_not_an_oracle: true,
      total_eligible_source_records: totalEligibleRecords,
      training_ready: totalEligibleRecords > 0,
      empty_output_reason:
        totalEligibleRecords === 0
          ? 'No promoted rows have passed all strong-model, fixture-execution, and state-verification gates.'
          : null,
    },
    prompt_masking_required: true,
    splits: outputStats,
  };
  fs.writeFileSync(path.join(options.output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}

if (require.main === module) main();

module.exports = {
  assertTrainingEligible,
  cleanMessage,
  compactNativeTool,
  compactSchema,
  expandRecord,
  getTrainingEligibility,
  preserveNativeTool,
  selectToolNames,
};
