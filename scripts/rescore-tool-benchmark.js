#!/usr/bin/env node
'use strict';
/* eslint-disable no-new-func */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DynamicToolsSnapshotAdapter = require('../src/renderer/modules/DynamicToolsSnapshotAdapter.js');
const StrictAutomaticEvaluator = require('../src/renderer/modules/benchmark-suites/StrictAutomaticEvaluator.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools_registry', 'generated', 'tool-registry-manifest.json');
const SUITE_ROOT = path.join(REPO_ROOT, 'src', 'renderer', 'modules', 'benchmark-suites');

function parseArgs(argv) {
  const options = { input: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--input') options.input = path.resolve(argv[++index]);
    else if (argument === '--output') options.output = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.input) throw new Error('--input is required');
  if (!options.output) {
    const extension = path.extname(options.input);
    options.output = `${options.input.slice(0, -extension.length)}-rescored-v2${extension || '.json'}`;
  }
  if (options.input === options.output) throw new Error('Refusing to overwrite the source report');
  return options;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function loadAutomaticTests() {
  const windowMock = {
    songBenchmarkDebug: { detectedTools: [] },
    benchmarkUI: { getDefaultDirectory: () => './test_data/' },
    chatManager: { toolExecutionTracker: { getSessionExecutions: () => [] } },
  };
  const baseCode = fs.readFileSync(path.join(SUITE_ROOT, 'BenchmarkEvaluatorBase.js'), 'utf8');
  const Base = new Function('window', `${baseCode}; return window.BenchmarkEvaluatorBase;`)(windowMock);
  const loadSuite = (filename, className, suiteId) => {
    const code = fs.readFileSync(path.join(SUITE_ROOT, filename), 'utf8');
    const Suite = new Function('window', 'BenchmarkEvaluatorBase', `${code}; return window.${className};`)(
      windowMock,
      Base
    );
    return new Suite().getTests().map(test => ({ ...test, suiteId }));
  };
  const tests = [
    ...loadSuite('AutomaticSimpleSuite.js', 'AutomaticSimpleSuite', 'automatic_simple'),
    ...loadSuite('AutomaticComplexSuite.js', 'AutomaticComplexSuite', 'automatic_complex'),
  ];
  const simpleCount = tests.filter(test => test.suiteId === 'automatic_simple').length;
  const complexCount = tests.filter(test => test.suiteId === 'automatic_complex').length;
  if (simpleCount !== 143 || complexCount !== 29) {
    throw new Error(`Expected 143 simple + 29 complex tests, received ${simpleCount} + ${complexCount}`);
  }
  return tests;
}

function normalizeSourceCall(call) {
  return {
    tool_name: call?.tool_name || call?.toolName || call?.tool || call?.function?.name || call?.name,
    parameters:
      call?.parameters ?? call?.arguments ?? call?.function?.arguments ?? call?.params ?? {},
  };
}

function classify(evaluation) {
  const details = evaluation.details;
  if (details.metrics.call_observed.observed_count === 0) return 'no_native_call';
  if (!details.exactSequence) return 'tool_sequence_mismatch';
  if (!details.argumentsExact) return 'argument_mismatch';
  if (!details.schemasExact) return 'schema_invalid';
  return evaluation.success ? 'passed' : 'other_contract_failure';
}

function summarize(records) {
  const total = records.length;
  const count = predicate => records.filter(predicate).length;
  const failureTaxonomy = records.reduce((accumulator, record) => {
    accumulator[record.primary_failure_reason] = (accumulator[record.primary_failure_reason] || 0) + 1;
    return accumulator;
  }, {});
  const ratio = key => (total ? count(record => record.evaluation.details[key] === true) / total : 0);
  const passed = count(record => record.evaluation.success);
  return {
    tests: total,
    passed,
    failed: total - passed,
    contract_accuracy: total ? passed / total : 0,
    exact_tool_sequence_rate: ratio('exactSequence'),
    exact_argument_rate: ratio('argumentsExact'),
    all_observed_schema_valid_rate: ratio('schemasExact'),
    retrieval_recall: total
      ? records.reduce((sum, record) => sum + record.evaluation.details.retrieval.recall, 0) / total
      : 0,
    failure_taxonomy: failureTaxonomy,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceText = fs.readFileSync(options.input, 'utf8');
  const source = JSON.parse(sourceText);
  if (!Array.isArray(source.records)) throw new Error('Input report does not contain a records array');

  const tests = loadAutomaticTests();
  const testByKey = new Map(tests.map(test => [`${test.suiteId}/${test.id}`, test]));
  const manifestText = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const adapter = new DynamicToolsSnapshotAdapter(JSON.parse(manifestText), { agentSystemEnabled: false });
  const evaluator = new StrictAutomaticEvaluator({
    assessmentMode: 'contract',
    validateToolCall: (name, parameters) => adapter.validateToolCall(name, parameters),
  });

  const records = source.records.map(record => {
    const key = `${record.suite_id}/${record.test_id}`;
    const test = testByKey.get(key);
    if (!test) throw new Error(`Source report contains an unknown automatic test: ${key}`);
    const currentPromptHash = sha256(test.instruction);
    if (record.prompt_sha256 && record.prompt_sha256 !== currentPromptHash) {
      throw new Error(`Prompt hash mismatch for ${key}; rerun the model instead of rescoring stale output`);
    }
    const calls = (record.calls || []).map(normalizeSourceCall);
    const evaluation = evaluator.evaluate(test, {
      actualResult: { nativeFunctionCalls: calls },
      llmInteractionData: {
        request: { dynamicToolsAnalysis: { selectedToolNames: record.selected_tools || [] } },
        response: { functionCalls: calls, toolExecutions: [] },
      },
    });
    return {
      test_id: record.test_id,
      suite_id: record.suite_id,
      category: record.category,
      prompt_sha256: currentPromptHash,
      selected_tools: record.selected_tools || [],
      calls,
      evaluation,
      primary_failure_reason: classify(evaluation),
    };
  });

  const expectedKeys = new Set(tests.map(test => `${test.suiteId}/${test.id}`));
  const presentKeys = new Set(records.map(record => `${record.suite_id}/${record.test_id}`));
  const missingTests = [...expectedKeys].filter(key => !presentKeys.has(key));
  const oracle = tests.map(test => ({
    suite_id: test.suiteId,
    test_id: test.id,
    prompt_sha256: sha256(test.instruction),
    expected_result: test.expectedResult,
  }));
  const report = {
    summary: {
      schema_version: '2.0',
      scorer: 'strict-automatic-v2',
      assessment_tier: 'native-function-contract',
      source_report: path.relative(REPO_ROOT, options.input),
      source_report_sha256: sha256(sourceText),
      registry_sha256: sha256(manifestText),
      oracle_sha256: sha256(stableJson(oracle)),
      provider: source.summary?.provider || null,
      model: source.summary?.model || null,
      source_started_at: source.summary?.started_at || null,
      rescored_at: new Date().toISOString(),
      benchmark_scope: { automatic_simple: 143, automatic_complex: 29, manual_tests_included: 0 },
      source_record_count: records.length,
      missing_tests: missingTests,
      overall: summarize(records),
      automatic_simple: summarize(records.filter(record => record.suite_id === 'automatic_simple')),
      automatic_complex: summarize(records.filter(record => record.suite_id === 'automatic_complex')),
    },
    records,
  };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  if (missingTests.length > 0) process.exitCode = 2;
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
