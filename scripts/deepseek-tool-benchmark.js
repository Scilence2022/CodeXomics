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
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, 'finetuning', 'qwen3.5-4b', 'metrics');
const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const CANDIDATE_LIMIT = 24;

function parseArgs(argv) {
  const options = {
    model: 'deepseek-v4-flash',
    baseUrl: process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL,
    output: null,
    concurrency: 4,
    limit: Infinity,
    suite: 'all',
    thinking: 'disabled',
    reasoningEffort: 'high',
    requestTimeoutMs: 180000,
    retries: 4,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--model') options.model = argv[++index];
    else if (arg === '--base-url') options.baseUrl = argv[++index];
    else if (arg === '--output') options.output = path.resolve(argv[++index]);
    else if (arg === '--concurrency') options.concurrency = Number(argv[++index]);
    else if (arg === '--limit') options.limit = Number(argv[++index]);
    else if (arg === '--suite') options.suite = argv[++index];
    else if (arg === '--thinking') options.thinking = argv[++index];
    else if (arg === '--reasoning-effort') options.reasoningEffort = argv[++index];
    else if (arg === '--request-timeout-ms') options.requestTimeoutMs = Number(argv[++index]);
    else if (arg === '--retries') options.retries = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['all', 'simple', 'complex'].includes(options.suite)) throw new Error('Invalid --suite value');
  if (!['enabled', 'disabled'].includes(options.thinking)) throw new Error('Invalid --thinking value');
  if (!['low', 'high', 'max'].includes(options.reasoningEffort)) {
    throw new Error('Invalid --reasoning-effort value');
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) throw new Error('Invalid concurrency');
  if (options.limit !== Infinity && (!Number.isFinite(options.limit) || options.limit < 1)) {
    throw new Error('Invalid limit');
  }
  if (!Number.isInteger(options.requestTimeoutMs) || options.requestTimeoutMs < 1000) {
    throw new Error('Invalid request timeout');
  }
  if (!Number.isInteger(options.retries) || options.retries < 0) throw new Error('Invalid retries');
  options.baseUrl = options.baseUrl.replace(/\/+$/, '');
  if (!options.output) {
    const safeModel = options.model.replace(/[^a-zA-Z0-9._-]+/g, '_');
    options.output = path.join(DEFAULT_OUTPUT_ROOT, `${safeModel}-${options.thinking}.json`);
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

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function deepSeekChat(options, messages, tools) {
  const requestBody = {
    model: options.model,
    messages,
    tools,
    tool_choice: 'auto',
    stream: false,
    max_tokens: options.thinking === 'enabled' ? 4096 : 512,
    thinking: { type: options.thinking },
  };
  if (options.thinking === 'enabled') requestBody.reasoning_effort = options.reasoningEffort;
  else requestBody.temperature = 0;

  let lastError;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);
    try {
      const response = await fetch(`${options.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'content-type': 'application/json',
          'user-agent': 'CodeXomics-tool-benchmark/1.0',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      const bodyText = await response.text();
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(`DeepSeek ${response.status}: ${bodyText.slice(0, 1000)}`);
        error.retryable = retryable;
        if (!retryable || attempt === options.retries) throw error;
        lastError = error;
      } else {
        return JSON.parse(bodyText);
      }
    } catch (error) {
      lastError = error.name === 'AbortError' ? new Error('DeepSeek request timed out') : error;
      if (error.retryable === false || attempt === options.retries) throw lastError;
    } finally {
      clearTimeout(timeout);
    }
    await wait(Math.min(1000 * 2 ** attempt, 8000));
  }
  throw lastError;
}

function buildSummary(options, records, startedAt, completedAt) {
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
      prompt_tokens: subset.reduce((sum, record) => sum + record.prompt_tokens, 0),
      completion_tokens: subset.reduce((sum, record) => sum + record.completion_tokens, 0),
      reasoning_tokens: subset.reduce((sum, record) => sum + record.reasoning_tokens, 0),
      cache_hit_tokens: subset.reduce((sum, record) => sum + record.cache_hit_tokens, 0),
      cache_miss_tokens: subset.reduce((sum, record) => sum + record.cache_miss_tokens, 0),
    };
  };
  return {
    schema_version: '1.0',
    scorer: 'strict-automatic-v2',
    assessment_tier: 'native-function-contract',
    provider: 'deepseek',
    model: options.model,
    started_at: startedAt,
    completed_at: completedAt,
    deterministic_options: {
      temperature: options.thinking === 'disabled' ? 0 : null,
      stream: false,
      thinking: options.thinking,
      reasoning_effort: options.thinking === 'enabled' ? options.reasoningEffort : null,
      max_tokens: options.thinking === 'enabled' ? 4096 : 512,
      candidate_limit: CANDIDATE_LIMIT,
    },
    tool_result_mode: 'contract-acknowledgement-only',
    benchmark_scope: { automatic_simple: 143, automatic_complex: 29, manual_tests_included: 0 },
    overall: summarize(records),
    automatic_simple: summarize(records.filter(record => record.suite_id === 'automatic_simple')),
    automatic_complex: summarize(records.filter(record => record.suite_id === 'automatic_complex')),
  };
}

async function evaluateTest(test, options, adapter, evaluator) {
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
        'Do not invent values that are absent from all three sources.',
    },
    { role: 'user', content: test.instruction },
  ];
  const expectedCount = evaluator.getExpectedTools(test).length;
  const calls = [];
  const modelVersions = new Set();
  let promptTokens = 0;
  let completionTokens = 0;
  let reasoningTokens = 0;
  let cacheHitTokens = 0;
  let cacheMissTokens = 0;
  const started = Date.now();
  let apiError = null;

  try {
    const maxTurns = Math.max(1, expectedCount + 1);
    for (let turn = 0; turn < maxTurns; turn += 1) {
      const response = await deepSeekChat(options, messages, tools);
      if (response.model) modelVersions.add(response.model);
      promptTokens += Number(response.usage?.prompt_tokens || 0);
      completionTokens += Number(response.usage?.completion_tokens || 0);
      reasoningTokens += Number(response.usage?.completion_tokens_details?.reasoning_tokens || 0);
      cacheHitTokens += Number(response.usage?.prompt_cache_hit_tokens || 0);
      cacheMissTokens += Number(response.usage?.prompt_cache_miss_tokens || 0);

      const rawAssistant = response.choices?.[0]?.message || { role: 'assistant', content: '' };
      const assistant = {
        role: 'assistant',
        content: rawAssistant.content ?? null,
      };
      if (rawAssistant.reasoning_content != null) assistant.reasoning_content = rawAssistant.reasoning_content;
      if (Array.isArray(rawAssistant.tool_calls) && rawAssistant.tool_calls.length) {
        assistant.tool_calls = rawAssistant.tool_calls;
      }
      messages.push(assistant);
      const responseCalls = assistant.tool_calls || [];
      if (responseCalls.length === 0) break;

      for (let callIndex = 0; callIndex < responseCalls.length; callIndex += 1) {
        const toolCall = responseCalls[callIndex];
        const toolName = toolCall.function?.name;
        const parameters = normalizeArguments(toolCall.function?.arguments);
        const validation = adapter.validateToolCall(toolName, parameters);
        calls.push({ tool_name: toolName, parameters, schema_valid: validation.valid });
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id || `call_${turn}_${callIndex}`,
          name: toolName,
          content: JSON.stringify({
            acknowledged: validation.valid,
            assessment_tier: 'native-function-contract',
            domain_result_available: false,
          }),
        });
      }
      if (calls.length >= expectedCount) break;
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
    prompt_sha256: crypto.createHash('sha256').update(test.instruction).digest('hex'),
    duration_ms: Date.now() - started,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    reasoning_tokens: reasoningTokens,
    cache_hit_tokens: cacheHitTokens,
    cache_miss_tokens: cacheMissTokens,
    model_versions: [...modelVersions],
    selected_tools: selected.map(tool => tool.name),
    calls,
    api_error: apiError,
    evaluation,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is required; pass it through the environment, never a CLI argument');
  }
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
      records[index] = await evaluateTest(tests[index], options, adapter, evaluator);
      completed += 1;
      const record = records[index];
      console.log(
        `[${completed}/${tests.length}] ${record.suite_id}/${record.test_id}: ` +
          `${record.evaluation.success ? 'PASS' : 'FAIL'} ${record.duration_ms}ms ` +
          `calls=${record.calls.map(call => call.tool_name).join(',') || 'none'}`
      );
      const partial = records.filter(Boolean);
      fs.writeFileSync(
        `${options.output}.partial`,
        JSON.stringify(
          { summary: buildSummary(options, partial, startedAt, new Date().toISOString()), records: partial },
          null,
          2
        )
      );
    }
  };
  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  const report = {
    summary: buildSummary(options, records, startedAt, new Date().toISOString()),
    records,
  };
  fs.writeFileSync(options.output, JSON.stringify(report, null, 2) + '\n');
  if (fs.existsSync(`${options.output}.partial`)) fs.unlinkSync(`${options.output}.partial`);
  console.log(JSON.stringify(report.summary, null, 2));
  if (records.some(record => record.api_error)) process.exitCode = 2;
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
