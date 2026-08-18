#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const DynamicToolsSnapshotAdapter = require('../src/renderer/modules/DynamicToolsSnapshotAdapter.js');
const StrictAutomaticEvaluator = require('../src/renderer/modules/benchmark-suites/StrictAutomaticEvaluator.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(REPO_ROOT, 'finetuning', 'qwen3.5-4b', 'data', 'test.jsonl');
const OLLAMA_CHAT_URL = 'http://127.0.0.1:11434/api/chat';

function parseArgs(argv) {
  const options = { model: null, input: DEFAULT_INPUT, output: null, concurrency: 2 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--model') options.model = argv[++index];
    else if (arg === '--input') options.input = path.resolve(argv[++index]);
    else if (arg === '--output') options.output = path.resolve(argv[++index]);
    else if (arg === '--concurrency') options.concurrency = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.model) throw new Error('--model is required');
  if (!options.output) throw new Error('--output is required');
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error('--concurrency must be a positive integer');
  }
  return options;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}

function deepEqual(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function normalizeArguments(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch (_error) {
    return { __invalid_json_arguments: value };
  }
}

function loadRecords(inputPath) {
  return fs
    .readFileSync(inputPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      const record = JSON.parse(line);
      const expectedMessage = record.messages.at(-1);
      if (expectedMessage?.role !== 'assistant' || !Array.isArray(expectedMessage.tool_calls)) {
        throw new Error(`Record ${index + 1} has no assistant tool-call target`);
      }
      return {
        index,
        messages: record.messages.slice(0, -1),
        tools: record.tools.map(tool => ({
          type: tool.type,
          function: { ...tool.function, strict: undefined },
        })),
        expectedCalls: expectedMessage.tool_calls.map(call => ({
          name: call.function.name,
          arguments: normalizeArguments(call.function.arguments),
        })),
        registryTools: record.tools.map(tool => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        })),
        metadata: record.metadata || {},
      };
    });
}

async function evaluateRecord(model, record) {
  const started = Date.now();
  let response;
  let apiError = null;
  try {
    const request = await fetch(OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: record.messages,
        tools: record.tools,
        stream: false,
        think: false,
        keep_alive: '30m',
        options: { temperature: 0, seed: 42, num_ctx: 8192, num_predict: 256 },
      }),
    });
    if (!request.ok) throw new Error(`Ollama ${request.status}: ${await request.text()}`);
    response = await request.json();
  } catch (error) {
    apiError = error.message;
    response = {};
  }

  const actualCalls = (response.message?.tool_calls || []).map(call => ({
    name: call.function?.name || null,
    arguments: normalizeArguments(call.function?.arguments),
  }));
  const expectedCalls = record.expectedCalls;
  const callCountExact = actualCalls.length === expectedCalls.length;
  const toolNamesExact =
    callCountExact && actualCalls.every((call, index) => call.name === expectedCalls[index].name);
  const argumentsExact =
    toolNamesExact && actualCalls.every((call, index) => deepEqual(call.arguments, expectedCalls[index].arguments));
  const adapter = new DynamicToolsSnapshotAdapter({ tools: record.registryTools }, { agentSystemEnabled: false });
  const evaluator = new StrictAutomaticEvaluator({
    assessmentMode: 'contract',
    validateToolCall: (name, parameters) => adapter.validateToolCall(name, parameters),
  });
  const contractEvaluation = evaluator.evaluate(
    {
      type: expectedCalls.length > 1 ? 'workflow' : 'function_call',
      complexity: expectedCalls.length > 1 ? 'complex' : 'simple',
      maxScore: expectedCalls.length > 1 ? 10 : 5,
      expectedResult: expectedCalls.length === 1
        ? { tool_name: expectedCalls[0].name, parameters: expectedCalls[0].arguments }
        : {
            tool_sequence: expectedCalls.map(call => call.name),
            parameters: expectedCalls.map(call => call.arguments),
          },
    },
    {
      actualResult: {
        nativeFunctionCalls: actualCalls.map(call => ({ tool_name: call.name, parameters: call.arguments })),
      },
    }
  );

  return {
    source_example_id: record.metadata.source_example_id || `record-${record.index + 1}`,
    scenario_family_id: record.metadata.scenario_family_id || null,
    expected_calls: expectedCalls,
    actual_calls: actualCalls,
    call_count_exact: callCountExact,
    tool_names_exact: toolNamesExact,
    arguments_exact: argumentsExact,
    exact_success: argumentsExact && !apiError,
    contract_success: contractEvaluation.success && !apiError,
    contract_evaluation: contractEvaluation,
    api_error: apiError,
    duration_ms: Date.now() - started,
    prompt_eval_count: Number(response.prompt_eval_count || 0),
    eval_count: Number(response.eval_count || 0),
  };
}

function ratio(count, total) {
  return total ? count / total : 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputs = loadRecords(options.input);
  const records = new Array(inputs.length);
  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    while (cursor < inputs.length) {
      const index = cursor;
      cursor += 1;
      records[index] = await evaluateRecord(options.model, inputs[index]);
      completed += 1;
      console.log(
        `[${completed}/${inputs.length}] ${records[index].source_example_id}: ` +
          `${records[index].exact_success ? 'PASS' : 'FAIL'} ` +
          `calls=${records[index].actual_calls.map(call => call.name).join(',') || 'none'}`
      );
    }
  };
  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));

  const total = records.length;
  const exact = records.filter(record => record.exact_success).length;
  const contract = records.filter(record => record.contract_success).length;
  const names = records.filter(record => record.tool_names_exact).length;
  const argumentsExact = records.filter(record => record.arguments_exact).length;
  const report = {
    schema_version: '1.0',
    model: options.model,
    scope: { contract_holdout_records: total, benchmark_records: 0, manual_tests_included: 0 },
    assessment_tier: 'native-function-contract',
    deterministic_options: { temperature: 0, seed: 42, stream: false },
    summary: {
      exact_success: exact,
      exact_accuracy: ratio(exact, total),
      contract_success: contract,
      contract_accuracy: ratio(contract, total),
      tool_names_exact: names,
      tool_name_accuracy: ratio(names, total),
      arguments_exact: argumentsExact,
      argument_accuracy: ratio(argumentsExact, total),
      api_errors: records.filter(record => record.api_error).length,
    },
    records,
  };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
