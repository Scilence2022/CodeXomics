#!/usr/bin/env node
'use strict';
/* eslint-disable no-new-func */

const fs = require('fs');
const path = require('path');
const DynamicToolsSnapshotAdapter = require('../src/renderer/modules/DynamicToolsSnapshotAdapter.js');
const StrictAutomaticEvaluator = require('../src/renderer/modules/benchmark-suites/StrictAutomaticEvaluator.js');
const { buildContractToolResult } = require('./lib/contract-tool-results.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools_registry', 'generated', 'tool-registry-manifest.json');
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, 'finetuning', 'qwen3.5-4b', 'metrics');
const OLLAMA_CHAT_URL = 'http://127.0.0.1:11434/api/chat';
const CANDIDATE_LIMIT = 24;

function parseArgs(argv) {
  const options = {
    model: 'qwen3.5:4b',
    output: null,
    concurrency: 1,
    limit: Infinity,
    suite: 'all',
    tag: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--model') options.model = argv[++index];
    else if (arg === '--output') options.output = path.resolve(argv[++index]);
    else if (arg === '--concurrency') options.concurrency = Number(argv[++index]);
    else if (arg === '--limit') options.limit = Number(argv[++index]);
    else if (arg === '--suite') options.suite = argv[++index];
    else if (arg === '--tag') options.tag = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['all', 'simple', 'complex'].includes(options.suite)) throw new Error('Invalid --suite value');
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) throw new Error('Invalid concurrency');
  if (!options.output) {
    const safeModel = options.model.replace(/[^a-zA-Z0-9._-]+/g, '_');
    // Simple and complex runs share the same model+tag, so the suite must be
    // part of the default filename or one run silently overwrites the other.
    const suiteSuffix = options.suite === 'all' ? '' : `-${options.suite}`;
    const suffix = options.tag ? `-${options.tag}` : '';
    options.output = path.join(DEFAULT_OUTPUT_ROOT, `${safeModel}${suiteSuffix}${suffix}.json`);
  }
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
  if (tests.filter(test => test.suiteId === 'automatic_simple').length !== 143) {
    throw new Error('Automatic-simple test count is not 143');
  }
  if (tests.filter(test => test.suiteId === 'automatic_complex').length !== 29) {
    throw new Error('Automatic-complex test count is not 29');
  }
  return tests;
}

function normalizeArguments(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch (_error) {
    return { __invalid_json_arguments: value };
  }
}

async function ollamaChat(model, messages, tools) {
  const response = await fetch(OLLAMA_CHAT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      tools,
      stream: false,
      keep_alive: '30m',
      options: {
        temperature: 0,
        seed: 42,
        num_ctx: 32768,
        num_predict: 8192,
      },
    }),
  });
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  return response.json();
}

function buildSummary(model, records, startedAt, completedAt) {
  const summarize = subset => {
    const passed = subset.filter(record => record.evaluation.success).length;
    const totalDuration = subset.reduce((sum, record) => sum + record.duration_ms, 0);
    return {
      tests: subset.length,
      passed,
      failed: subset.length - passed,
      accuracy: subset.length ? passed / subset.length : 0,
      average_score_ratio: subset.length
        ? subset.reduce((sum, record) => sum + record.evaluation.score / record.evaluation.maxScore, 0) /
          subset.length
        : 0,
      average_duration_ms: subset.length ? totalDuration / subset.length : 0,
      prompt_tokens: subset.reduce((sum, record) => sum + record.prompt_eval_count, 0),
      generated_tokens: subset.reduce((sum, record) => sum + record.eval_count, 0),
    };
  };
  return {
    schema_version: '1.0',
    scorer: 'strict-automatic-v2',
    assessment_tier: 'native-function-contract',
    model,
    started_at: startedAt,
    completed_at: completedAt,
    tool_result_mode: 'domain-shaped-contract',
    deterministic_options: {
      temperature: 0,
      seed: 42,
      stream: false,
      candidate_limit: CANDIDATE_LIMIT,
      thinking: 'enabled',
      num_predict: 8192,
    },
    benchmark_scope: { automatic_simple: 143, automatic_complex: 29, manual_tests_included: 0 },
    overall: summarize(records),
    automatic_simple: summarize(records.filter(record => record.suite_id === 'automatic_simple')),
    automatic_complex: summarize(records.filter(record => record.suite_id === 'automatic_complex')),
  };
}

