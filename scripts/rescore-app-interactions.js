#!/usr/bin/env node
'use strict';
/* eslint-disable no-new-func */

/**
 * Re-score persisted in-app benchmark interactions under a chosen
 * assessment mode. Used to predict the real benchmark result after scoring
 * changes (e.g. task-completion + real execution) without launching the app.
 */

const fs = require('fs');
const path = require('path');
const DynamicToolsSnapshotAdapter = require('../src/renderer/modules/DynamicToolsSnapshotAdapter.js');
const StrictAutomaticEvaluator = require('../src/renderer/modules/benchmark-suites/StrictAutomaticEvaluator.js');
const { loadAutomaticTests } = require('./rescore-task-completion.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools_registry', 'generated', 'tool-registry-manifest.json');
const DEFAULT_DIR = '/var/folders/c2/1m7l48jn1531sd25mgv82ccc0000gn/T/codexomics-benchmark-data';
const DEFAULT_RUN_START = 1785671058; // user's in-app run window (2026-08-02 11:44Z)
const DEFAULT_RUN_END = 1785672700; // 12:11Z (includes B1 blast complex tests)
const APP_TEST_DATA_DIR = '/Users/song/Documents/Genome-AI-Studio-Projects/test_data/';

function parseArgs(argv) {
  const options = { dir: DEFAULT_DIR, start: DEFAULT_RUN_START, end: DEFAULT_RUN_END, mode: 'completion' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dir') options.dir = argv[++index];
    else if (arg === '--test-data-dir') options.testDataDir = argv[++index];
    else if (arg === '--start') options.start = Number(argv[++index]);
    else if (arg === '--end') options.end = Number(argv[++index]);
    else if (arg === '--mode') options.mode = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function buildTestResult(interaction) {
  const functionCalls = Array.isArray(interaction.response?.functionCalls)
    ? interaction.response.functionCalls
    : [];
  const toolExecutions = Array.isArray(interaction.response?.toolExecutions)
    ? interaction.response.toolExecutions
    : [];
  const executionByCallId = new Map();
  for (const execution of toolExecutions) {
    const callId = execution.call_id ?? execution.tool_call_id ?? execution.id ?? null;
    if (callId !== null && callId !== undefined) executionByCallId.set(String(callId), execution);
  }
  const calls = functionCalls.map(call => {
    const merged = { ...call };
    const execution = executionByCallId.get(String(call.id ?? call.tool_call_id ?? ''));
    if (execution) {
      merged.executionObserved = true;
      merged.executionSuccess = execution.success === true;
      if (execution.success === false) merged.error = execution.error || 'tool execution failed';
    }
    return merged;
  });
  return {
    actualResult: { nativeFunctionCalls: calls, executedFunctionCalls: calls },
    llmInteractionData: {
      request: { dynamicToolsAnalysis: { selectedToolNames: [] } },
      response: { functionCalls: calls, toolExecutions },
    },
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const adapter = new DynamicToolsSnapshotAdapter(manifest, { agentSystemEnabled: false });
  const evaluator = new StrictAutomaticEvaluator({
    assessmentMode: options.mode,
    requireExecutionForCompletion: true,
    validateToolCall: (name, parameters) => adapter.validateToolCall(name, parameters),
  });
  const tests = new Map(
    loadAutomaticTests(options.testDataDir || APP_TEST_DATA_DIR).map(test => [`${test.suiteId}:${test.id}`, test])
  );
  const latestByTest = new Map();

  for (const filename of fs.readdirSync(options.dir)) {
    if (!filename.startsWith('interaction_automatic_') || !filename.endsWith('.json')) continue;
    const suiteId = filename.includes('interaction_automatic_simple_')
      ? 'automatic_simple'
      : filename.includes('interaction_automatic_complex_')
        ? 'automatic_complex'
        : null;
    if (!suiteId) continue;
    const filePath = path.join(options.dir, filename);
    const interaction = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const timestamp = Number(interaction.timestamp ? Date.parse(interaction.timestamp) : 0);
    if (timestamp < options.start * 1000 || timestamp > options.end * 1000) continue;
    if (!interaction.testId) continue;
    const key = `${suiteId}:${interaction.testId}`;
    const existing = latestByTest.get(key);
    // The user's reported run (B1) started at 11:44; a second run (B2) began
    // around 11:57 and wrote later copies of the same tests. Taking the
    // EARLIEST interaction in the window reconstructs B1.
    if (!existing || timestamp < existing.timestamp) {
      latestByTest.set(key, { interaction, timestamp, suiteId });
    }
  }

  const records = [];
  for (const [key, { interaction, suiteId }] of latestByTest) {
    const testId = interaction.testId;
    const test = tests.get(key);
    if (!test) continue;
    const evaluation = evaluator.evaluate(test, buildTestResult(interaction));
    records.push({
      test_id: testId,
      suite_id: suiteId,
      evaluation,
      calls: (interaction.response?.functionCalls || []).map(call => ({
        tool_name: call.tool_name,
        parameters: call.parameters || {},
      })),
    });
  }

  const summarize = subset => {
    const passed = subset.filter(record => record.evaluation.success).length;
    return { tests: subset.length, passed, failed: subset.length - passed, accuracy: subset.length ? passed / subset.length : 0 };
  };
  const summary = {
    mode: options.mode,
    requireExecutionForCompletion: true,
    window: [options.start, options.end],
    overall: summarize(records),
    automatic_simple: summarize(records.filter(record => record.suite_id === 'automatic_simple')),
    automatic_complex: summarize(records.filter(record => record.suite_id === 'automatic_complex')),
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log('\n=== failures ===');
  for (const record of records.filter(item => !item.evaluation.success)) {
    console.log(
      `[${record.suite_id}] ${record.test_id} | ${record.calls.map(call => call.tool_name).join(',')} | ` +
        JSON.stringify(record.evaluation.errors || []).slice(0, 220)
    );
  }
}

if (require.main === module) main();
