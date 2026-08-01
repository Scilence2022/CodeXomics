#!/usr/bin/env node
'use strict';

/**
 * Replay the released tool-calling dataset through DeepSeek native function
 * calling. This is a contract/data-quality control, not real tool execution.
 *
 * Safety properties:
 *   - reads only release JSONL records and their frozen tool catalog;
 *   - never imports the 143/29 benchmark suites or sends benchmark prompts;
 *   - accepts the API key only through DEEPSEEK_API_KEY; and
 *   - returns only recorded deterministic fixture messages to the model.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const DynamicToolsSnapshotAdapter = require('../src/renderer/modules/DynamicToolsSnapshotAdapter.js');
const StrictAutomaticEvaluator = require('../src/renderer/modules/benchmark-suites/StrictAutomaticEvaluator.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const RELEASE_ROOT = path.join(REPO_ROOT, 'datasets', 'tool-calling-v1', 'release');
const TOOL_CATALOG_PATH = path.join(RELEASE_ROOT, 'tool-catalog.json');
const RELEASE_MANIFEST_PATH = path.join(RELEASE_ROOT, 'manifest.json');
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, 'finetuning', 'qwen3.5-4b', 'metrics');
const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const VALID_SPLITS = ['train', 'dev', 'holdout'];
const TAXONOMY = ['pass', 'wrong_tool', 'args', 'schema', 'no_call', 'api', 'fixture_missing'];
const STRONG_MODEL_THRESHOLDS = Object.freeze({
  single_call: 0.95,
  multi_step: 0.9,
});
const DATASET_SOURCE_BLOCKLIST = /(?:automatic[_-](?:simple|complex)|benchmark[_/-]suites?)/i;
const RUNNER_NAME = 'codexomics-dataset-replay';
const RUNNER_VERSION = '1.0.0';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function canonicalOracleHash(record) {
  return sha256(
    stableStringify({
      acceptable_calls: record.oracle?.acceptable_calls || [],
      terminal_predicates: record.oracle?.terminal_predicates || [],
    })
  );
}

function parseArgs(argv) {
  const options = {
    split: 'dev',
    limit: Infinity,
    concurrency: 2,
    thinking: 'disabled',
    attempts: 1,
    output: null,
    model: 'deepseek-v4-flash',
    requestTimeoutMs: 180000,
    retries: 3,
    baseUrl: process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL,
    promotionCandidatesOnly: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const takeValue = () => {
      const value = argv[++index];
      if (value === undefined || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      return value;
    };
    if (argument === '--split') options.split = takeValue();
    else if (argument === '--limit') options.limit = Number(takeValue());
    else if (argument === '--concurrency') options.concurrency = Number(takeValue());
    else if (argument === '--thinking') options.thinking = takeValue();
    else if (argument === '--attempts') options.attempts = Number(takeValue());
    else if (argument === '--output') options.output = path.resolve(takeValue());
    else if (argument === '--model') options.model = takeValue();
    else if (argument === '--request-timeout-ms') options.requestTimeoutMs = Number(takeValue());
    else if (argument === '--retries') options.retries = Number(takeValue());
    else if (argument === '--promotion-candidates-only') options.promotionCandidatesOnly = true;
    else if (argument === '--all-candidates') options.promotionCandidatesOnly = false;
    else throw new Error(`Unknown argument: ${argument}`);
  }

  if (![...VALID_SPLITS, 'all'].includes(options.split)) {
    throw new Error('--split must be train, dev, holdout, or all');
  }
  if (!['enabled', 'disabled'].includes(options.thinking)) {
    throw new Error('--thinking must be enabled or disabled');
  }
  if (options.limit !== Infinity && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 32) {
    throw new Error('--concurrency must be an integer between 1 and 32');
  }
  if (!Number.isInteger(options.attempts) || options.attempts < 1 || options.attempts > 10) {
    throw new Error('--attempts must be an integer between 1 and 10');
  }
  if (!Number.isInteger(options.requestTimeoutMs) || options.requestTimeoutMs < 1000) {
    throw new Error('--request-timeout-ms must be an integer of at least 1000');
  }
  if (!Number.isInteger(options.retries) || options.retries < 0 || options.retries > 10) {
    throw new Error('--retries must be an integer between 0 and 10');
  }
  if (!/^[A-Za-z0-9._:/-]+$/.test(options.model)) throw new Error('Invalid --model value');

  options.baseUrl = String(options.baseUrl).replace(/\/+$/, '');
  if (!/^https:\/\//i.test(options.baseUrl)) {
    throw new Error('DEEPSEEK_BASE_URL must use HTTPS');
  }
  if (!options.output) {
    const safeModel = options.model.replace(/[^A-Za-z0-9._-]+/g, '_');
    options.output = path.join(
      DEFAULT_OUTPUT_ROOT,
      `${safeModel}-dataset-${options.split}-${options.thinking}.jsonl`
    );
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonLines(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) return [];
  return text.split(/\r?\n/).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON at ${filePath}:${index + 1}: ${error.message}`);
    }
  });
}

function validateReleaseManifest(manifest) {
  if (manifest?.benchmark_scope?.use !== 'leakage_fingerprints_only') {
    throw new Error('Release manifest does not restrict benchmark data to leakage fingerprints');
  }
  if (Number(manifest?.benchmark_scope?.manual_tests_included) !== 0) {
    throw new Error('Release manifest unexpectedly includes manual benchmark tests');
  }
  if (Number(manifest?.release_gates?.leakage_pass_rate) !== 1) {
    throw new Error('Release manifest leakage gate is not 100%');
  }
}

function assertReplaySafe(record) {
  if (!record || typeof record !== 'object') throw new Error('Dataset record is not an object');
  if (record.verification?.leakage_passed !== true) {
    throw new Error(`${record.example_id || '<unknown>'}: leakage verification is missing or failed`);
  }
  const sourceText = `${record.provenance?.source_type || ''} ${record.provenance?.source_ref || ''}`;
  if (DATASET_SOURCE_BLOCKLIST.test(sourceText)) {
    throw new Error(`${record.example_id || '<unknown>'}: benchmark-derived source is forbidden`);
  }
  if (!VALID_SPLITS.includes(record.split)) {
    throw new Error(`${record.example_id || '<unknown>'}: invalid release split`);
  }
}

function loadReleaseRecords(split, limit = Infinity) {
  const manifest = readJson(RELEASE_MANIFEST_PATH);
  validateReleaseManifest(manifest);
  const splits = split === 'all' ? VALID_SPLITS : [split];
  const records = [];
  for (const splitName of splits) {
    const splitPath = path.join(RELEASE_ROOT, `${splitName}.jsonl`);
    for (const record of readJsonLines(splitPath)) {
      assertReplaySafe(record);
      if (record.split !== splitName) {
        throw new Error(`${record.example_id || '<unknown>'}: record split does not match ${splitName}.jsonl`);
      }
      records.push(record);
      if (records.length >= limit) return { manifest, records };
    }
  }
  return { manifest, records };
}

function createCatalogRuntime(catalog = readJson(TOOL_CATALOG_PATH)) {
  if (!catalog || !Array.isArray(catalog.tools)) throw new Error('Invalid release tool catalog');
  const normalizedTools = catalog.tools.map(tool => ({
    name: tool?.function?.name,
    description: tool?.function?.description,
    parameters: tool?.function?.parameters,
  }));
  const adapter = new DynamicToolsSnapshotAdapter(
    { tools: normalizedTools, registryHash: catalog.registry_hash },
    { agentSystemEnabled: false }
  );
  const nativeToolsByName = new Map();
  for (const tool of normalizedTools) {
    const nativeTool = adapter.toNativeFunctionTool(tool);
    if (!nativeTool) continue;
    // DeepSeek accepts OpenAI-compatible native tools. `strict` is intentionally
    // omitted because the dataset's contract is evaluated locally.
    delete nativeTool.function.strict;
    nativeToolsByName.set(nativeTool.function.name, nativeTool);
  }
  const evaluator = new StrictAutomaticEvaluator({
    assessmentMode: 'contract',
    validateToolCall: (name, parameters) => adapter.validateToolCall(name, parameters),
  });
  return { catalog, adapter, evaluator, nativeToolsByName };
}

function normalizeArguments(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : { __invalid_json_arguments: value };
  } catch (_error) {
    return { __invalid_json_arguments: value };
  }
}

function getInitialMessages(record) {
  const messages = [];
  for (const message of record.messages || []) {
    if (message.role === 'assistant' || message.role === 'tool') break;
    if (message.role !== 'system' && message.role !== 'user') continue;
    messages.push({ role: message.role, content: String(message.content || '') });
  }
  if (!messages.some(message => message.role === 'user' && message.content.trim())) {
    throw new Error('fixture_missing: no initial user message');
  }
  return messages;
}

function extractRecordedFixtures(record) {
  const toolMessages = new Map();
  for (const message of record.messages || []) {
    if (message.role === 'tool' && message.tool_call_id) {
      toolMessages.set(message.tool_call_id, message);
    }
  }

  const fixtures = [];
  for (const message of record.messages || []) {
    if (message.role !== 'assistant' || !Array.isArray(message.tool_calls)) continue;
    for (const call of message.tool_calls) {
      const toolMessage = toolMessages.get(call.id);
      fixtures.push({
        expectedCall: {
          tool_name: call?.function?.name,
          parameters: normalizeArguments(call?.function?.arguments),
        },
        content: toolMessage?.content,
        recordedName: toolMessage?.name,
        recordedToolCallId: toolMessage?.tool_call_id,
        source: 'recorded_tool_message',
      });
    }
  }
  return fixtures;
}

function normalizeFixtureOutput(output, index, expectedCall) {
  return {
    call_index: Number.isInteger(output?.call_index) ? output.call_index : index,
    tool_name: output?.tool_name || expectedCall?.tool_name || null,
    result: output?.result ?? output ?? null,
    provenance: output?.provenance || null,
  };
}

function getPinnedFixtures(record, expectedCalls) {
  const pinned = record.verification?.fixture_replay?.fixture_outputs;
  if (!Array.isArray(pinned) || pinned.length === 0) return [];
  return pinned.map((output, index) => {
    const normalized = normalizeFixtureOutput(output, index, expectedCalls[index]);
    return {
      expectedCall: expectedCalls[index],
      content: JSON.stringify(normalized.result),
      recordedName: normalized.tool_name,
      recordedToolCallId: `fixture_${index + 1}`,
      source: 'verification.fixture_replay.fixture_outputs',
      output: normalized,
    };
  });
}

function validateFixtureContent(content, fixtureId, expectedParameters) {
  if (typeof content !== 'string' || !content.trim()) return 'recorded tool content is missing';
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (_error) {
    return 'recorded tool content is not JSON';
  }
  if (parsed?.fixture !== fixtureId) return 'recorded tool content has the wrong fixture id';
  const expectedHash = sha256(stableStringify(expectedParameters || {}));
  if (parsed?.accepted_parameters_hash !== expectedHash) {
    return 'recorded tool content does not match the expected parameter hash';
  }
  return null;
}

function replayPreparationError(taxonomy, message) {
  const error = new Error(message);
  error.replayTaxonomy = taxonomy;
  return error;
}

function prepareReplay(record, runtime) {
  try {
    assertReplaySafe(record);
    const expectedCalls = Array.isArray(record.oracle?.acceptable_calls)
      ? record.oracle.acceptable_calls
      : [];
    const decision = String(record.oracle?.decision || '');
    const expectsCalls = decision === 'call';
    if (expectsCalls !== (expectedCalls.length > 0)) {
      throw new Error('oracle decision and acceptable_calls disagree');
    }
    if (!expectsCalls && !['no_call', 'ask_clarification', 'refuse', 'unavailable_tool'].includes(decision)) {
      throw new Error(`unsupported oracle decision '${decision}'`);
    }
    if (record.tool_catalog?.registry_hash !== runtime.catalog.registry_hash) {
      throw new Error('record and frozen tool catalog registry hashes differ');
    }

    const candidateNames = Array.isArray(record.tool_catalog?.candidate_tool_names)
      ? [...new Set(record.tool_catalog.candidate_tool_names)]
      : [];
    if (candidateNames.length === 0) throw new Error('candidate tool catalog is empty');
    const missingCandidates = candidateNames.filter(name => !runtime.nativeToolsByName.has(name));
    if (missingCandidates.length > 0) {
      throw new Error(`candidate tools missing from frozen catalog: ${missingCandidates.join(', ')}`);
    }
    const missingExpected = expectedCalls.filter(call => !candidateNames.includes(call.tool_name));
    if (missingExpected.length > 0) {
      throw new Error(`expected tools missing from candidate catalog: ${missingExpected.map(call => call.tool_name).join(', ')}`);
    }

    const pinnedFixtures = getPinnedFixtures(record, expectedCalls);
    const messageFixtures = extractRecordedFixtures(record);
    const fixtures = pinnedFixtures.length > 0 ? pinnedFixtures : messageFixtures;
    const completeFixtures =
      fixtures.length === expectedCalls.length && fixtures.every(fixture => typeof fixture.content === 'string');
    const requiresFixtures =
      Array.isArray(record.oracle?.argument_provenance) && record.oracle.argument_provenance.length > 0;
    if (requiresFixtures && !completeFixtures) {
      throw new Error(`dependent/stateful trajectory requires ${expectedCalls.length} pinned fixture outputs`);
    }
    if (fixtures.length > 0 && fixtures.length !== expectedCalls.length) {
      throw new Error(`expected ${expectedCalls.length} fixture slots, found ${fixtures.length}`);
    }
    fixtures.forEach((fixture, index) => {
      const expected = expectedCalls[index];
      if (!fixture.content) return;
      if (!runtime.evaluator.toolMatches(fixture.expectedCall.tool_name, expected.tool_name)) {
        throw new Error(`recorded tool ${index + 1} does not match the oracle`);
      }
      if (!runtime.evaluator.parametersMatch(fixture.expectedCall.parameters, expected.parameters, expected.tool_name)) {
        throw new Error(`recorded arguments ${index + 1} do not match the oracle`);
      }
      const schema = runtime.adapter.validateToolCall(expected.tool_name, expected.parameters || {});
      if (!schema.valid) {
        throw replayPreparationError(
          'schema',
          `oracle call ${index + 1} is schema invalid: ${schema.errors.join('; ')}`
        );
      }
      if (fixture.source === 'recorded_tool_message' && record.schema_version === '1.0') {
        const contentError = validateFixtureContent(
          fixture.content,
          record.environment?.fixture_id,
          fixture.expectedCall.parameters
        );
        if (contentError) throw new Error(`recorded tool ${index + 1}: ${contentError}`);
      } else {
        try {
          JSON.parse(fixture.content);
        } catch (_error) {
          throw new Error(`recorded tool ${index + 1}: fixture output is not JSON`);
        }
      }
    });

    const fixtureOutputs = fixtures
      .filter(fixture => typeof fixture.content === 'string')
      .map((fixture, index) => {
        if (fixture.output) return fixture.output;
        return normalizeFixtureOutput(
          JSON.parse(fixture.content),
          index,
          expectedCalls[index]
        );
      });

    return {
      error: null,
      decision,
      expectedCalls,
      fixtures,
      fixtureOutputs,
      completeFixtures,
      requiresFixtures,
      messages: getInitialMessages(record),
      tools: candidateNames.map(name => runtime.nativeToolsByName.get(name)),
      candidateNames,
    };
  } catch (error) {
    return {
      error: error.message,
      errorTaxonomy: error.replayTaxonomy || 'fixture_missing',
      decision: record.oracle?.decision || null,
      expectedCalls: [],
      fixtures: [],
    };
  }
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function redactSecrets(value) {
  let text = String(value || '');
  const key = process.env.DEEPSEEK_API_KEY;
  if (key) text = text.split(key).join('[REDACTED]');
  return text;
}

async function deepSeekChat(options, messages, tools, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('Global fetch is unavailable');
  const requestBody = {
    model: options.model,
    messages,
    tools,
    tool_choice: 'auto',
    stream: false,
    max_tokens: options.thinking === 'enabled' ? 4096 : 1024,
    thinking: { type: options.thinking },
  };
  if (options.thinking === 'disabled') requestBody.temperature = 0;

  let lastError;
  for (let retry = 0; retry <= options.retries; retry += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);
    try {
      const response = await fetchImpl(`${options.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'content-type': 'application/json',
          'user-agent': 'CodeXomics-dataset-replay/1.0',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      const responseText = await response.text();
      if (!response.ok) {
        const error = new Error(`DeepSeek ${response.status}: ${redactSecrets(responseText).slice(0, 1000)}`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      return JSON.parse(responseText);
    } catch (error) {
      lastError = error.name === 'AbortError' ? new Error('DeepSeek request timed out') : error;
      const retryable = error.retryable !== false;
      if (!retryable || retry === options.retries) throw lastError;
    } finally {
      clearTimeout(timeout);
    }
    await wait(Math.min(1000 * 2 ** retry, 8000));
  }
  throw lastError;
}

function buildEvaluationTest(record) {
  const calls = record.oracle.acceptable_calls;
  const expectedResult = calls.length === 1
    ? { tool_name: calls[0].tool_name, parameters: calls[0].parameters || {} }
    : {
        tool_sequence: calls.map(call => call.tool_name),
        parameters: calls.map(call => call.parameters || {}),
      };
  return {
    id: record.example_id,
    type: calls.length > 1 ? 'workflow' : 'function_call',
    complexity: calls.length > 1 ? 'complex' : 'simple',
    evaluation: 'automatic',
    maxScore: calls.length > 1 ? 10 : 5,
    expectedResult,
  };
}

function assessDecisionResponse(decision, assistantText) {
  const text = String(assistantText || '').trim();
  const normalized = text.toLowerCase();
  const words = normalized.match(/[\p{L}\p{N}]+/gu) || [];
  const englishExecutionClaim =
    /\b(?:i|we|the (?:tool|analysis|operation))\s+(?:have\s+)?(?:ran|executed|completed|performed|finished)\b/i.test(
      text
    ) || /\bcompleted successfully\b/i.test(text);
  const chineseExecutionClaim =
    /(?:我|我们|本工具|该工具|此工具)?\s*(?:已经|已|刚刚)\s*(?:成功地?|顺利地?)?\s*(?:运行|执行|完成|处理|分析|计算|查询|检索|导出|保存|打开|创建|删除)/u.test(text) ||
    /(?:运行|执行|操作|分析|计算|查询|检索|导出|保存|打开|创建|删除|任务|处理)\s*(?:已经|已)?\s*(?:成功|顺利)?\s*(?:完成|结束|完毕)\s*(?:了)?/u.test(text);
  const executionClaim = englishExecutionClaim || chineseExecutionClaim;
  if (!text) return { passed: false, reason: 'empty_response' };
  if (executionClaim) return { passed: false, reason: 'false_execution_claim' };

  if (decision === 'ask_clarification') {
    const asks =
      /[?？]|\b(?:please (?:provide|specify|select)|which|what|where|could you|do you mean|need (?:the|a|an))\b/i.test(
        text
      ) ||
      /(?:请(?:提供|指定|选择|说明|补充|确认)|请问|哪个|哪一个|什么|哪里|何处|是否|能否|你的意思是|需要.{0,8}(?:提供|指定|选择|确认))/u.test(
        text
      );
    const slotCue =
      /\b(?:name|identifier|gene|locus|chromosome|coordinates?|start|end|region|sequence|file|path|format|organism|database|value|option|target)\b/i.test(
        text
      ) ||
      /(?:名称|名字|标识符|编号|基因|位点|染色体|坐标|起点|终点|开始位置|结束位置|区域|区间|序列|文件|路径|格式|物种|生物体|数据库|数值|参数|选项|目标)/u.test(
        text
      );
    return {
      passed: asks && slotCue,
      reason: asks && slotCue ? 'clarification_detected' : 'missing_clarification_or_slot',
    };
  }
  if (decision === 'unavailable_tool') {
    const unavailable =
      /\b(?:not available|unavailable|cannot|can't|do not have|don't have|not supported|unsupported|no\s+[\w -]*tool)\b/i.test(
        text
      ) ||
      /(?:无法|不能|不支持|不可用|尚不具备|暂不具备|缺少|未提供|没有).{0,12}(?:工具|功能|能力|接口|权限)|(?:当前|现有).{0,8}(?:工具|功能|能力).{0,8}(?:无法|不能|不支持|不可用)/u.test(
        text
      );
    return {
      passed: unavailable,
      reason: unavailable ? 'unavailability_disclosed' : 'capability_limit_not_disclosed',
    };
  }
  if (decision === 'refuse') {
    const refusal =
      /\b(?:i (?:cannot|can't|won't|will not|must refuse|am unable to)|unable to (?:help|assist|comply)|cannot (?:help|assist|comply)|not able to (?:help|assist|comply))\b/i.test(
        text
      ) ||
      /(?:我(?:无法|不能|不会)|抱歉.{0,8}(?:无法|不能)|不能(?:协助|帮助|提供|执行)|无法(?:协助|帮助|提供|执行)|拒绝)(?:.{0,16})/u.test(
        text
      );
    return {
      passed: refusal,
      reason: refusal ? 'refusal_disclosed' : 'refusal_not_disclosed',
    };
  }
  if (decision === 'no_call') {
    const substantive = words.length >= 5 || text.replace(/\s/g, '').length >= 20;
    return {
      passed: substantive,
      reason: substantive ? 'substantive_non_tool_response' : 'non_substantive_response',
    };
  }
  return { passed: false, reason: `unsupported_decision_${decision}` };
}

function classifyAttempt({
  prepareError,
  prepareTaxonomy,
  apiError,
  expectedCalls,
  calls,
  evaluation,
  terminationReason,
  decisionAssessment,
}) {
  if (prepareError) return prepareTaxonomy || 'fixture_missing';
  if (apiError) return 'api';
  if (expectedCalls.length === 0) {
    if (calls.length > 0) return 'wrong_tool';
    return decisionAssessment?.passed ? 'pass' : 'no_call';
  }
  if (terminationReason === 'no_call_before_complete' || calls.length === 0) return 'no_call';
  if (terminationReason === 'wrong_tool' || terminationReason === 'unexpected_extra_call') return 'wrong_tool';
  if (terminationReason === 'schema_invalid') return 'schema';
  if (terminationReason === 'argument_mismatch') return 'args';
  if (!evaluation?.details?.exactSequence) return 'wrong_tool';
  if (!evaluation?.details?.schemasExact) return 'schema';
  if (!evaluation?.details?.argumentsExact) return 'args';
  return evaluation.success ? 'pass' : 'wrong_tool';
}

function emptyUsage() {
  return {
    prompt_tokens: 0,
    completion_tokens: 0,
    reasoning_tokens: 0,
    cache_hit_tokens: 0,
    cache_miss_tokens: 0,
  };
}

function addUsage(total, response) {
  const usage = response?.usage || {};
  total.prompt_tokens += Number(usage.prompt_tokens || 0);
  total.completion_tokens += Number(usage.completion_tokens || 0);
  total.reasoning_tokens += Number(usage.completion_tokens_details?.reasoning_tokens || 0);
  total.cache_hit_tokens += Number(usage.prompt_cache_hit_tokens || 0);
  total.cache_miss_tokens += Number(usage.prompt_cache_miss_tokens || 0);
}

function getPathValue(value, pathExpression) {
  const parts = String(pathExpression || '')
    .replace(/^\$\.?/, '')
    .split('.')
    .filter(Boolean);
  let current = value;
  for (const part of parts) {
    if (current == null || !Object.prototype.hasOwnProperty.call(Object(current), part)) {
      return { found: false, value: undefined };
    }
    current = current[part];
  }
  return { found: true, value: current };
}

function resolveFixtureReference(reference, fixtureOutputs) {
  const match = String(reference || '').match(/^call_(\d+)\.(.+)$/);
  if (!match) return { found: false, value: undefined };
  const output = fixtureOutputs[Number(match[1]) - 1];
  if (!output) return { found: false, value: undefined };
  return getPathValue(output, match[2]);
}

function evaluateTerminalPredicates(record, calls, runtime, fixtureOutputs = []) {
  const predicates = Array.isArray(record.oracle?.terminal_predicates)
    ? record.oracle.terminal_predicates
    : [];
  const recordedResults =
    record.verification?.state_replay?.terminal_predicate_results ||
    record.verification?.fixture_replay?.terminal_predicate_results ||
    [];
  return predicates.map((predicate, predicateIndex) => {
    const recorded = Array.isArray(recordedResults)
      ? recordedResults.find(result => result?.predicate_index === predicateIndex)
      : null;
    if (recorded && typeof recorded.passed === 'boolean') {
      return { ...recorded, predicate_index: predicateIndex, source: 'recorded_fixture_verification' };
    }
    if (predicate?.type === 'tool_completed' || predicate?.type === 'call_contract_matched') {
      const passed = calls.some(call => runtime.evaluator.toolMatches(call.tool_name, predicate.tool_name));
      return {
        predicate_index: predicateIndex,
        passed,
        source: 'semantic_call_observation',
        execution_assessed: false,
      };
    }
    if (predicate?.type === 'fixture_call_succeeded') {
      const output = fixtureOutputs.find(item =>
        runtime.evaluator.toolMatches(item?.tool_name, predicate.tool_name)
      );
      const observed = calls.some(call =>
        runtime.evaluator.toolMatches(call.tool_name, predicate.tool_name)
      );
      const fixtureSucceeded = Boolean(output) && output?.result?.success !== false;
      return {
        predicate_index: predicateIndex,
        passed: observed && fixtureSucceeded,
        source: 'semantic_call_observation_and_pinned_fixture_output',
        execution_assessed: false,
      };
    }
    if (predicate?.type === 'result_field_equals') {
      const output = fixtureOutputs[Number(predicate.call_index) - 1];
      const actual = getPathValue(output, predicate.path);
      return {
        predicate_index: predicateIndex,
        passed: actual.found && runtime.evaluator.valuesMatch(actual.value, predicate.value),
        source: 'pinned_fixture_output',
        execution_assessed: false,
      };
    }
    if (predicate?.type === 'argument_from_result') {
      const call = calls[Number(predicate.call_index) - 1];
      const source = resolveFixtureReference(predicate.source, fixtureOutputs);
      const parameter = call
        ? runtime.evaluator.getActualParameter(
            runtime.evaluator.normalizeParameters(call.parameters || {}),
            predicate.parameter,
            runtime.evaluator.normalizeToolName(call.tool_name)
          )
        : { found: false };
      return {
        predicate_index: predicateIndex,
        passed:
          source.found &&
          parameter.found &&
          runtime.evaluator.valuesMatch(parameter.value, source.value),
        source: 'observed_argument_and_pinned_fixture_output',
        execution_assessed: false,
      };
    }
    return {
      predicate_index: predicateIndex,
      passed: false,
      source: 'not_verifiable_in_contract_replay',
      execution_assessed: false,
    };
  });
}

async function replayExample(record, attempt, options, runtime, requestChat = deepSeekChat) {
  const started = Date.now();
  const prepared = prepareReplay(record, runtime);
  const expectedCalls = prepared.expectedCalls || [];
  const calls = [];
  const usage = emptyUsage();
  const modelVersions = new Set();
  const requestSnapshots = [];
  const responseSnapshots = [];
  let assistantText = '';
  let apiError = null;
  let fixtureError = null;
  let terminationReason = prepared.error ? prepared.errorTaxonomy : null;

  if (!prepared.error) {
    const messages = [...prepared.messages];
    try {
      const maximumTurns = Math.max(1, expectedCalls.length + 1);
      for (let turn = 0; turn < maximumTurns; turn += 1) {
        requestSnapshots.push({
          messages: JSON.parse(JSON.stringify(messages)),
          tools: prepared.tools,
          model: options.model,
          thinking: options.thinking,
        });
        const response = await requestChat(options, messages, prepared.tools);
        responseSnapshots.push(response);
        addUsage(usage, response);
        if (response?.model) modelVersions.add(response.model);
        const rawAssistant = response?.choices?.[0]?.message;
        if (!rawAssistant || rawAssistant.role !== 'assistant') {
          throw new Error('DeepSeek response did not contain an assistant message');
        }

        const assistant = { role: 'assistant', content: rawAssistant.content ?? null };
        if (rawAssistant.reasoning_content != null) assistant.reasoning_content = rawAssistant.reasoning_content;
        if (Array.isArray(rawAssistant.tool_calls) && rawAssistant.tool_calls.length > 0) {
          assistant.tool_calls = rawAssistant.tool_calls;
        }
        messages.push(assistant);
        if (typeof rawAssistant.content === 'string') assistantText = rawAssistant.content;

        const responseCalls = assistant.tool_calls || [];
        if (responseCalls.length === 0) {
          if (calls.length < expectedCalls.length) terminationReason = 'no_call_before_complete';
          else terminationReason = 'completed';
          break;
        }

        let shouldStop = false;
        const currentTurnCalls = [];
        for (const toolCall of responseCalls) {
          const actualCall = {
            tool_name: toolCall?.function?.name,
            parameters: normalizeArguments(toolCall?.function?.arguments),
          };
          calls.push(actualCall);
          const expectedIndex = calls.length - 1;
          const expected = expectedCalls[expectedIndex];
          if (!expected) {
            terminationReason = 'unexpected_extra_call';
            shouldStop = true;
            break;
          }

          const toolMatch = runtime.evaluator.toolMatches(actualCall.tool_name, expected.tool_name);
          const validation = runtime.adapter.validateToolCall(actualCall.tool_name, actualCall.parameters);
          const argumentMatch = toolMatch && runtime.evaluator.parametersMatch(
            actualCall.parameters,
            expected.parameters || {},
            actualCall.tool_name
          );
          if (!toolMatch || !validation.valid || !argumentMatch) {
            terminationReason = !toolMatch ? 'wrong_tool' : !validation.valid ? 'schema_invalid' : 'argument_mismatch';
            shouldStop = true;
            break;
          }
          currentTurnCalls.push({ toolCall, actualCall, expectedIndex });
        }
        if (shouldStop) break;
        if (calls.length >= expectedCalls.length) {
          terminationReason = 'completed';
          break;
        }

        for (const { toolCall, actualCall, expectedIndex } of currentTurnCalls) {
          const fixture = prepared.fixtures[expectedIndex];
          if (prepared.requiresFixtures && !fixture?.content) {
            fixtureError = `dependent call ${expectedIndex + 1} is missing a pinned fixture output`;
            terminationReason = 'fixture_missing';
            shouldStop = true;
            break;
          }
          const content = fixture?.content || JSON.stringify({
            acknowledged: true,
            assessment_tier: 'native-function-contract',
            domain_result_available: false,
          });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id || `call_${turn + 1}_${expectedIndex + 1}`,
            name: actualCall.tool_name,
            content,
          });
        }
        if (shouldStop) break;
      }
    } catch (error) {
      apiError = redactSecrets(error.message);
      terminationReason = 'api_error';
    }
  }

  let evaluation = null;
  if (expectedCalls.length > 0 && !prepared.error && !apiError) {
    evaluation = runtime.evaluator.evaluate(buildEvaluationTest(record), {
      actualResult: { nativeFunctionCalls: calls },
      llmInteractionData: {
        request: { dynamicToolsAnalysis: { selectedToolNames: prepared.candidateNames } },
        response: { functionCalls: calls, toolExecutions: [] },
      },
    });
  }
  const decisionAssessment = expectedCalls.length === 0 && !prepared.error && !apiError
    ? assessDecisionResponse(prepared.decision, assistantText)
    : null;
  if (decisionAssessment && !decisionAssessment.passed && calls.length === 0) {
    terminationReason = 'decision_semantic_mismatch';
  }
  const taxonomy = classifyAttempt({
    prepareError: prepared.error || fixtureError,
    prepareTaxonomy: prepared.error ? prepared.errorTaxonomy : fixtureError ? 'fixture_missing' : null,
    apiError,
    expectedCalls,
    calls,
    evaluation,
    terminationReason,
    decisionAssessment,
  });
  const terminalPredicateResults = evaluateTerminalPredicates(
    record,
    calls,
    runtime,
    prepared.fixtureOutputs || []
  );

  return {
    example_id: record.example_id,
    split: record.split,
    attempt,
    decision: prepared.decision,
    category: record.labels?.category || 'unknown',
    difficulty: record.labels?.difficulty || (expectedCalls.length > 1 ? 'multi_step' : 'single_call'),
    stateful: record.labels?.stateful === true,
    prompt_sha256: sha256(
      (prepared.messages || [])
        .map(message => `${message.role}:${message.content}`)
        .join('\n')
    ),
    expected_call_count: expectedCalls.length,
    taxonomy,
    success: taxonomy === 'pass' && terminalPredicateResults.every(item => item.passed === true),
    termination_reason: terminationReason,
    duration_ms: Date.now() - started,
    prepare_error: prepared.error || fixtureError,
    fixture_error: prepared.errorTaxonomy === 'fixture_missing' ? prepared.error : fixtureError,
    api_error: apiError,
    assistant_response: assistantText || null,
    decision_assessment: decisionAssessment,
    model_versions: [...modelVersions],
    request_hash: sha256(stableStringify(requestSnapshots)),
    response_hash: sha256(stableStringify(responseSnapshots)),
    usage,
    calls,
    fixture_outputs: prepared.fixtureOutputs || [],
    terminal_predicate_results: terminalPredicateResults,
    evaluation,
  };
}

function summarizeSubset(records) {
  const taxonomy = Object.fromEntries(TAXONOMY.map(label => [label, 0]));
  for (const record of records) taxonomy[record.taxonomy] = (taxonomy[record.taxonomy] || 0) + 1;
  const passed = records.filter(record => record.success === true).length;
  const terminalPredicateFailures = records.filter(
    record => record.taxonomy === 'pass' && record.success !== true
  ).length;
  const uniqueExamples = new Set(records.map(record => record.example_id)).size;
  return {
    examples: uniqueExamples,
    attempts: records.length,
    passed,
    failed: records.length - passed,
    accuracy: records.length ? passed / records.length : null,
    taxonomy,
    terminal_predicate_failures: terminalPredicateFailures,
    average_duration_ms: records.length
      ? records.reduce((sum, record) => sum + record.duration_ms, 0) / records.length
      : null,
    usage: records.reduce((total, record) => {
      for (const key of Object.keys(total)) total[key] += Number(record.usage?.[key] || 0);
      return total;
    }, emptyUsage()),
  };
}

function buildStrongModelGate(records) {
  const groups = {};
  let hasApiFailure = false;
  let hasFixtureFailure = false;
  let thresholdFailed = false;
  for (const [difficulty, threshold] of Object.entries(STRONG_MODEL_THRESHOLDS)) {
    const subset = records.filter(record => record.difficulty === difficulty);
    const summary = summarizeSubset(subset);
    const apiFailures = summary.taxonomy.api;
    const fixtureFailures = summary.taxonomy.fixture_missing;
    hasApiFailure ||= apiFailures > 0;
    hasFixtureFailure ||= fixtureFailures > 0;
    const passed = summary.attempts > 0 && apiFailures === 0 && fixtureFailures === 0
      ? summary.accuracy >= threshold
      : null;
    if (passed === false) thresholdFailed = true;
    groups[difficulty] = {
      minimum_accuracy: threshold,
      examples: summary.examples,
      attempts: summary.attempts,
      accuracy: summary.accuracy,
      passed,
    };
  }
  let status = thresholdFailed ? 'fail' : 'pass';
  if (hasFixtureFailure) status = 'dataset_invalid';
  else if (hasApiFailure) status = 'inconclusive_api_errors';
  else if (Object.values(groups).some(group => group.attempts === 0)) status = 'incomplete_scope';
  return { status, groups };
}

function replayDisposition(result, expectedCallCount) {
  if (result.taxonomy === 'pass') {
    const terminalFailed = result.terminal_predicate_results.some(item => item.passed !== true);
    return terminalFailed
      ? { status: 'failed', reason_code: 'terminal_predicate_failed', semantic_verdict: 'failed' }
      : { status: 'passed', reason_code: 'passed', semantic_verdict: 'passed' };
  }
  if (result.taxonomy === 'api') {
    return {
      status: 'blocked',
      reason_code: /(?:\b429\b|rate.?limit)/i.test(result.api_error || '') ? 'rate_limited' : 'provider_error',
      semantic_verdict: 'blocked',
    };
  }
  if (result.taxonomy === 'fixture_missing') {
    return { status: 'blocked', reason_code: 'fixture_missing', semantic_verdict: 'blocked' };
  }
  if (result.taxonomy === 'schema') {
    return { status: 'failed', reason_code: 'schema_mismatch', semantic_verdict: 'failed' };
  }
  if (result.taxonomy === 'args') {
    return { status: 'failed', reason_code: 'argument_semantic_mismatch', semantic_verdict: 'failed' };
  }
  if (result.taxonomy === 'no_call' && expectedCallCount === 0) {
    return { status: 'failed', reason_code: 'manual_review_required', semantic_verdict: 'failed' };
  }
  return { status: 'failed', reason_code: 'tool_selection_mismatch', semantic_verdict: 'failed' };
}

function buildSidecarRow(record, attemptResults, options, runtime) {
  if (!Array.isArray(attemptResults) || attemptResults.length === 0) {
    throw new Error(`${record.example_id}: no replay attempts were recorded`);
  }
  const expectedCalls = record.oracle?.acceptable_calls || [];
  const dispositions = attemptResults.map(result => replayDisposition(result, expectedCalls.length));
  const firstFailureIndex = dispositions.findIndex(disposition => disposition.status !== 'passed');
  const representativeIndex = firstFailureIndex === -1 ? 0 : firstFailureIndex;
  const representative = attemptResults[representativeIndex];
  const disposition = dispositions[representativeIndex];
  const generatedAt = new Date().toISOString();

  return {
    example_id: record.example_id,
    registry_hash: record.tool_catalog?.registry_hash || runtime.catalog.registry_hash,
    canonical_oracle_hash: canonicalOracleHash(record),
    canonical_calls: JSON.parse(JSON.stringify(expectedCalls)),
    terminal_predicates: JSON.parse(JSON.stringify(record.oracle?.terminal_predicates || [])),
    status: disposition.status,
    reason_code: disposition.reason_code,
    semantic_verdict: disposition.semantic_verdict,
    model_family: 'deepseek',
    model_id: options.model,
    observed_calls: JSON.parse(JSON.stringify(representative.calls || [])),
    fixture_outputs: JSON.parse(JSON.stringify(representative.fixture_outputs || [])),
    terminal_predicate_results: JSON.parse(
      JSON.stringify(representative.terminal_predicate_results || [])
    ),
    provenance: {
      runner: RUNNER_NAME,
      runner_version: RUNNER_VERSION,
      generated_at: generatedAt,
      request_hash: sha256(stableStringify(attemptResults.map(result => result.request_hash))),
      response_hash: sha256(stableStringify(attemptResults.map(result => result.response_hash))),
      attempts: attemptResults.length,
      selected_attempt: representative.attempt,
      comparison_mode: 'semantic_canonical_equivalence',
      assessment_tier: 'native-function-contract',
      execution_assessed: false,
      resolved_model_ids: [...new Set(attemptResults.flatMap(result => result.model_versions || []))],
      attempt_results: attemptResults.map((result, index) => ({
        attempt: result.attempt,
        taxonomy: result.taxonomy,
        status: dispositions[index].status,
        reason_code: dispositions[index].reason_code,
        request_hash: result.request_hash,
        response_hash: result.response_hash,
      })),
    },
  };
}

function buildReport(options, records, startedAt, completedAt) {
  const byDifficulty = {};
  for (const difficulty of ['single_call', 'multi_step', 'decision']) {
    byDifficulty[difficulty] = summarizeSubset(records.filter(record => record.difficulty === difficulty));
  }
  const bySplit = {};
  for (const split of VALID_SPLITS) {
    const subset = records.filter(record => record.split === split);
    if (subset.length > 0) bySplit[split] = summarizeSubset(subset);
  }
  const byDecision = {};
  for (const decision of ['call', 'no_call', 'ask_clarification', 'refuse', 'unavailable_tool']) {
    const subset = records.filter(record => record.decision === decision);
    if (subset.length > 0) byDecision[decision] = summarizeSubset(subset);
  }
  return {
    summary: {
      schema_version: '1.0',
      assessment_tier: 'native-function-contract',
      scorer: 'StrictAutomaticEvaluator:contract + no-call-contract-v1',
      provider: 'deepseek',
      model: options.model,
      split: options.split,
      attempts_per_example: options.attempts,
      thinking: options.thinking,
      promotion_candidates_only: options.promotionCandidatesOnly,
      started_at: startedAt,
      completed_at: completedAt,
      real_tool_execution: false,
      fixture_mode: 'recorded-deterministic-tool-messages',
      benchmark_prompts_sent: 0,
      API_key_source: 'environment-only',
      overall: summarizeSubset(records),
      by_difficulty: byDifficulty,
      by_split: bySplit,
      by_decision: byDecision,
      strong_model_gate: buildStrongModelGate(records),
    },
    records,
  };
}

function isPromotionCandidate(record) {
  if (record.oracle?.decision !== 'call') return true;
  return (
    record.verification?.fixture_executable === true &&
    record.verification?.fixture_replay?.status === 'passed'
  );
}

async function run(options, dependencies = {}) {
  const loadedRecords = (dependencies.release || loadReleaseRecords(options.split, Infinity)).records;
  const selectedRecords = options.promotionCandidatesOnly
    ? loadedRecords.filter(isPromotionCandidate)
    : loadedRecords;
  const records = selectedRecords.slice(0, options.limit);
  const skippedNotFixtureExecutable = options.promotionCandidatesOnly
    ? loadedRecords.filter(record => !isPromotionCandidate(record)).length
    : 0;
  const runtime = dependencies.runtime || createCatalogRuntime();
  const requestChat = dependencies.requestChat || deepSeekChat;
  const jobs = records.flatMap(record =>
    Array.from({ length: options.attempts }, (_unused, index) => ({ record, attempt: index + 1 }))
  );
  const results = new Array(jobs.length);
  const startedAt = new Date().toISOString();
  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      const job = jobs[index];
      results[index] = await replayExample(job.record, job.attempt, options, runtime, requestChat);
      completed += 1;
      const result = results[index];
      console.log(
        `[${completed}/${jobs.length}] ${result.split}/${result.example_id}#${result.attempt}: ` +
          `${result.taxonomy.toUpperCase()} calls=${result.calls.map(call => call.tool_name).join(',') || 'none'}`
      );
      if (options.output && (completed % 10 === 0 || completed === jobs.length)) {
        const partialRecords = results.filter(Boolean);
        fs.mkdirSync(path.dirname(options.output), { recursive: true });
        fs.writeFileSync(
          `${options.output}.progress.json`,
          JSON.stringify(buildReport(options, partialRecords, startedAt, new Date().toISOString()), null, 2) + '\n'
        );
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(options.concurrency, Math.max(jobs.length, 1)) }, () => worker()));
  const report = buildReport(options, results, startedAt, new Date().toISOString());
  report.summary.selection = {
    input_examples: loadedRecords.length,
    eligible_promotion_candidates: selectedRecords.length,
    replayed_examples: records.length,
    skipped_not_fixture_executable: skippedNotFixtureExecutable,
    limited_out_after_selection: selectedRecords.length - records.length,
  };
  const resultsByExample = new Map();
  for (const result of results) {
    if (!resultsByExample.has(result.example_id)) resultsByExample.set(result.example_id, []);
    resultsByExample.get(result.example_id).push(result);
  }
  const sidecar = records.map(record =>
    buildSidecarRow(record, resultsByExample.get(record.example_id) || [], options, runtime)
  );
  return { ...report, sidecar };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is required; provide it through the environment, never a CLI argument');
  }
  const report = await run(options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, report.sidecar.map(row => JSON.stringify(row)).join('\n') + '\n');
  fs.writeFileSync(
    `${options.output}.summary.json`,
    JSON.stringify({ summary: report.summary, records: report.records }, null, 2) + '\n'
  );
  if (fs.existsSync(`${options.output}.progress.json`)) fs.unlinkSync(`${options.output}.progress.json`);
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.summary.overall.taxonomy.api > 0) process.exitCode = 2;
  else if (report.summary.strong_model_gate.status !== 'pass') process.exitCode = 3;
}

if (require.main === module) {
  main().catch(error => {
    console.error(redactSecrets(error.stack || error.message));
    process.exitCode = 1;
  });
}

module.exports = {
  STRONG_MODEL_THRESHOLDS,
  TAXONOMY,
  assessDecisionResponse,
  assertReplaySafe,
  buildEvaluationTest,
  buildReport,
  buildSidecarRow,
  buildStrongModelGate,
  canonicalOracleHash,
  classifyAttempt,
  createCatalogRuntime,
  deepSeekChat,
  extractRecordedFixtures,
  getPinnedFixtures,
  getInitialMessages,
  loadReleaseRecords,
  isPromotionCandidate,
  normalizeArguments,
  parseArgs,
  prepareReplay,
  replayExample,
  run,
  stableStringify,
  summarizeSubset,
  validateFixtureContent,
  validateReleaseManifest,
};