async function evaluateTest(test, model, adapter, evaluator) {
  const selected = adapter.selectRelevantTools(test.instruction, {}, CANDIDATE_LIMIT);
  const tools = selected
    .map(tool => adapter.toNativeFunctionTool(tool))
    .filter(Boolean)
    .map(tool => ({ type: tool.type, function: { ...tool.function, strict: undefined } }));
  const messages = [
    {
      role: 'system',
      content:
        'Use only the supplied CodeXomics tools. Call tools instead of describing calls. Ground all arguments in the user request, this fixture context, or prior tool results. ' +
        'Deterministic fixture context: genome ECOLI.gbk is loaded; active chromosome is U00096; current view is U00096:100000-101000; annotations and UI state are available through tools. ' +
        'Do not invent values that are absent from all three sources. ' +
        'The request may contain several steps. Track every requested step and keep calling tools until all of them are done; ' +
        'do not stop, repeat completed steps, or switch to a different action after partial progress. ' +
        'Choose the tool that performs the requested action (an analysis or editing tool), not a read-only inspection tool.',
    },
    { role: 'user', content: test.instruction },
  ];
  const expectedTools = evaluator.getExpectedTools(test);
  const expectedCount = expectedTools.length;
  const calls = [];
  let promptEvalCount = 0;
  let evalCount = 0;
  let truncatedTurns = 0;
  const started = Date.now();
  let apiError = null;

  try {
    const maxTurns = Math.max(1, expectedCount + 2);
    for (let turn = 0; turn < maxTurns; turn += 1) {
      const response = await ollamaChat(model, messages, tools);
      promptEvalCount += Number(response.prompt_eval_count || 0);
      evalCount += Number(response.eval_count || 0);
      if (response.done_reason === 'length') truncatedTurns += 1;
      const assistant = response.message || { role: 'assistant', content: '' };
      messages.push(assistant);
      const responseCalls = assistant.tool_calls || [];
      if (responseCalls.length === 0) break;

      for (const toolCall of responseCalls) {
        const toolName = toolCall.function?.name;
        const parameters = normalizeArguments(toolCall.function?.arguments);
        const validation = adapter.validateToolCall(toolName, parameters);
        calls.push({ tool_name: toolName, parameters, schema_valid: validation.valid });
        messages.push({
          role: 'tool',
          tool_name: toolName,
          content:
            JSON.stringify(buildContractToolResult(toolName, parameters)) +
            '\nIf the request has remaining steps, emit the next tool call(s); otherwise reply with the final answer.',
        });
      }
      const coveredExpected = expectedTools.filter(tool =>
        calls.some(call => evaluator.toolMatches(call.tool_name, tool))
      ).length;
      if (coveredExpected >= expectedCount) break;
    }
  } catch (error) {
    apiError = error.message;
  }

  const evaluation = evaluator.evaluate(test, {
    actualResult: { nativeFunctionCalls: calls },
    llmInteractionData: {
      request: { dynamicToolsAnalysis: { selectedToolNames: selected.map(tool => tool.name) } },
      response: { functionCalls: calls, toolExecutions: [] },
    },
  });
  if (apiError) evaluation.errors.unshift(apiError);
  return {
    test_id: test.id,
    suite_id: test.suiteId,
    category: test.category,
    type: test.type,
    prompt_sha256: require('crypto').createHash('sha256').update(test.instruction).digest('hex'),
    duration_ms: Date.now() - started,
    prompt_eval_count: promptEvalCount,
    eval_count: evalCount,
    selected_tools: selected.map(tool => tool.name),
    calls,
    api_error: apiError,
    truncated_turns: truncatedTurns,
    evaluation,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const adapter = new DynamicToolsSnapshotAdapter(manifest, { agentSystemEnabled: false });
  const evaluator = new StrictAutomaticEvaluator({
    assessmentMode: 'contract',
    validateToolCall: (name, parameters) => adapter.validateToolCall(name, parameters),
  });
  let tests = loadAutomaticTests();
  if (options.suite !== 'all') {
    const suiteId = options.suite === 'simple' ? 'automatic_simple' : 'automatic_complex';
    tests = tests.filter(test => test.suiteId === suiteId);
  }
  tests = tests.slice(0, options.limit);
  const startedAt = new Date().toISOString();
  const records = new Array(tests.length);
  let cursor = 0;
  let completed = 0;

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  const worker = async () => {
    while (cursor < tests.length) {
      const index = cursor;
      cursor += 1;
      records[index] = await evaluateTest(tests[index], options.model, adapter, evaluator);
      completed += 1;
      const record = records[index];
      console.log(
        `[${completed}/${tests.length}] ${record.test_id}: ${record.evaluation.success ? 'PASS' : 'FAIL'} ` +
          `${record.duration_ms}ms calls=${record.calls.map(call => call.tool_name).join(',') || 'none'}`
      );
      const partial = records.filter(Boolean);
      fs.writeFileSync(
        `${options.output}.partial`,
        JSON.stringify({ summary: buildSummary(options.model, partial, startedAt, new Date().toISOString()), records: partial }, null, 2)
      );
    }
  };
  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  const report = {
    summary: buildSummary(options.model, records, startedAt, new Date().toISOString()),
    records,
  };
  fs.writeFileSync(options.output, JSON.stringify(report, null, 2) + '\n');
  if (fs.existsSync(`${options.output}.partial`)) fs.unlinkSync(`${options.output}.partial`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
