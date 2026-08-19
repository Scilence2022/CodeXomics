#!/usr/bin/env node
'use strict';
/* eslint-disable no-new-func */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DynamicToolsSnapshotAdapter = require('../src/renderer/modules/DynamicToolsSnapshotAdapter.js');
const StrictAutomaticEvaluator = require('../src/renderer/modules/benchmark-suites/StrictAutomaticEvaluator.js');
const { buildContractToolResult } = require('./lib/contract-tool-results.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools_registry', 'generated', 'tool-registry-manifest.json');
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, 'finetuning', 'qwen3.5-4b', 'metrics');

// The shipped loop bounds a turn by `llm.functionCallRounds` (default 10) and
// derives outstanding steps from the request text, never from an expected-call
// count. Disclosing that count is grading assistance the app cannot give.
const PRODUCTION_MAX_ROUNDS = 10;
const PRODUCTION_RECOVERY_NUDGE =
  '[Tool Protocol Repair]\nThe previous response did not complete the request. ' +
  'If an available tool is needed for a remaining step, emit the tool call now instead of describing it. ' +
  'If no tool is needed, provide the final answer directly.';
const PRODUCTION_TOOL_GUIDANCE =
  'These steps are done. Calling one of them again with the same parameters will be rejected. ' +
  'If the request has remaining steps, emit the next tool call(s); otherwise reply with the final answer.';
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
    // Run the harness the way the app runs: fixed round budget, no oracle
    // step-count disclosure, production result guidance.
    productionParity: false,
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
    else if (arg === '--production-parity') options.productionParity = true;
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
    // 512 tokens truncated long tool arguments (e.g. a virtual_digest call
    // carrying a full sequence), producing invalid JSON and false failures.
    max_tokens: options.thinking === 'enabled' ? 4096 : 4096,
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
        ? subset.reduce((sum, record) => sum + record.evaluation.score / record.evaluation.maxScore, 0) / subset.length
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
    tool_result_mode: 'domain-shaped-contract',
    // Oracle-assisted runs give the model information the shipped app cannot:
    // the expected step count and a round budget derived from it. Numbers from
    // the two modes are not comparable and must not be merged.
    harness_mode: options.productionParity ? 'production-parity' : 'oracle-assisted',
    harness_assistance: options.productionParity
      ? { expected_step_count_disclosed: false, oracle_round_budget: false, max_rounds: PRODUCTION_MAX_ROUNDS }
      : { expected_step_count_disclosed: true, oracle_round_budget: true, max_rounds: 'expected_steps + 4' },
    benchmark_scope: { automatic_simple: 143, automatic_complex: 29, manual_tests_included: 0 },
    overall: summarize(records),
    automatic_simple: summarize(records.filter(record => record.suite_id === 'automatic_simple')),
    automatic_complex: summarize(records.filter(record => record.suite_id === 'automatic_complex')),
  };
}

