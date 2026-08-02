#!/usr/bin/env node
'use strict';
/* eslint-disable no-new-func */

/**
 * Re-score stored benchmark records under the task-completion contract.
 *
 * The strict contract requires the exact oracle tool sequence and canonically
 * equivalent arguments. Task-completion mode instead asks: did the observed
 * plan cover every expected capability with schema-valid calls? It accepts
 * equivalent tools, alternative-but-equivalent parameter keys, different step
 * orders, and extra read-only calls. This is an audit tier for deciding
 * whether a failure is a genuine task failure or oracle strictness.
 */

const fs = require('fs');
const path = require('path');
const DynamicToolsSnapshotAdapter = require('../src/renderer/modules/DynamicToolsSnapshotAdapter.js');
const StrictAutomaticEvaluator = require('../src/renderer/modules/benchmark-suites/StrictAutomaticEvaluator.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools_registry', 'generated', 'tool-registry-manifest.json');

function parseArgs(argv) {
  const options = { input: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.input = path.resolve(argv[++index]);
    else if (arg === '--output') options.output = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.input || !options.output) throw new Error('--input and --output are required');
  return options;
}

function loadAutomaticTests() {
  const suiteRoot = path.join(REPO_ROOT, 'src', 'renderer', 'modules', 'benchmark-suites');
  const windowMock = {
    songBenchmarkDebug: { detectedTools: [] },
    benchmarkUI: { getDefaultDirectory: () => './test_data/' },
    chatManager: { toolExecutionTracker: { getSessionExecutions: () => [] } },
  };
  const baseCode = fs.readFileSync(path.join(suiteRoot, 'BenchmarkEvaluatorBase.js'), 'utf8');
  const Base = new Function('window', `${baseCode}; return window.BenchmarkEvaluatorBase;`)(windowMock);
  const loadSuite = (filename, className, suiteId) => {
    const code = fs.readFileSync(path.join(suiteRoot, filename), 'utf8');
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
  if (tests.length !== 172) throw new Error(`Expected 172 automatic tests, found ${tests.length}`);
  return tests;
}

function summarize(records) {
  const passed = records.filter(record => record.evaluation.success).length;
  return {
    tests: records.length,
    passed,
    failed: records.length - passed,
    accuracy: records.length ? passed / records.length : 0,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fs.readFileSync(options.input, 'utf8'));
  if (!Array.isArray(input.records)) throw new Error('Input file has no records array');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const adapter = new DynamicToolsSnapshotAdapter(manifest, { agentSystemEnabled: false });
  const evaluator = new StrictAutomaticEvaluator({
    assessmentMode: 'completion',
    validateToolCall: (name, parameters) => adapter.validateToolCall(name, parameters),
  });
  // Simple and complex suites share test ids (nav_auto_01, primer_auto_01,
  // restrict_auto_01, ...), so the lookup key must include the suite id.
  const tests = new Map(loadAutomaticTests().map(test => [`${test.suiteId}:${test.id}`, test]));

  const records = input.records.map(record => {
    const test = tests.get(`${record.suite_id}:${record.test_id}`);
    if (!test) throw new Error(`Unknown test ${record.suite_id}:${record.test_id}`);
    const calls = Array.isArray(record.calls) ? record.calls : [];
    const evaluation = evaluator.evaluate(test, {
      actualResult: { nativeFunctionCalls: calls },
      llmInteractionData: {
        request: { dynamicToolsAnalysis: { selectedToolNames: record.selected_tools || [] } },
        response: { functionCalls: calls, toolExecutions: [] },
      },
    });
    return { ...record, evaluation };
  });

  const summary = {
    schema_version: '1.0',
    scorer: 'task-completion-v1',
    assessment_tier: 'task-completion-contract',
    source: options.input,
    source_overall: input.summary?.overall || null,
    overall: summarize(records),
    automatic_simple: summarize(records.filter(record => record.suite_id === 'automatic_simple')),
    automatic_complex: summarize(records.filter(record => record.suite_id === 'automatic_complex')),
    completion_rules: {
      equivalent_tools: ['blast_create_db_from_genome <-> blast_create_quick_db_for_current_genome'],
      extra_read_only_calls_allowed: true,
      step_order_free: true,
      context_placeholder_parameters_may_be_omitted_when_schema_valid: true,
      alternative_parameter_keys_accepted: ['switch_to_tab: tab_id <- tab_name/tab_index'],
      observed_calls_must_be_schema_valid: true,
    },
  };
  const report = { summary, records };
  fs.writeFileSync(options.output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) main();

module.exports = { loadAutomaticTests };