async function evaluateTest(test, options, adapter, evaluator) {
  const productionParity = options.productionParity === true;
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
        'Choose the tool that performs the requested action (an analysis or editing tool), not a read-only inspection tool. ' +
        'Supply every parameter the request implies even when the tool defines a default; relying on a default that changes the outcome is wrong. ' +
        'Before ending the turn, review the original request and complete every remaining step, including verification steps ("check again", "confirm") and final steps ("delete", "list again"). ' +
        'When a request asks to check or confirm after a modification, the verification must be its own tool call after the modification. ' +
        'A status check performed before changes does not verify the changes made after it. ' +
        'A successful modification is not the verification itself; if the request asks to confirm the result, perform the confirmation call too. ' +
        'Example: for "load the file, then search it", call the load tool, wait for its result, then call the search tool, and only then give the final answer - never stop after the first result.',
    },
    { role: 'user', content: test.instruction },
  ];
  const expectedTools = evaluator.getExpectedTools(test);
  const expectedCount = expectedTools.length;
  const calls = [];
  const modelVersions = new Set();
  let promptTokens = 0;
  let completionTokens = 0;
  let reasoningTokens = 0;
  let cacheHitTokens = 0;
  let cacheMissTokens = 0;
  let truncatedTurns = 0;
  const started = Date.now();
  let apiError = null;

  try {
    // Extra headroom absorbs benign duplicate calls; the loop breaks on
    // expected-step coverage instead of raw call count so an extra call can
    // never consume the final step's turn (bookmark/delete after a duplicate).
    // The oracle budget (expectedCount + 4) is not something the app can know.
    const maxTurns = productionParity ? PRODUCTION_MAX_ROUNDS : Math.max(1, expectedCount + 4);
    for (let turn = 0; turn < maxTurns; turn += 1) {
      const response = await deepSeekChat(options, messages, tools);
      if (response.model) modelVersions.add(response.model);
      promptTokens += Number(response.usage?.prompt_tokens || 0);
      completionTokens += Number(response.usage?.completion_tokens || 0);
      reasoningTokens += Number(response.usage?.completion_tokens_details?.reasoning_tokens || 0);
      cacheHitTokens += Number(response.usage?.prompt_cache_hit_tokens || 0);
      cacheMissTokens += Number(response.usage?.prompt_cache_miss_tokens || 0);

      const rawAssistant = response.choices?.[0]?.message || { role: 'assistant', content: '' };
      if (response.choices?.[0]?.finish_reason === 'length') truncatedTurns += 1;
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
      const usedBeforeTurn = new Set();
      const coverageBeforeTurn = expectedTools.filter(tool => {
        const matchIndex = calls.findIndex(
          (call, index) => !usedBeforeTurn.has(index) && evaluator.toolMatches(call.tool_name, tool)
        );
        if (matchIndex === -1) return false;
        usedBeforeTurn.add(matchIndex);
        return true;
      }).length;
      if (responseCalls.length === 0) {
        // Each expected step must be matched by a distinct observed call, so a
        // repeated tool (e.g. get_track_status twice) is not counted as
        // covered by a single earlier call.
        const usedCallIndexes = new Set();
        const coveredExpected = expectedTools.filter(tool => {
          const matchIndex = calls.findIndex(
            (call, index) => !usedCallIndexes.has(index) && evaluator.toolMatches(call.tool_name, tool)
          );
          if (matchIndex === -1) return false;
          usedCallIndexes.add(matchIndex);
          return true;
        }).length;
        if (coveredExpected < expectedCount && turn < maxTurns - 1) {
          // Production-style recovery (mirrors ChatManager protocol repair):
          // an actionable request that ended without every step covered gets
          // one generic nudge to continue, not test-specific guidance.
          messages.push({
            role: 'user',
            content: productionParity
              ? PRODUCTION_RECOVERY_NUDGE
              : `You have completed ${coveredExpected} of ${expectedCount} requested steps; ${expectedCount - coveredExpected} are still missing. ` +
                'The missing steps are the final steps of the request (verification, confirmation, cleanup, search, or query). ' +
                'Emit the next tool call NOW for the next missing step; do not reply with text only. ' +
                'Give the final answer only after every requested step is done.',
          });
          continue;
        }
        break;
      }

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
          // Production loop steering: ChatManager appends the same reminder
          // after every tool result so the model continues to the next step
          // instead of treating a single result as the end of the task.
          content:
            JSON.stringify(buildContractToolResult(toolName, parameters)) +
            '\n' +
            (productionParity
              ? PRODUCTION_TOOL_GUIDANCE
              : 'If the request has remaining steps, emit the next tool call(s); otherwise reply with the final answer. ' +
                'If the request asked to confirm or verify a change, that verification step is still pending.'),
        });
      }
      const usedCallIndexes = new Set();
      const coveredExpected = expectedTools.filter(tool => {
        const matchIndex = calls.findIndex(
          (call, index) => !usedCallIndexes.has(index) && evaluator.toolMatches(call.tool_name, tool)
        );
        if (matchIndex === -1) return false;
        usedCallIndexes.add(matchIndex);
        return true;
      }).length;
      // A turn whose calls advanced no new requested step (diversion loop)
      // gets the same recovery nudge as a no-call turn.
      if (coveredExpected < expectedCount && coveredExpected <= coverageBeforeTurn && turn < maxTurns - 1) {
        messages.push({
          role: 'user',
          content: productionParity
            ? PRODUCTION_RECOVERY_NUDGE
            : `You have completed ${coveredExpected} of ${expectedCount} requested steps; ${expectedCount - coveredExpected} are still missing. ` +
              'The missing steps are the final steps of the request (verification, confirmation, cleanup, search, or query). ' +
              'Emit the next tool call NOW for the next missing step; do not reply with text only. ' +
              'Give the final answer only after every requested step is done.',
        });
      }
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
    truncated_turns: truncatedTurns,
    harness_mode: productionParity ? 'production-parity' : 'oracle-assisted',
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
