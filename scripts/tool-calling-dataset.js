#!/usr/bin/env node
'use strict';
/* eslint-disable no-new-func */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const DynamicToolsSnapshotAdapter = require('../src/renderer/modules/DynamicToolsSnapshotAdapter.js');
const StrictAutomaticEvaluator = require('../src/renderer/modules/benchmark-suites/StrictAutomaticEvaluator.js');
const {
  CORE_TOOL_NAMES: DETERMINISTIC_FIXTURE_TOOL_NAMES,
  FIXTURE_RUNNER_ID: DETERMINISTIC_FIXTURE_RUNNER,
  buildDeterministicFixtureSources,
  executeTool: executeDeterministicFixtureTool,
  supportsFixture: supportsDeterministicFixture,
} = require('./lib/deterministic-fixture-corpus.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DATASET_ROOT = path.join(REPO_ROOT, 'datasets', 'tool-calling-v1');
const RELEASE_ROOT = path.join(DATASET_ROOT, 'release');
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools_registry', 'generated', 'tool-registry-manifest.json');
const GENERATOR_VERSION = '2.0.0';
const CANDIDATE_LIMIT = 24;
const COMPOSED_WORKFLOW_TARGET = 100;
const CANDIDATE_COUNT_CURRICULUM = Object.freeze({
  decision: [8, 12],
  single_call: [8, 8, 12, 12],
  multi_step: [16, 16, 24, 24],
});
const REPLAY_STATUSES = new Set(['not_run', 'passed', 'failed', 'blocked']);
const REPLAY_REASON_CODES = new Set([
  'not_run',
  'passed',
  'schema_mismatch',
  'tool_selection_mismatch',
  'argument_semantic_mismatch',
  'fixture_missing',
  'fixture_resolution_failed',
  'fixture_execution_failed',
  'terminal_predicate_failed',
  'provider_error',
  'rate_limited',
  'manual_review_required',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${path.relative(REPO_ROOT, filePath)}:${index + 1}: ${error.message}`);
      }
    });
}

function writeJsonl(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : ''));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenSet(value) {
  return new Set(normalizeText(value).split(' ').filter(Boolean));
}

function ngramSet(value, size = 5) {
  const normalized = normalizeText(value).replace(/\s+/g, ' ');
  const grams = new Set();
  if (normalized.length < size) {
    if (normalized) grams.add(normalized);
    return grams;
  }
  for (let index = 0; index <= normalized.length - size; index++) grams.add(normalized.slice(index, index + size));
  return grams;
}

function jaccard(left, right) {
  if (left.size === 0 && right.size === 0) return 1;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / Math.max(1, left.size + right.size - intersection);
}

function normalizeToolSignature(calls) {
  return (Array.isArray(calls) ? calls : [])
    .map(call => String(call?.tool_name || call || '').toLowerCase())
    .filter(Boolean)
    .join('>');
}

function loadAutomaticBenchmarks() {
  const basePath = path.join(
    REPO_ROOT,
    'src',
    'renderer',
    'modules',
    'benchmark-suites',
    'BenchmarkEvaluatorBase.js'
  );
  const windowMock = {
    songBenchmarkDebug: { detectedTools: [] },
    benchmarkUI: { getDefaultDirectory: () => './test_data/' },
    chatManager: { toolExecutionTracker: { getSessionExecutions: () => [] } },
  };
  const baseCode = fs.readFileSync(basePath, 'utf8');
  const Base = new Function('window', `${baseCode}; return window.BenchmarkEvaluatorBase;`)(windowMock);
  const loadSuite = (filename, className) => {
    const source = fs.readFileSync(path.join(path.dirname(basePath), filename), 'utf8');
    const Suite = new Function(
      'window',
      'BenchmarkEvaluatorBase',
      `${source}; return window.${className};`
    )(windowMock, Base);
    return new Suite().getTests();
  };
  const tests = [
    ...loadSuite('AutomaticSimpleSuite.js', 'AutomaticSimpleSuite'),
    ...loadSuite('AutomaticComplexSuite.js', 'AutomaticComplexSuite'),
  ];
  if (tests.length !== 172) throw new Error(`Expected 172 automatic benchmark tests, found ${tests.length}`);
  return tests.map(test => ({
    id: test.id,
    normalizedPrompt: normalizeText(test.instruction),
    promptTokens: tokenSet(test.instruction),
    promptNgrams: ngramSet(test.instruction),
    toolSignature: normalizeToolSignature(
      Array.isArray(test.expectedResult?.tool_sequence)
        ? test.expectedResult.tool_sequence.flatMap(tool => (Array.isArray(tool) ? [tool[0]] : [tool]))
        : [{ tool_name: test.expectedResult?.tool_name }]
    ),
  }));
}

function checkLeakage(source, benchmarkFingerprints) {
  const normalizedPrompt = normalizeText(source.user_query);
  const sourceTokens = tokenSet(source.user_query);
  const sourceNgrams = ngramSet(source.user_query);
  const sourceSignature = normalizeToolSignature(source.calls);
  for (const benchmark of benchmarkFingerprints) {
    const sameSignature = Boolean(sourceSignature && sourceSignature === benchmark.toolSignature);
    if (normalizedPrompt && normalizedPrompt === benchmark.normalizedPrompt) {
      return { passed: false, reason: 'exact_prompt_hash' };
    }
    if (sameSignature && source.calls?.length > 1) {
      return { passed: false, reason: 'workflow_graph_signature' };
    }
    if (sameSignature && jaccard(sourceTokens, benchmark.promptTokens) >= 0.78) {
      return { passed: false, reason: 'token_similarity' };
    }
    if (sameSignature && jaccard(sourceNgrams, benchmark.promptNgrams) >= 0.72) {
      return { passed: false, reason: 'ngram_similarity' };
    }
  }
  return { passed: true };
}

function splitForFamily(familyId) {
  const bucket = parseInt(sha256(familyId).slice(0, 8), 16) % 100;
  if (bucket < 85) return 'train';
  if (bucket < 95) return 'dev';
  return 'holdout';
}

function projectedSplitForIsolatedFamily(familyId) {
  const componentId = `atomic-component:v1:${sha256(familyId).slice(0, 24)}`;
  return splitForFamily(componentId);
}

function detectLanguage(value) {
  const text = String(value || '');
  const hasChinese = /[\u3400-\u9fff]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  if (hasChinese && hasLatin) return 'mixed';
  return hasChinese ? 'zh' : 'en';
}

function buildAdapter(manifest) {
  return new DynamicToolsSnapshotAdapter(manifest, { agentSystemEnabled: false });
}

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function resolveCanonicalToolName(toolName, manifest) {
  let resolved = String(toolName || '');
  const visited = new Set();
  while (manifest.aliases?.[resolved] && !visited.has(resolved)) {
    visited.add(resolved);
    resolved = manifest.aliases[resolved];
  }
  return resolved;
}

function inferCanonicalPropertyMap(tool) {
  const schema = tool?.parameters || {};
  const properties = schema.properties || {};
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const aliases = new Map();

  for (const [name, property] of Object.entries(properties)) {
    const description = String(property?.description || '');
    const explicitAlias = description.match(/\balias\s+for\s+['"`]?([A-Za-z_][A-Za-z0-9_]*)/i);
    const explicitPreference = description.match(/\buse\s+['"`]?([A-Za-z_][A-Za-z0-9_]*)['"`]?\s+instead\b/i);
    const target = explicitAlias?.[1] || explicitPreference?.[1];
    if (target && target !== name && Object.prototype.hasOwnProperty.call(properties, target)) {
      aliases.set(name, target);
    }
  }

  const normalizedGroups = new Map();
  for (const name of Object.keys(properties)) {
    const normalized = name.replace(/_/g, '').toLowerCase();
    if (!normalizedGroups.has(normalized)) normalizedGroups.set(normalized, []);
    normalizedGroups.get(normalized).push(name);
  }
  for (const names of normalizedGroups.values()) {
    if (names.length < 2) continue;
    const preferred =
      names.find(name => required.has(name)) ||
      names.find(name => name.includes('_')) ||
      names[0];
    for (const name of names) if (name !== preferred && !aliases.has(name)) aliases.set(name, preferred);
  }
  return aliases;
}

function canonicalizeToolSchema(tool) {
  const schema = deepClone(tool?.parameters || { type: 'object', properties: {}, required: [] });
  schema.type = schema.type || 'object';
  schema.properties = schema.properties || {};
  const aliases = inferCanonicalPropertyMap(tool);
  for (const alias of aliases.keys()) delete schema.properties[alias];
  schema.required = [
    ...new Set((Array.isArray(schema.required) ? schema.required : []).map(name => aliases.get(name) || name)),
  ].filter(name => Object.prototype.hasOwnProperty.call(schema.properties, name));
  const remapRequired = value => {
    if (Array.isArray(value)) {
      value.forEach(remapRequired);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value.required)) {
      value.required = [...new Set(value.required.map(name => aliases.get(name) || name))];
    }
    Object.values(value).forEach(remapRequired);
  };
  for (const keyword of ['oneOf', 'anyOf', 'allOf']) remapRequired(schema[keyword]);
  if (schema.additionalProperties === undefined) schema.additionalProperties = false;
  return schema;
}

function validateCanonicalParameters(adapter, parameters, schema) {
  const compositionKeyword = Array.isArray(schema?.oneOf)
    ? 'oneOf'
    : Array.isArray(schema?.anyOf)
      ? 'anyOf'
      : null;
  const alternatives = compositionKeyword ? schema[compositionKeyword] : null;
  if (!alternatives) return adapter.validateSchemaValue(parameters, schema);
  const baseSchema = deepClone(schema);
  delete baseSchema.oneOf;
  delete baseSchema.anyOf;
  const baseErrors = adapter.validateSchemaValue(parameters, baseSchema);
  const alternativeErrors = alternatives.map(alternative =>
    adapter.validateSchemaValue(parameters, alternative)
  );
  const matchingAlternatives = alternativeErrors.filter(errors => errors.length === 0).length;
  if (compositionKeyword === 'oneOf' && matchingAlternatives !== 1) {
    baseErrors.push(`$ must match exactly one canonical parameter combination (matched ${matchingAlternatives})`);
  } else if (compositionKeyword === 'anyOf' && matchingAlternatives === 0) {
    baseErrors.push('$ does not match any allowed canonical parameter combination');
  }
  return baseErrors;
}

function toCanonicalNativeFunctionTool(tool) {
  if (!tool?.name || !/^[A-Za-z0-9_-]{1,64}$/.test(tool.name)) return null;
  const parameters = canonicalizeToolSchema(tool);
  const propertyNames = Object.keys(parameters.properties || {});
  const requiredNames = new Set(parameters.required || []);
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: String(tool.description || `${tool.name} CodeXomics tool`),
      parameters,
      strict:
        parameters.additionalProperties === false &&
        propertyNames.every(propertyName => requiredNames.has(propertyName)),
    },
  };
}

function canonicalizeToolCall(call, manifest, adapter) {
  const toolName = resolveCanonicalToolName(call?.tool_name || call?.name, manifest);
  const tool = adapter.toolsByName.get(toolName);
  if (!tool) return { valid: false, errors: [`Unknown canonical tool: ${toolName}`] };
  const aliases = inferCanonicalPropertyMap(tool);
  const parameters = {};
  for (const [name, value] of Object.entries(call?.parameters || call?.arguments || {})) {
    const canonicalName = aliases.get(name) || name;
    if (
      Object.prototype.hasOwnProperty.call(parameters, canonicalName) &&
      stableStringify(parameters[canonicalName]) !== stableStringify(value)
    ) {
      return { valid: false, errors: [`Conflicting values for canonical parameter ${canonicalName}`] };
    }
    parameters[canonicalName] = deepClone(value);
  }
  const schema = canonicalizeToolSchema(tool);
  const errors = validateCanonicalParameters(adapter, parameters, schema);
  return {
    valid: errors.length === 0,
    errors,
    call: { tool_name: toolName, parameters },
    schema,
  };
}

const MUTATING_TOOL_VERB = /^(?:add|apply|bulk|capture|clear|close|configure|copy|create|cut|delete|disable|enable|execute|export|import|insert|install|jump|load|navigate|open|pan|paste|pause|remove|replace|resume|run|save|select|set|start|stop|switch|toggle|undo|uninstall|update|zoom)(?:_|$)/;
const READ_ONLY_TOOL_VERB = /^(?:analyze|assess|calculate|check|compute|detect|find|get|list|predict|reverse|search|simulate|translate|validate|virtual)(?:_|$)/;
const MUTATING_CATEGORIES = new Set([
  'sequence_editing',
  'task_management',
  'file_loading',
  'file_operations',
  'plugin_management',
]);

function inferToolCallStatefulness(call, adapter) {
  const tool = adapter.toolsByName.get(call?.tool_name);
  const name = String(call?.tool_name || '');
  const parameters = call?.parameters || {};
  if (name === 'find_gene_by_name') {
    return parameters.navigate_to_gene === false
      ? { stateful: false, basis: 'call_parameter:navigate_to_gene=false' }
      : { stateful: true, basis: 'call_parameter:navigate_to_gene_defaults_true' };
  }
  if (MUTATING_TOOL_VERB.test(name)) return { stateful: true, basis: 'conservative_mutating_verb' };
  if (MUTATING_CATEGORIES.has(tool?.category)) return { stateful: true, basis: 'conservative_mutating_category' };
  if (READ_ONLY_TOOL_VERB.test(name)) return { stateful: false, basis: 'read_only_verb' };
  return { stateful: true, basis: 'unknown_side_effect_quarantine' };
}

function inferSourceStatefulness(source, adapter) {
  if (typeof source.stateful === 'boolean') {
    return { stateful: source.stateful, basis: 'explicit_source_label' };
  }
  const assessments = (source.calls || []).map(call => inferToolCallStatefulness(call, adapter));
  const statefulAssessment = assessments.find(assessment => assessment.stateful);
  return statefulAssessment || { stateful: false, basis: 'no_call_or_read_only' };
}

function sourceFromRegistrySamples(manifest, adapter) {
  const sources = [];
  for (const tool of manifest.tools || []) {
    for (const [index, sample] of (tool.sample_usages || []).entries()) {
      if (!sample?.user_query) continue;
      const parsedCall = adapter.buildCanonicalSampleCall(tool, sample);
      if (!parsedCall) continue;
      const canonical = canonicalizeToolCall(parsedCall, manifest, adapter);
      if (!canonical.valid) continue;
      const call = canonical.call;
      const statefulness = inferToolCallStatefulness(call, adapter);
      sources.push({
        family_id: `registry:${tool.name}:${index}`,
        atomic_source_ids: [`registry:${tool.name}:${index}`],
        user_query: sample.user_query,
        language: detectLanguage(sample.user_query),
        calls: [call],
        stateful: statefulness.stateful,
        statefulness_basis: statefulness.basis,
        category: tool.category || 'uncategorized',
        provenance: {
          source_type: 'tool_registry_sample',
          source_ref: tool.sourceFile || tool.name,
          source_index: index,
          license: 'MIT',
        },
      });
    }
  }
  return sources;
}

function sourceFromRegistryCompositions(registrySources, adapter, targetCount = COMPOSED_WORKFLOW_TARGET) {
  const valid = registrySources
    .filter(source => source.calls?.length === 1)
    .filter(source => adapter.validateToolCall(source.calls[0].tool_name, source.calls[0].parameters || {}).valid)
    .sort((left, right) => sha256(left.family_id).localeCompare(sha256(right.family_id)));
  if (valid.length < 3) return [];

  const compositions = [];
  const widths = [2, 3];
  for (let cursor = 0; compositions.length < targetCount && cursor < valid.length * 20; cursor += 1) {
    const width = widths[cursor % widths.length];
    const offsets = width === 2 ? [0, 37] : [0, 71, 149];
    const anchor = valid[(cursor * 17) % valid.length];
    const anchorSplit = splitForFamily(anchor.atomic_source_ids?.[0] || anchor.family_id);
    const sameSplit = valid.filter(
      source => splitForFamily(source.atomic_source_ids?.[0] || source.family_id) === anchorSplit
    );
    if (sameSplit.length < width) continue;
    const parts = offsets.map(offset => sameSplit[(cursor * 17 + offset) % sameSplit.length]);
    const toolNames = parts.map(part => part.calls[0].tool_name);
    if (new Set(toolNames).size !== toolNames.length) continue;
    const familyMaterial = parts.map(part => part.family_id).join('>');
    const familyId = `composition:v1:${sha256(familyMaterial).slice(0, 24)}`;
    if (compositions.some(source => source.family_id === familyId)) continue;
    const steps = parts.map((part, index) => `Step ${index + 1}: ${part.user_query.replace(/[.。]+$/, '')}.`);
    compositions.push({
      family_id: familyId,
      atomic_source_ids: parts.flatMap(part => part.atomic_source_ids || [part.family_id]),
      user_query: `Complete these independent CodeXomics steps in order. ${steps.join(' ')}`,
      language: detectLanguage(parts.map(part => part.user_query).join(' ')),
      decision: 'call',
      calls: parts.flatMap(part => part.calls),
      category: 'composed_workflow',
      stateful: parts.some(part => part.stateful),
      statefulness_basis: parts.some(part => part.stateful)
        ? 'composition_contains_stateful_atomic_source'
        : 'composition_all_atomic_sources_read_only',
      provenance: {
        source_type: 'deterministic_registry_composition',
        source_ref: parts.map(part => part.provenance.source_ref).join(' + '),
        source_index: cursor,
        license: 'MIT',
      },
    });
  }
  return compositions;
}

function loadCuratedSources() {
  const decisionPath = path.join(DATASET_ROOT, 'sources', 'decision-seeds.jsonl');
  const workflowPath = path.join(DATASET_ROOT, 'sources', 'workflow-seeds.jsonl');
  const coveragePath = path.join(DATASET_ROOT, 'sources', 'coverage-seeds.jsonl');
  return [...readJsonl(decisionPath), ...readJsonl(workflowPath), ...readJsonl(coveragePath)];
}

function normalizeSource(source) {
  const decision = source.decision || (Array.isArray(source.calls) && source.calls.length > 0 ? 'call' : null);
  return {
    ...source,
    family_id: String(source.family_id || '').trim(),
    user_query: String(source.user_query || '').trim(),
    language: source.language || detectLanguage(source.user_query),
    decision,
    calls: Array.isArray(source.calls) ? source.calls : [],
    atomic_source_ids:
      Array.isArray(source.atomic_source_ids) && source.atomic_source_ids.length > 0
        ? [...new Set(source.atomic_source_ids.map(value => String(value)))]
        : [String(source.family_id || '')],
  };
}

function getPathValue(value, pathExpression) {
  const segments = String(pathExpression || '')
    .split('.')
    .filter(Boolean);
  let current = value;
  for (const segment of segments) {
    if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { found: false };
    }
    current = current[segment];
  }
  return { found: true, value: deepClone(current) };
}

function resolveResultReferences(value, fixtureOutputs, parameterPath = '$', provenance = []) {
  if (Array.isArray(value)) {
    const resolved = [];
    for (let index = 0; index < value.length; index += 1) {
      const child = resolveResultReferences(value[index], fixtureOutputs, `${parameterPath}[${index}]`, provenance);
      if (!child.resolved) return child;
      resolved.push(child.value);
    }
    return { resolved: true, value: resolved, provenance };
  }
  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1 && typeof value.$from === 'string') {
      const match = value.$from.match(/^call_(\d+)\.(.+)$/);
      if (!match) return { resolved: false, error: `${parameterPath}: invalid $from reference ${value.$from}` };
      const callIndex = Number(match[1]) - 1;
      if (callIndex < 0 || callIndex >= fixtureOutputs.length) {
        return { resolved: false, error: `${parameterPath}: unavailable fixture call_${callIndex + 1}` };
      }
      const lookup = getPathValue(fixtureOutputs[callIndex], match[2]);
      if (!lookup.found) return { resolved: false, error: `${parameterPath}: missing fixture path ${value.$from}` };
      provenance.push({ parameter_path: parameterPath, source: value.$from });
      return { resolved: true, value: lookup.value, provenance };
    }
    const resolved = {};
    for (const [key, childValue] of Object.entries(value)) {
      const child = resolveResultReferences(childValue, fixtureOutputs, `${parameterPath}.${key}`, provenance);
      if (!child.resolved) return child;
      resolved[key] = child.value;
    }
    return { resolved: true, value: resolved, provenance };
  }
  return { resolved: true, value: deepClone(value), provenance };
}

function normalizeFixtureOutputs(source) {
  return (Array.isArray(source.fixture_outputs) ? source.fixture_outputs : []).map((output, index) => ({
    tool_name: output?.tool_name || source.calls?.[index]?.tool_name || null,
    result: deepClone(output?.result ?? output ?? null),
    provenance: deepClone(output?.provenance || null),
  }));
}

const PINNED_FIXTURE_RUNNER = DETERMINISTIC_FIXTURE_RUNNER;
const PINNED_FIXTURE_DATA = {
  'synthetic-readonly-v1': {
    genes: [
      {
        name: 'synA17',
        locus_tag: 'synA017',
        chromosome: 'fixture_contig_A',
        start: 731,
        end: 760,
        strand: '+',
      },
    ],
    sequences: [
      { chromosome: 'fixture_contig_A', start: 101, end: 112, strand: '+', sequence: 'ATGCCGTTAACG' },
      { chromosome: 'fixture_contig_A', start: 301, end: 315, strand: '+', sequence: 'ATGGCTGAACTGTAA' },
      {
        chromosome: 'fixture_contig_A',
        start: 731,
        end: 760,
        strand: '+',
        sequence: 'ATGGCTGAACTGTTACCGGATCAGTTAACG',
      },
    ],
    annotations: [
      {
        id: 'ann-syn-42',
        type: 'CDS',
        start: 1510,
        end: 1719,
        strand: 1,
        locus_tag: 'synB042',
        gene: 'enzQ',
        product: 'fixture oxidoreductase',
        chromosome: 'fixture_contig_B',
      },
    ],
  },
  'uniprot-pinned-snapshot-v1': {
    entries: [
      {
        accession: 'P0A7E1',
        protein_name: '50S ribosomal protein L35',
        gene_name: 'rpmI',
        organism: 'Escherichia coli',
        reviewed: true,
        protein_sequence: 'MARGKKIGYSGLKSRQANRRFKTR',
      },
    ],
  },
};

function reverseComplementSequence(sequence) {
  const complement = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' };
  return String(sequence)
    .toUpperCase()
    .split('')
    .reverse()
    .map(base => complement[base] || 'N')
    .join('');
}

const PINNED_CODON_TABLE = {
  TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L', TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S',
  TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*', TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W',
  CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L', CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q', CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
  ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M', ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K', AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
  GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V', GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E', GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
};

function translatePinnedDna(sequence, readingFrame = 1) {
  const dna = String(sequence || '').toUpperCase();
  let protein = '';
  for (let index = Math.max(0, Number(readingFrame) - 1); index + 2 < dna.length; index += 3) {
    protein += PINNED_CODON_TABLE[dna.slice(index, index + 3)] || 'X';
  }
  return protein;
}

function executePinnedFixtureTool(fixtureId, call) {
  if (supportsDeterministicFixture(fixtureId)) {
    return executeDeterministicFixtureTool(fixtureId, call);
  }
  const fixture = PINNED_FIXTURE_DATA[fixtureId];
  if (!fixture) throw new Error(`Unsupported pinned fixture: ${fixtureId}`);
  const parameters = call.parameters || {};
  switch (call.tool_name) {
    case 'find_gene_by_name': {
      const query = String(parameters.name || '').toLowerCase();
      const genes = (fixture.genes || []).filter(gene =>
        parameters.exact_match
          ? [gene.name, gene.locus_tag].some(value => value.toLowerCase() === query)
          : [gene.name, gene.locus_tag].some(value => value.toLowerCase().includes(query))
      );
      return { success: true, genes_found: genes.length, genes: deepClone(genes) };
    }
    case 'get_sequence': {
      const record = (fixture.sequences || []).find(
        sequence =>
          sequence.chromosome === parameters.chromosome &&
          sequence.start === parameters.start &&
          sequence.end === parameters.end &&
          sequence.strand === (parameters.strand || '+')
      );
      if (!record) throw new Error(`No pinned sequence for ${stableStringify(parameters)}`);
      return {
        success: true,
        sequence: record.sequence,
        length: record.sequence.length,
        chromosome: record.chromosome,
        start: record.start,
        end: record.end,
        strand: record.strand,
        format: parameters.format || 'raw',
      };
    }
    case 'reverse_complement': {
      const sequence = String(parameters.sequence || '').toUpperCase();
      return {
        success: true,
        original_sequence: sequence,
        reverse_complement: reverseComplementSequence(sequence),
        sequence_length: sequence.length,
        validation_passed: true,
      };
    }
    case 'translate_sequence': {
      const dna = String(parameters.dna || parameters.sequence || '').toUpperCase();
      const readingFrame = parameters.reading_frame || 1;
      return {
        success: true,
        dna,
        reading_frame: readingFrame,
        amino_acid_sequence: translatePinnedDna(dna, readingFrame),
      };
    }
    case 'list_annotations': {
      const annotations = (fixture.annotations || []).filter(annotation => {
        if (parameters.chromosome && annotation.chromosome !== parameters.chromosome) return false;
        if (parameters.start !== undefined && annotation.end < parameters.start) return false;
        if (parameters.end !== undefined && annotation.start > parameters.end) return false;
        if (parameters.type && annotation.type !== parameters.type) return false;
        return true;
      });
      const limited = parameters.limit ? annotations.slice(0, parameters.limit) : annotations;
      return {
        success: true,
        chromosome: parameters.chromosome,
        total: annotations.length,
        count: limited.length,
        annotations: limited.map(({ chromosome: _chromosome, ...annotation }) => deepClone(annotation)),
      };
    }
    case 'get_annotation': {
      const annotation = (fixture.annotations || []).find(
        candidate =>
          [candidate.id, candidate.locus_tag, candidate.gene].includes(parameters.identifier) &&
          (!parameters.chromosome || candidate.chromosome === parameters.chromosome)
      );
      if (!annotation) throw new Error(`No pinned annotation for ${parameters.identifier}`);
      const { chromosome, ...details } = annotation;
      return { success: true, identifier: parameters.identifier, chromosome, annotation: deepClone(details) };
    }
    case 'search_uniprot_database': {
      const query = String(parameters.search_query || '').toLowerCase();
      const entries = (fixture.entries || []).filter(entry => {
        const searchable = `${entry.protein_name} ${entry.gene_name} ${entry.accession}`.toLowerCase();
        return (
          searchable.includes(query) &&
          (!parameters.organism || entry.organism === parameters.organism) &&
          (!parameters.reviewed_only || entry.reviewed)
        );
      });
      const limited = entries.slice(0, parameters.max_results || 100).map(entry => ({
        accession: entry.accession,
        protein_name: entry.protein_name,
        gene_name: entry.gene_name,
        organism: entry.organism,
        reviewed: entry.reviewed,
      }));
      return { success: true, results_count: limited.length, entries: limited };
    }
    case 'get_uniprot_entry': {
      const entry = (fixture.entries || []).find(candidate => candidate.accession === parameters.uniprot_id);
      if (!entry) throw new Error(`No pinned UniProt entry for ${parameters.uniprot_id}`);
      return {
        success: true,
        entry_info: {
          accession: entry.accession,
          protein_name: entry.protein_name,
          gene_name: entry.gene_name,
          organism: entry.organism,
        },
        protein_sequence: entry.protein_sequence,
        sequence_length: entry.protein_sequence.length,
      };
    }
    default:
      throw new Error(`Tool ${call.tool_name} is not supported by ${PINNED_FIXTURE_RUNNER}`);
  }
}

function evaluateFixturePredicates(predicates, calls, outputs) {
  const errors = [];
  for (const [index, predicate] of (predicates || []).entries()) {
    if (predicate.type === 'call_contract_matched') continue;
    if (predicate.type === 'fixture_call_succeeded') {
      const output = outputs.find(item => item.tool_name === predicate.tool_name);
      if (!output || output.result?.success === false) errors.push(`Predicate ${index} fixture call did not succeed`);
      continue;
    }
    if (predicate.type === 'result_field_equals') {
      const output = outputs[Number(predicate.call_index) - 1];
      const actual = getPathValue(output, predicate.path);
      if (!actual.found || stableStringify(actual.value) !== stableStringify(predicate.value)) {
        errors.push(`Predicate ${index} result field mismatch at ${predicate.path}`);
      }
      continue;
    }
    if (predicate.type === 'argument_from_result') {
      const call = calls[Number(predicate.call_index) - 1];
      const actualArgument = call?.parameters?.[predicate.parameter];
      const sourceMatch = String(predicate.source || '').match(/^call_(\d+)\.(.+)$/);
      const source = sourceMatch ? getPathValue(outputs[Number(sourceMatch[1]) - 1], sourceMatch[2]) : { found: false };
      if (!source.found || stableStringify(actualArgument) !== stableStringify(source.value)) {
        errors.push(`Predicate ${index} argument provenance mismatch for ${predicate.parameter}`);
      }
      continue;
    }
    errors.push(`Predicate ${index} has unsupported type ${predicate.type}`);
  }
  return errors;
}

function validateAndResolveCalls(source, manifest, adapter) {
  const declaredFixtureOutputs = normalizeFixtureOutputs(source);
  const fixtureReplayRequested = source.fixture_replay?.status === 'passed';
  const executedFixtureOutputs = [];
  const fixtureOutputs = fixtureReplayRequested ? executedFixtureOutputs : declaredFixtureOutputs;
  const calls = [];
  const argumentProvenance = [];
  if (fixtureReplayRequested) {
    if (source.fixture_replay?.runner !== PINNED_FIXTURE_RUNNER) {
      return {
        valid: false,
        reason: 'fixture_execution_failed',
        errors: [`Unsupported fixture runner: ${source.fixture_replay?.runner || 'missing'}`],
        calls,
        fixtureOutputs,
        argumentProvenance,
      };
    }
    if (
      !source.environment?.fixture_id ||
      (!PINNED_FIXTURE_DATA[source.environment.fixture_id] &&
        !supportsDeterministicFixture(source.environment.fixture_id))
    ) {
      return {
        valid: false,
        reason: 'fixture_execution_failed',
        errors: [`Unsupported fixture id: ${source.environment?.fixture_id || 'missing'}`],
        calls,
        fixtureOutputs,
        argumentProvenance,
      };
    }
    if (declaredFixtureOutputs.length !== source.calls.length) {
      return {
        valid: false,
        reason: 'fixture_execution_failed',
        errors: ['Pinned replay requires one declared expected output per call'],
        calls,
        fixtureOutputs,
        argumentProvenance,
      };
    }
  }
  for (let index = 0; index < source.calls.length; index += 1) {
    const rawCall = source.calls[index];
    const template = rawCall.parameters_template ?? rawCall.parameters ?? {};
    const resolved = resolveResultReferences(template, fixtureOutputs, '$', []);
    if (!resolved.resolved) {
      return {
        valid: false,
        reason: 'fixture_resolution_failed',
        errors: [resolved.error],
        calls,
        fixtureOutputs,
        argumentProvenance,
      };
    }
    for (const item of resolved.provenance) {
      const referencedCall = Number(item.source.match(/^call_(\d+)\./)?.[1]);
      if (!Number.isInteger(referencedCall) || referencedCall > index) {
        return {
          valid: false,
          reason: 'fixture_resolution_failed',
          errors: [`${item.parameter_path}: result references must target an earlier call`],
          calls,
          fixtureOutputs,
          argumentProvenance,
        };
      }
    }
    const canonical = canonicalizeToolCall(
      { tool_name: rawCall.tool_name, parameters: resolved.value },
      manifest,
      adapter
    );
    if (!canonical.valid) {
      return {
        valid: false,
        reason: 'schema_validation_failed',
        errors: canonical.errors.map(error => `${rawCall.tool_name}: ${error}`),
        calls,
        fixtureOutputs,
        argumentProvenance,
      };
    }
    calls.push(canonical.call);
    for (const item of resolved.provenance) argumentProvenance.push({ call_index: index, ...item });
    if (fixtureReplayRequested) {
      let result;
      try {
        result = executePinnedFixtureTool(source.environment.fixture_id, canonical.call);
      } catch (error) {
        return {
          valid: false,
          reason: 'fixture_execution_failed',
          errors: [`call_${index + 1}: ${error.message}`],
          calls,
          fixtureOutputs,
          argumentProvenance,
        };
      }
      const declared = declaredFixtureOutputs[index];
      const declaredToolName = resolveCanonicalToolName(declared?.tool_name, manifest);
      if (
        declaredToolName !== canonical.call.tool_name ||
        stableStringify(declared?.result) !== stableStringify(result)
      ) {
        return {
          valid: false,
          reason: 'fixture_execution_failed',
          errors: [`call_${index + 1}: deterministic fixture output differs from the declared expected output`],
          calls,
          fixtureOutputs,
          argumentProvenance,
        };
      }
      const returnSchema = adapter.toolsByName.get(canonical.call.tool_name)?.returns;
      const resultErrors =
        returnSchema?.type || returnSchema?.properties
          ? adapter.validateSchemaValue(result, returnSchema, `$fixture[${index}].result`)
          : [];
      if (resultErrors.length > 0) {
        return {
          valid: false,
          reason: 'fixture_execution_failed',
          errors: resultErrors,
          calls,
          fixtureOutputs,
          argumentProvenance,
        };
      }
      executedFixtureOutputs.push({
        tool_name: canonical.call.tool_name,
        result,
        provenance: {
          fixture_id: source.environment.fixture_id,
          source: 'deterministic_fixture_runner',
          runner: PINNED_FIXTURE_RUNNER,
          result_hash: sha256(stableStringify(result)),
        },
      });
    }
  }
  const containsReferences = argumentProvenance.length > 0;
  const fixtureReplayPassed = fixtureReplayRequested;
  if (containsReferences && !fixtureReplayPassed) {
    return {
      valid: false,
      reason: 'fixture_required_for_result_reference',
      errors: ['Result-referenced parameters require a passed fixture replay'],
      calls,
      fixtureOutputs,
      argumentProvenance,
    };
  }
  if (fixtureReplayPassed) {
    const predicateErrors = evaluateFixturePredicates(source.terminal_predicates || [], calls, fixtureOutputs);
    if (predicateErrors.length > 0) {
      return {
        valid: false,
        reason: 'terminal_predicate_failed',
        errors: predicateErrors,
        calls,
        fixtureOutputs,
        argumentProvenance,
      };
    }
  }
  return { valid: true, errors: [], calls, fixtureOutputs, argumentProvenance, fixtureReplayPassed };
}

function splitAssignmentForSources(sources) {
  const parent = new Map();
  const find = value => {
    if (!parent.has(value)) parent.set(value, value);
    if (parent.get(value) !== value) parent.set(value, find(parent.get(value)));
    return parent.get(value);
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const [first, second] = [leftRoot, rightRoot].sort();
    parent.set(second, first);
  };
  for (const source of sources) {
    const atomicIds = source.atomic_source_ids?.length ? source.atomic_source_ids : [source.family_id];
    atomicIds.forEach(find);
    for (let index = 1; index < atomicIds.length; index += 1) union(atomicIds[0], atomicIds[index]);
  }
  const canonicalPayloadRepresentatives = new Map();
  for (const source of sources) {
    if (!source.split_canonical_call_signature) continue;
    const atomicId = source.atomic_source_ids?.[0] || source.family_id;
    const representative = canonicalPayloadRepresentatives.get(source.split_canonical_call_signature);
    if (representative) union(representative, atomicId);
    else canonicalPayloadRepresentatives.set(source.split_canonical_call_signature, atomicId);
  }
  const templateFamilyRepresentatives = new Map();
  for (const source of sources) {
    if (!source.split_template_family_signature) continue;
    const atomicId = source.atomic_source_ids?.[0] || source.family_id;
    const representative = templateFamilyRepresentatives.get(source.split_template_family_signature);
    if (representative) union(representative, atomicId);
    else templateFamilyRepresentatives.set(source.split_template_family_signature, atomicId);
  }
  const members = new Map();
  for (const atomicId of parent.keys()) {
    const root = find(atomicId);
    if (!members.has(root)) members.set(root, []);
    members.get(root).push(atomicId);
  }
  const componentByAtomicId = new Map();
  for (const componentMembers of members.values()) {
    const sorted = componentMembers.sort();
    const componentId = `atomic-component:v1:${sha256(sorted.join('\n')).slice(0, 24)}`;
    const split = splitForFamily(componentId);
    for (const atomicId of sorted) componentByAtomicId.set(atomicId, { componentId, split });
  }
  return source => {
    const atomicId = source.atomic_source_ids?.[0] || source.family_id;
    return componentByAtomicId.get(atomicId) || {
      componentId: `atomic-component:v1:${sha256(atomicId).slice(0, 24)}`,
      split: splitForFamily(atomicId),
    };
  };
}

function toolSemanticText(tool) {
  const properties = tool?.parameters?.properties || {};
  return `${tool?.name || ''} ${tool?.category || ''} ${tool?.description || ''} ${Object.entries(properties)
    .map(([name, property]) => `${name} ${property?.description || ''}`)
    .join(' ')}`;
}

function deterministicCandidateTarget(exampleKey, difficulty = 'single_call') {
  const buckets = CANDIDATE_COUNT_CURRICULUM[difficulty] || CANDIDATE_COUNT_CURRICULUM.single_call;
  const bucket = parseInt(sha256(exampleKey).slice(0, 8), 16) % buckets.length;
  return buckets[bucket];
}

function materializeCandidates(source, calls, adapter) {
  const goldNames = [...new Set(calls.map(call => call.tool_name))];
  const retrieved = adapter.selectRelevantTools(source.user_query, {}, CANDIDATE_LIMIT).map(tool => tool.name);
  const retrievalAugmented = goldNames.some(name => !retrieved.includes(name));
  const difficulty = calls.length > 1 ? 'multi_step' : calls.length === 1 ? 'single_call' : 'decision';
  const targetCount = Math.max(
    goldNames.length,
    deterministicCandidateTarget(`${source.family_id}\n${source.user_query}`, difficulty)
  );
  const goldTools = goldNames.map(name => adapter.toolsByName.get(name)).filter(Boolean);
  const goldTokens = tokenSet(goldTools.map(toolSemanticText).join(' '));
  const rankedFillers = adapter.snapshot.tools
    .filter(tool => tool?.name && !goldNames.includes(tool.name))
    .map(tool => {
      const sameCategory = goldTools.some(gold => gold.category && gold.category === tool.category) ? 2 : 0;
      const semanticOverlap = jaccard(goldTokens, tokenSet(toolSemanticText(tool)));
      const retrievedRank = retrieved.indexOf(tool.name);
      const retrievalScore = retrievedRank === -1 ? 0 : 1.5 - retrievedRank / Math.max(1, CANDIDATE_LIMIT);
      return { name: tool.name, score: sameCategory + semanticOverlap * 4 + retrievalScore };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        sha256(`${source.family_id}:${left.name}`).localeCompare(sha256(`${source.family_id}:${right.name}`))
    );
  const selected = [...goldNames];
  for (const name of retrieved) {
    if (selected.length >= targetCount) break;
    if (!selected.includes(name)) selected.push(name);
  }
  for (const item of rankedFillers) {
    if (selected.length >= targetCount) break;
    if (!selected.includes(item.name)) selected.push(item.name);
  }
  const randomized = selected
    .slice(0, CANDIDATE_LIMIT)
    .sort((left, right) =>
      sha256(`${source.family_id}\nposition\n${left}`).localeCompare(
        sha256(`${source.family_id}\nposition\n${right}`)
      )
    );
  return { candidateToolNames: randomized, retrievalAugmented };
}

function toolCallMessage(call, callIndex) {
  return {
    role: 'assistant',
    content: null,
    tool_calls: [
      {
        id: `call_${callIndex + 1}`,
        type: 'function',
        function: { name: call.tool_name, arguments: JSON.stringify(call.parameters || {}) },
      },
    ],
  };
}

function toolCallsMessage(calls) {
  return {
    role: 'assistant',
    content: null,
    tool_calls: calls.map((call, index) => toolCallMessage(call, index).tool_calls[0]),
  };
}

function buildMessages(source, calls, fixtureOutputs, fixtureReplayPassed) {
  const messages = [
    {
      role: 'system',
      content:
        'Use only the supplied CodeXomics tools. Ground every argument in the request or tool results. Ask for missing required information instead of inventing it.',
    },
    { role: 'user', content: source.user_query },
  ];
  if (source.decision !== 'call') {
    messages.push({ role: 'assistant', content: source.assistant_text || '' });
    return messages;
  }
  if (fixtureReplayPassed && fixtureOutputs.length === calls.length) {
    calls.forEach((call, index) => {
      messages.push(toolCallMessage(call, index));
      messages.push({
        role: 'tool',
        tool_call_id: `call_${index + 1}`,
        name: call.tool_name,
        content: JSON.stringify(fixtureOutputs[index].result),
      });
    });
  } else {
    messages.push(toolCallsMessage(calls));
  }
  return messages;
}

function buildExample(source, manifest, adapter, benchmarkFingerprints, getSplitAssignment) {
  if (!source.family_id || !source.user_query || !source.decision) {
    return { accepted: false, reason: 'missing_source_fields' };
  }
  if (
    source.provenance?.source_type === 'external_verified_candidate' &&
    !String(source.provenance?.license || '').trim()
  ) {
    return { accepted: false, reason: 'missing_source_license' };
  }
  if (source.state_replay?.status === 'passed') {
    return {
      accepted: false,
      reason: 'untrusted_state_replay',
      errors: ['State verification cannot be promoted from source-declared booleans'],
    };
  }
  const leakage = checkLeakage(source, benchmarkFingerprints);
  if (!leakage.passed) return { accepted: false, reason: leakage.reason };
  const resolved = validateAndResolveCalls(source, manifest, adapter);
  if (!resolved.valid) return { accepted: false, reason: resolved.reason, errors: resolved.errors };
  const canonicalSource = { ...source, calls: resolved.calls };
  const canonicalLeakage = checkLeakage(canonicalSource, benchmarkFingerprints);
  if (!canonicalLeakage.passed) return { accepted: false, reason: canonicalLeakage.reason };
  const { candidateToolNames, retrievalAugmented } = materializeCandidates(source, resolved.calls, adapter);
  const nativeTools = candidateToolNames
    .map(name => toCanonicalNativeFunctionTool(adapter.toolsByName.get(name)))
    .filter(Boolean);
  const catalogHash = sha256(stableStringify(nativeTools));
  const splitAssignment = getSplitAssignment(source);
  const split = splitAssignment.split;
  const exampleId = `cx-${sha256(`${source.family_id}\n${source.user_query}`).slice(0, 20)}`;
  const terminalPredicates = Array.isArray(source.terminal_predicates)
    ? deepClone(source.terminal_predicates)
    : resolved.calls.map(call => ({
        type: resolved.fixtureReplayPassed ? 'fixture_call_succeeded' : 'call_contract_matched',
        tool_name: call.tool_name,
      }));
  const fixtureReplayStatus = source.fixture_replay?.status || 'not_run';
  const fixtureReplayReason = source.fixture_replay?.reason_code || (fixtureReplayStatus === 'passed' ? 'passed' : 'not_run');
  const fixtureExecutable = fixtureReplayStatus === 'passed';
  const stateReplayStatus = source.state_replay?.status || 'not_run';
  const stateVerified = false;
  const validationTier = stateVerified ? 'state_verified' : fixtureExecutable ? 'fixture_executable' : 'schema_valid';
  const strongReplayStatus = source.strong_model_replay?.status || 'not_run';
  const strongReplayReason =
    source.strong_model_replay?.reason_code || (strongReplayStatus === 'passed' ? 'passed' : 'not_run');
  const example = {
    schema_version: '2.0',
    example_id: exampleId,
    scenario_family_id: source.family_id,
    split_group_id: splitAssignment.componentId,
    split,
    language: source.language,
    provenance: {
      source_type: source.provenance?.source_type || 'expert_curated_seed',
      source_ref: source.provenance?.source_ref || 'datasets/tool-calling-v1/sources',
      source_index: source.provenance?.source_index ?? null,
      license: source.provenance?.license || 'MIT',
      generator_version: GENERATOR_VERSION,
      template_family: source.provenance?.generator_template || null,
      prompt_template_fingerprint: source.provenance?.prompt_template_fingerprint || null,
    },
    environment: {
      fixture_id: source.environment?.fixture_id || null,
      initial_state_hash:
        source.environment?.initial_state_hash ||
        sha256(stableStringify(source.environment || { fixture_id: 'codexomics-empty-state-v1' })),
      external_snapshot: source.environment?.external_snapshot || null,
    },
    tool_catalog: {
      registry_hash: manifest.registryHash,
      candidate_tool_names: candidateToolNames,
      catalog_hash: catalogHash,
    },
    messages: buildMessages(source, resolved.calls, resolved.fixtureOutputs, fixtureExecutable),
    oracle: {
      decision: source.decision,
      acceptable_calls: resolved.calls.map(call => ({
        tool_name: call.tool_name,
        parameters: call.parameters || {},
      })),
      acceptable_variants: expandAcceptableVariants(
        resolved.calls.map(call => ({
          tool_name: call.tool_name,
          parameters: call.parameters || {},
        }))
      ),
      argument_provenance: resolved.argumentProvenance,
      terminal_predicates: terminalPredicates,
    },
    labels: {
      category: source.category || 'uncategorized',
      difficulty: source.calls.length > 1 ? 'multi_step' : source.decision === 'call' ? 'single_call' : 'decision',
      stateful: source.stateful === true,
      statefulness_basis: source.statefulness_basis || 'unknown_side_effect_quarantine',
      state_verification_quarantine:
        source.stateful === true && !stateVerified,
      retrieval_augmented: retrievalAugmented,
    },
    verification: {
      schema_valid: true,
      fixture_executable: fixtureExecutable,
      state_verified: stateVerified,
      validation_tier: validationTier,
      fixture_replay: {
        status: fixtureReplayStatus,
        reason_code: fixtureReplayReason,
        runner: source.fixture_replay?.runner || null,
        fixture_outputs: resolved.fixtureOutputs,
      },
      state_replay: {
        status: stateReplayStatus,
        reason_code:
          source.state_replay?.reason_code || (stateReplayStatus === 'passed' ? 'passed' : 'not_run'),
        runner: source.state_replay?.runner || null,
      },
      leakage_passed: true,
      benchmark_scope_hash: sha256(benchmarkFingerprints.map(item => item.normalizedPrompt).sort().join('\n')),
    },
    strong_model_replay: {
      registry_hash: manifest.registryHash,
      status: strongReplayStatus,
      reason_code: strongReplayReason,
      model_family: source.strong_model_replay?.model_family || null,
      model_id: source.strong_model_replay?.model_id || null,
      comparison_mode: 'completion_equivalence_v1',
      semantic_verdict: source.strong_model_replay?.semantic_verdict || 'not_run',
      canonical_calls: deepClone(resolved.calls),
      observed_calls: deepClone(source.strong_model_replay?.observed_calls || []),
      fixture_outputs: deepClone(resolved.fixtureOutputs),
      terminal_predicates: deepClone(terminalPredicates),
      provenance: deepClone(
        source.strong_model_replay?.provenance || {
          source: 'dataset_builder',
          generated_at: null,
          request_hash: null,
          response_hash: null,
        }
      ),
    },
  };
  example.strong_model_replay.canonical_oracle_hash = canonicalOracleHash(example);
  example.strong_model_replay.canonicalized_observed_calls = [];
  example.strong_model_replay.observed_call_errors = [];
  example.strong_model_replay.semantic_argument_comparisons = [];
  example.strong_model_replay.builder_semantic_verified = false;
  example.strong_model_replay.terminal_predicate_results = [];
  return { accepted: true, example };
}

function alternativeScalar(value, schema) {
  if (Array.isArray(schema?.enum)) {
    const alternative = schema.enum.find(candidate => !Object.is(candidate, value));
    if (alternative !== undefined) return deepClone(alternative);
  }
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') {
    const minimum = Number.isFinite(schema?.minimum) ? schema.minimum : null;
    const maximum = Number.isFinite(schema?.maximum) ? schema.maximum : null;
    const candidates = [value + 1, value - 1, minimum, maximum].filter(
      candidate =>
        Number.isFinite(candidate) &&
        candidate !== value &&
        (minimum === null || candidate >= minimum) &&
        (maximum === null || candidate <= maximum) &&
        (schema?.type !== 'integer' || Number.isInteger(candidate))
    );
    if (candidates.length > 0) return candidates[0];
  }
  if (typeof value === 'string') {
    const examples = Array.isArray(schema?.examples) ? schema.examples : [];
    const alternative = examples.find(candidate => typeof candidate === 'string' && candidate !== value);
    if (alternative !== undefined) return alternative;
    const candidates = [`${value}_alternative`, value.length > 1 ? value.slice(0, -1) : `${value}2`];
    for (const candidate of candidates) {
      if (Number.isFinite(schema?.minLength) && candidate.length < schema.minLength) continue;
      if (Number.isFinite(schema?.maxLength) && candidate.length > schema.maxLength) continue;
      if (schema?.pattern) {
        try {
          if (!new RegExp(schema.pattern).test(candidate)) continue;
        } catch (error) {
          continue;
        }
      }
      return candidate;
    }
  }
  return undefined;
}

function collectSemanticParameterMutations(parameters, schema) {
  const mutations = [];
  const properties = schema?.properties || {};
  for (const [name, value] of Object.entries(parameters || {})) {
    const propertySchema = properties[name] || {};
    const scalar = alternativeScalar(value, propertySchema);
    if (scalar !== undefined) mutations.push({ ...deepClone(parameters), [name]: scalar });
    if (Array.isArray(value) && value.length > Math.max(0, propertySchema.minItems || 0)) {
      mutations.push({ ...deepClone(parameters), [name]: value.slice(0, -1) });
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const nested of collectSemanticParameterMutations(value, propertySchema)) {
        mutations.push({ ...deepClone(parameters), [name]: nested });
      }
    }
  }
  return mutations;
}

function valueForSchema(schema, seed) {
  if (schema?.default !== undefined) return deepClone(schema.default);
  if (Array.isArray(schema?.examples) && schema.examples.length > 0) return deepClone(schema.examples[0]);
  if (Array.isArray(schema?.enum) && schema.enum.length > 0) return deepClone(schema.enum[0]);
  if (schema?.type === 'boolean') return false;
  if (schema?.type === 'integer' || schema?.type === 'number') return schema.minimum ?? 1;
  if (schema?.type === 'array') {
    const count = Math.max(1, schema.minItems || 0);
    return Array.from({ length: count }, (_unused, index) => valueForSchema(schema.items || {}, `${seed}-${index}`));
  }
  if (schema?.type === 'object' || schema?.properties) {
    return Object.fromEntries(
      (schema.required || []).map(name => [name, valueForSchema(schema.properties?.[name] || {}, `${seed}-${name}`)])
    );
  }
  return `fixture_${sha256(seed).slice(0, 8)}`;
}

function isExampleTrainingEligible(example) {
  if (example.verification?.schema_valid !== true) return false;
  if (!['passed', 'failed'].includes(example.strong_model_replay?.status)) return false;
  // The builder's completion-equivalence recomputation is authoritative: a
  // replay the submitter marked "failed" because of an extra read-only call or
  // a documented equivalent tool is promoted when the observed plan covers the
  // oracle. This is what lets valid multi-step plans through the gate.
  if (example.strong_model_replay?.builder_semantic_verified !== true) return false;
  if (!['semantic_canonical_equivalence', 'completion_equivalence_v1'].includes(
    example.strong_model_replay?.comparison_mode
  )) {
    return false;
  }
  if (example.oracle?.decision === 'call' && example.verification?.fixture_executable !== true) return false;
  if (example.labels?.stateful && example.verification?.state_verified !== true) return false;
  if ((example.oracle?.argument_provenance || []).length > 0 && example.verification?.fixture_executable !== true) {
    return false;
  }
  return true;
}

function mutateCall(example, adapter) {
  const call = example.oracle.acceptable_calls[0];
  if (!call) return null;
  const tool = adapter.toolsByName.get(call.tool_name);
  const canonicalSchema = canonicalizeToolSchema(tool);
  let rejectedCall = null;
  let errorType = 'semantic_argument_mismatch';
  const mutations = collectSemanticParameterMutations(call.parameters || {}, canonicalSchema).sort((left, right) =>
    sha256(`${example.example_id}:${stableStringify(left)}`).localeCompare(
      sha256(`${example.example_id}:${stableStringify(right)}`)
    )
  );
  for (const parameters of mutations) {
    const errors = validateCanonicalParameters(adapter, parameters, canonicalSchema);
    if (errors.length === 0 && stableStringify(parameters) !== stableStringify(call.parameters || {})) {
      rejectedCall = { tool_name: call.tool_name, parameters };
      break;
    }
  }
  if (!rejectedCall) {
    for (const wrongName of example.tool_catalog.candidate_tool_names) {
      if (wrongName === call.tool_name) continue;
      const wrongTool = adapter.toolsByName.get(wrongName);
      const wrongSchema = canonicalizeToolSchema(wrongTool);
      const parameters = Object.fromEntries(
        (wrongSchema.required || []).map(name => [
          name,
          valueForSchema(wrongSchema.properties?.[name] || {}, `${example.example_id}:${wrongName}:${name}`),
        ])
      );
      if (validateCanonicalParameters(adapter, parameters, wrongSchema).length === 0) {
        errorType = 'wrong_tool';
        rejectedCall = { tool_name: wrongName, parameters };
        break;
      }
    }
  }
  if (!rejectedCall) return null;
  const rejectedTool = adapter.toolsByName.get(rejectedCall.tool_name);
  const rejectedErrors = validateCanonicalParameters(
    adapter,
    rejectedCall.parameters,
    canonicalizeToolSchema(rejectedTool)
  );
  return {
    schema_version: '2.0',
    preference_id: `pref-${sha256(example.example_id).slice(0, 20)}`,
    scenario_family_id: example.scenario_family_id,
    split: example.split === 'holdout' ? 'dev' : example.split,
    prompt: example.messages.slice(0, 2),
    chosen: toolCallMessage(call, 0),
    rejected: toolCallMessage(rejectedCall, 0),
    rejected_error_type: errorType,
    verification: {
      chosen_schema_valid: true,
      rejected_schema_valid: rejectedErrors.length === 0,
      rejected_errors: rejectedErrors,
      semantic_mismatch:
        rejectedCall.tool_name !== call.tool_name ||
        stableStringify(rejectedCall.parameters) !== stableStringify(call.parameters),
      fixture_executable: false,
      state_verified: false,
      source_validation_tier: example.verification?.validation_tier || 'schema_valid',
      source_strong_replay_status: example.strong_model_replay?.status || 'not_run',
      semantic_negative_replay_status: 'not_run',
      training_eligible: false,
    },
  };
}

function validateExample(example, adapter, benchmarkFingerprints) {
  const errors = [];
  const required = [
    'schema_version',
    'example_id',
    'scenario_family_id',
    'split_group_id',
    'split',
    'language',
    'provenance',
    'environment',
    'tool_catalog',
    'messages',
    'oracle',
    'labels',
    'verification',
    'strong_model_replay',
  ];
  for (const key of required) if (!Object.prototype.hasOwnProperty.call(example, key)) errors.push(`Missing ${key}`);
  if (!['train', 'dev', 'holdout'].includes(example.split)) errors.push('Invalid split');
  if (!String(example.split_group_id || '').startsWith('atomic-component:v1:')) {
    errors.push('Split group must identify an atomic-source connected component');
  }
  const source = {
    user_query: example.messages?.find(message => message.role === 'user')?.content,
    calls: example.oracle?.acceptable_calls || [],
  };
  const leakage = checkLeakage(source, benchmarkFingerprints);
  if (!leakage.passed) errors.push(`Leakage check failed: ${leakage.reason}`);
  for (const call of example.oracle?.acceptable_calls || []) {
    const tool = adapter.toolsByName.get(call.tool_name);
    const validationErrors = tool
      ? validateCanonicalParameters(adapter, call.parameters || {}, canonicalizeToolSchema(tool))
      : [`Unknown canonical tool: ${call.tool_name}`];
    if (validationErrors.length > 0) errors.push(`${call.tool_name}: ${validationErrors.join('; ')}`);
    if (!example.tool_catalog?.candidate_tool_names?.includes(call.tool_name)) {
      errors.push(`Gold tool missing from candidate catalog: ${call.tool_name}`);
    }
  }
  const candidateNames = example.tool_catalog?.candidate_tool_names || [];
  if (candidateNames.length > CANDIDATE_LIMIT) errors.push(`Candidate catalog exceeds ${CANDIDATE_LIMIT}`);
  if (new Set(candidateNames).size !== candidateNames.length) errors.push('Candidate catalog contains duplicates');
  if (example.tool_catalog?.registry_hash !== adapter.snapshot.registryHash) {
    errors.push('Example registry hash does not match the frozen production registry');
  }
  const materializedCatalog = candidateNames
    .map(name => toCanonicalNativeFunctionTool(adapter.toolsByName.get(name)))
    .filter(Boolean);
  if (sha256(stableStringify(materializedCatalog)) !== example.tool_catalog?.catalog_hash) {
    errors.push('Example candidate catalog hash is stale or incomplete');
  }
  const difficulty = example.oracle?.acceptable_calls?.length > 1
    ? 'multi_step'
    : example.oracle?.acceptable_calls?.length === 1
      ? 'single_call'
      : 'decision';
  if (!CANDIDATE_COUNT_CURRICULUM[difficulty].includes(candidateNames.length)) {
    errors.push(`Candidate count ${candidateNames.length} is outside the ${difficulty} curriculum`);
  }
  const verification = example.verification || {};
  if (!verification.schema_valid || !verification.leakage_passed) {
    errors.push('Release examples must be schema-valid and leakage-cleared');
  }
  const expectedTier = verification.state_verified
    ? 'state_verified'
    : verification.fixture_executable
      ? 'fixture_executable'
      : 'schema_valid';
  if (verification.validation_tier !== expectedTier) errors.push('Validation tier does not match replay evidence');
  if (verification.fixture_executable !== (verification.fixture_replay?.status === 'passed')) {
    errors.push('fixture_executable requires a passed fixture replay');
  }
  if (verification.state_verified !== (verification.state_replay?.status === 'passed')) {
    errors.push('state_verified requires a passed state replay');
  }
  for (const replay of [verification.fixture_replay, verification.state_replay]) {
    if (!REPLAY_STATUSES.has(replay?.status)) errors.push(`Invalid replay status: ${replay?.status}`);
    if (!REPLAY_REASON_CODES.has(replay?.reason_code)) errors.push(`Invalid replay reason: ${replay?.reason_code}`);
    if (replay?.status === 'passed' && replay?.reason_code !== 'passed') {
      errors.push('Passed replay requires reason_code=passed');
    }
    if (replay?.status === 'not_run' && replay?.reason_code !== 'not_run') {
      errors.push('A replay that was not run requires reason_code=not_run');
    }
  }
  if (verification.fixture_executable) {
    const outputs = verification.fixture_replay?.fixture_outputs || [];
    if (outputs.length !== (example.oracle?.acceptable_calls || []).length) {
      errors.push('Passed fixture replay must record one output per canonical call');
    }
    if (outputs.some(output => !output?.provenance)) {
      errors.push('Passed fixture outputs require provenance');
    }
  }
  if (verification.state_verified && (example.oracle?.terminal_predicates || []).length === 0) {
    errors.push('State verification requires terminal predicates');
  }
  const strongReplay = example.strong_model_replay || {};
  if (!REPLAY_STATUSES.has(strongReplay.status)) errors.push(`Invalid strong-model replay status: ${strongReplay.status}`);
  if (!REPLAY_REASON_CODES.has(strongReplay.reason_code)) {
    errors.push(`Invalid strong-model replay reason: ${strongReplay.reason_code}`);
  }
  if (strongReplay.status === 'passed' && strongReplay.reason_code !== 'passed') {
    errors.push('Passed strong-model replay requires reason_code=passed');
  }
  if (strongReplay.status === 'not_run' && strongReplay.reason_code !== 'not_run') {
    errors.push('A strong-model replay that was not run requires reason_code=not_run');
  }
  if (!['semantic_canonical_equivalence', 'completion_equivalence_v1'].includes(strongReplay.comparison_mode)) {
    errors.push('Strong-model replay must use semantic canonical equivalence or completion equivalence');
  }
  if (strongReplay.status === 'passed' && strongReplay.semantic_verdict !== 'passed') {
    errors.push('Passed strong-model replay requires a semantic pass verdict');
  }
  const promoted = strongReplay.status === 'failed' && strongReplay.builder_semantic_verified === true;
  if (promoted) {
    const semanticAssessment = assessStrongModelReplaySemantics(example, strongReplay, adapter.snapshot, adapter);
    if (!semanticAssessment.passed) {
      errors.push('Promoted strong-model replay did not pass builder completion-equivalence recomputation');
    }
    if (!REPLAY_REASON_CODES.has(strongReplay.reason_code)) {
      errors.push(`Promoted strong-model replay has invalid reason ${strongReplay.reason_code}`);
    }
  }
  if (strongReplay.status === 'passed' && (!strongReplay.model_family || !strongReplay.model_id)) {
    errors.push('Passed strong-model replay requires provider family and model id');
  }
  if (strongReplay.status === 'passed') {
    const semanticAssessment = assessStrongModelReplaySemantics(example, strongReplay, adapter.snapshot, adapter);
    if (!semanticAssessment.passed || strongReplay.builder_semantic_verified !== true) {
      errors.push('Passed strong-model replay did not pass builder semantic recomputation');
    }
    if ((strongReplay.observed_call_errors || []).length > 0) {
      errors.push('Passed strong-model replay contains observed-call validation errors');
    }
    const requiredProvenance = ['runner', 'runner_version', 'generated_at', 'request_hash', 'response_hash'];
    for (const field of requiredProvenance) {
      if (!strongReplay.provenance?.[field]) errors.push(`Passed strong-model replay provenance is missing ${field}`);
    }
    for (const field of ['request_hash', 'response_hash']) {
      if (!/^[a-f0-9]{64}$/i.test(String(strongReplay.provenance?.[field] || ''))) {
        errors.push(`Passed strong-model replay provenance has invalid ${field}`);
      }
    }
    if (!Number.isFinite(Date.parse(strongReplay.provenance?.generated_at || ''))) {
      errors.push('Passed strong-model replay provenance has invalid generated_at');
    }
  }
  if (stableStringify(strongReplay.canonical_calls || []) !== stableStringify(example.oracle?.acceptable_calls || [])) {
    errors.push('Strong-model canonical calls must match the canonical oracle');
  }
  if (strongReplay.canonical_oracle_hash !== canonicalOracleHash(example)) {
    errors.push('Strong-model replay oracle hash is stale');
  }
  if (strongReplay.registry_hash !== example.tool_catalog?.registry_hash) {
    errors.push('Strong-model replay registry hash is stale');
  }
  if (!Array.isArray(strongReplay.fixture_outputs) || !Array.isArray(strongReplay.terminal_predicates)) {
    errors.push('Strong-model replay must carry fixture outputs and terminal predicates');
  }
  if (!strongReplay.provenance || typeof strongReplay.provenance !== 'object') {
    errors.push('Strong-model replay provenance is required');
  }
  return errors;
}

function parseInputPaths(argv) {
  const paths = [];
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--input' && argv[index + 1]) paths.push(path.resolve(argv[++index]));
  }
  return paths;
}

function parseReplayPaths(argv) {
  const paths = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--replay-results' && argv[index + 1]) paths.push(path.resolve(argv[++index]));
  }
  return paths;
}

function loadReplayResults(paths) {
  const results = new Map();
  for (const filePath of paths) {
    for (const replay of readJsonl(filePath)) {
      if (!replay.example_id) throw new Error(`${filePath}: replay result is missing example_id`);
      if (results.has(replay.example_id)) throw new Error(`Duplicate replay result for ${replay.example_id}`);
      results.set(replay.example_id, replay);
    }
  }
  return results;
}

function canonicalOracleHash(example) {
  return sha256(
    stableStringify({
      acceptable_calls: example.oracle?.acceptable_calls || [],
      terminal_predicates: example.oracle?.terminal_predicates || [],
    })
  );
}

/**
 * Multi-solution oracles: generate alternative call sequences that complete
 * the same task through documented equivalent tools. The strict oracle stays
 * the canonical gold; variants are recorded for the completion-equivalence
 * replay gate and for future training of alternative plans.
 */
function expandAcceptableVariants(calls) {
  const variants = [];
  const pushUnique = sequence => {
    const key = stableStringify(sequence);
    if (key === stableStringify(calls)) return;
    if (!variants.some(existing => stableStringify(existing) === key)) variants.push(sequence);
  };
  calls.forEach((call, index) => {
    const replaceAt = replacement => {
      const variant = calls.map((item, itemIndex) =>
        itemIndex === index ? { tool_name: replacement.tool_name, parameters: replacement.parameters } : { ...item }
      );
      pushUnique(variant);
    };
    if (call.tool_name === 'blast_create_db_from_genome') {
      replaceAt({
        tool_name: 'blast_create_quick_db_for_current_genome',
        parameters: {
          createNucleotide: true,
          ...(call.parameters?.dbName ? { genomeName: call.parameters.dbName } : {}),
        },
      });
    }
    if (call.tool_name === 'blast_create_quick_db_for_current_genome' && call.parameters?.genomeName) {
      replaceAt({
        tool_name: 'blast_create_db_from_genome',
        parameters: { chromosome: '<current_chromosome>', dbName: call.parameters.genomeName },
      });
    }
    if (call.tool_name === 'blast_search' || call.tool_name === 'blast_search_online') {
      const counterpart = call.tool_name === 'blast_search' ? 'blast_search_online' : 'blast_search';
      replaceAt({ tool_name: counterpart, parameters: { ...call.parameters } });
    }
    // update_annotation / get_annotation_history: the minted feature id and the
    // literal name resolve to the same record.
    if (
      (call.tool_name === 'update_annotation' || call.tool_name === 'get_annotation_history') &&
      call.parameters?.identifier &&
      !String(call.parameters.identifier).startsWith('<')
    ) {
      replaceAt({
        tool_name: call.tool_name,
        parameters: { ...call.parameters, identifier: '<created_annotation_id>' },
      });
    }
    // update_annotation / bulk_update_annotations: the app aliases description
    // onto the note qualifier, so both field names write the same value.
    if (
      (call.tool_name === 'update_annotation' || call.tool_name === 'bulk_update_annotations') &&
      call.parameters?.updates &&
      typeof call.parameters.updates === 'object' &&
      !Array.isArray(call.parameters.updates)
    ) {
      if (Object.hasOwn(call.parameters.updates, 'note')) {
        const variantParameters = { ...call.parameters, updates: { ...call.parameters.updates } };
        variantParameters.updates = { description: call.parameters.updates.note };
        replaceAt({ tool_name: call.tool_name, parameters: variantParameters });
      } else if (Object.hasOwn(call.parameters.updates, 'description')) {
        const variantParameters = { ...call.parameters, updates: { ...call.parameters.updates } };
        variantParameters.updates = { note: call.parameters.updates.description };
        replaceAt({ tool_name: call.tool_name, parameters: variantParameters });
      }
    }
    // analyze_interpro_domains: "complete" is the documented default and a
    // superset of a "domains" request.
    if (call.tool_name === 'analyze_interpro_domains' && call.parameters?.analysis_type === 'domains') {
      replaceAt({
        tool_name: call.tool_name,
        parameters: { ...call.parameters, analysis_type: 'complete' },
      });
    }
    // open_protein_viewer: opening the downloaded local PDB file is equally
    // valid when the previous step fetched a structure.
    if (call.tool_name === 'open_protein_viewer' && calls[index - 1]?.tool_name?.startsWith('fetch_')) {
      const previous = calls[index - 1];
      if (previous.parameters?.uniprot_id || previous.parameters?.pdb_id || previous.parameters?.structure_id) {
        replaceAt({
          tool_name: call.tool_name,
          parameters: { ...call.parameters, file_path: `{${previous.tool_name}.filePath}` },
        });
      }
    }
    // capture_screenshot: a tracks-targeted screenshot without an explicit
    // mode still captures the visible tracks.
    if (call.tool_name === 'capture_screenshot' && call.parameters?.mode === 'visible') {
      const variantParameters = { ...call.parameters };
      delete variantParameters.mode;
      variantParameters.target = variantParameters.target || 'visible_tracks';
      replaceAt({ tool_name: call.tool_name, parameters: variantParameters });
    }
    // toggle_track: action="toggle" is the schema-documented invert control.
    if (call.tool_name === 'toggle_track' && Object.hasOwn(call.parameters || {}, 'visible')) {
      replaceAt({
        tool_name: call.tool_name,
        parameters: { track_name: call.parameters.track_name, action: 'toggle' },
      });
    }
  });
  return variants;
}

function canonicalFixturePayload(outputs) {
  return (Array.isArray(outputs) ? outputs : []).map(output => ({
    tool_name: output?.tool_name || null,
    result: deepClone(output?.result ?? output ?? null),
  }));
}

function recomputeTerminalPredicateResults(example, observedCalls, fixtureOutputs, evaluator) {
  const predicates = Array.isArray(example.oracle?.terminal_predicates)
    ? example.oracle.terminal_predicates
    : [];
  return predicates.map((predicate, predicateIndex) => {
    let passed = false;
    let reason = 'unsupported_predicate';
    if (predicate?.type === 'call_contract_matched' || predicate?.type === 'tool_completed') {
      passed = observedCalls.some(call => evaluator.toolMatches(call.tool_name, predicate.tool_name));
      reason = passed ? 'observed_tool_matched' : 'tool_not_observed';
    } else if (predicate?.type === 'fixture_call_succeeded') {
      const output = fixtureOutputs.find(item => evaluator.toolMatches(item?.tool_name, predicate.tool_name));
      passed = Boolean(output) && output?.result?.success !== false;
      reason = passed ? 'fixture_call_succeeded' : 'fixture_call_missing_or_failed';
    } else if (predicate?.type === 'result_field_equals') {
      const output = fixtureOutputs[Number(predicate.call_index) - 1];
      const actual = getPathValue(output, predicate.path);
      passed = actual.found && evaluator.valuesMatch(actual.value, predicate.value);
      reason = passed ? 'fixture_result_matched' : 'fixture_result_mismatch';
    } else if (predicate?.type === 'argument_from_result') {
      const call = observedCalls[Number(predicate.call_index) - 1];
      const sourceMatch = String(predicate.source || '').match(/^call_(\d+)\.(.+)$/);
      const source = sourceMatch
        ? getPathValue(fixtureOutputs[Number(sourceMatch[1]) - 1], sourceMatch[2])
        : { found: false };
      const parameter = call
        ? evaluator.getActualParameter(
            evaluator.normalizeParameters(call.parameters || {}),
            predicate.parameter,
            evaluator.normalizeToolName(call.tool_name)
          )
        : { found: false };
      passed = source.found && parameter.found && evaluator.valuesMatch(parameter.value, source.value);
      reason = passed ? 'observed_argument_grounded' : 'observed_argument_not_grounded';
    }
    return {
      predicate_index: predicateIndex,
      passed,
      reason,
      source: 'dataset_builder_recomputed',
      execution_assessed: false,
    };
  });
}

function assessStrongModelReplaySemantics(example, replay, manifest, adapter) {
  const evaluator = new StrictAutomaticEvaluator({
    assessmentMode: 'completion',
    validateToolCall: (toolName, parameters) => {
      const canonical = canonicalizeToolCall({ tool_name: toolName, parameters }, manifest, adapter);
      return { valid: canonical.valid, errors: canonical.errors || [] };
    },
  });
  const observedCalls = Array.isArray(replay?.observed_calls) ? replay.observed_calls : [];
  const canonicalizedObservedCalls = [];
  const observedCallErrors = [];
  for (const observed of observedCalls) {
    const normalized = canonicalizeToolCall(observed, manifest, adapter);
    if (normalized.valid) canonicalizedObservedCalls.push(normalized.call);
    else observedCallErrors.push(...normalized.errors);
  }

  // Completion-equivalence gate: the observed plan is accepted when it covers
  // every expected call (in order, allowing extra calls), where each expected
  // call may be satisfied by a documented equivalent tool, and the arguments
  // satisfy the oracle under the completion tolerance (placeholders, anyOf,
  // alternative keys, schema-valid plans). The canonical gold sequence and
  // its recorded variants are all tried.
  const expectedSequences = [
    example.oracle?.acceptable_calls || [],
    ...(example.oracle?.acceptable_variants || []),
  ].filter(sequence => sequence.length > 0 || (example.oracle?.acceptable_calls || []).length === 0);

  const assessAgainstSequence = sequence => {
    if (sequence.length === 0) {
      // no_call/decision oracles require the model to stay silent; any
      // observed tool call fails the gate.
      const allMatched = canonicalizedObservedCalls.length === 0;
      return { matches: [], allMatched, argumentComparisons: [], argumentsMatch: allMatched, equivalenceUsed: false };
    }
    const used = new Set();
    const matches = [];
    let cursor = 0;
    for (let expectedIndex = 0; expectedIndex < sequence.length; expectedIndex += 1) {
      const expected = sequence[expectedIndex];
      let actualIndex = -1;
      for (let index = cursor; index < canonicalizedObservedCalls.length; index += 1) {
        if (
          !used.has(index) &&
          evaluator.toolMatches(canonicalizedObservedCalls[index].tool_name, expected.tool_name)
        ) {
          actualIndex = index;
          break;
        }
      }
      if (actualIndex === -1) {
        matches.push({ expectedIndex, expectedTool: expected.tool_name, actualIndex: null, matched: false });
        cursor = canonicalizedObservedCalls.length;
        continue;
      }
      used.add(actualIndex);
      cursor = actualIndex + 1;
      matches.push({
        expectedIndex,
        expectedTool: expected.tool_name,
        actualIndex,
        matched: true,
        equivalenceUsed: evaluator.normalizeToolName(canonicalizedObservedCalls[actualIndex].tool_name) !==
          evaluator.normalizeToolName(expected.tool_name),
      });
    }
    const allMatched = matches.every(match => match.matched);
    const argumentComparisons = matches.map(match => {
      if (!match.matched) {
        return { expectedIndex: match.expectedIndex, match: false, mismatches: [{ reason: 'tool_or_call_missing' }] };
      }
      const observed = canonicalizedObservedCalls[match.actualIndex];
      const expected = sequence[match.expectedIndex];
      const comparison = evaluator.compareParameters(observed.parameters || {}, expected.parameters || {}, expected.tool_name);
      return { expectedIndex: match.expectedIndex, ...comparison };
    });
    const argumentsMatch =
      allMatched &&
      argumentComparisons.length === sequence.length &&
      argumentComparisons.every(comparison => comparison.match === true);
    const equivalenceUsed = matches.some(match => match.equivalenceUsed);
    return { matches, allMatched, argumentComparisons, argumentsMatch, equivalenceUsed };
  };

  let best = null;
  for (const sequence of expectedSequences) {
    const assessment = assessAgainstSequence(sequence);
    const score = (assessment.allMatched ? 100 : 0) + assessment.argumentComparisons.filter(c => c.match).length;
    if (!best || score > best.score) best = { ...assessment, sequence, score };
    if (assessment.allMatched && assessment.argumentsMatch) break;
  }
  const sequenceMatches = best?.allMatched === true;
  const argumentComparisons = best?.argumentComparisons || [];
  const argumentsMatch = best?.argumentsMatch === true;
  const equivalenceUsed = best?.equivalenceUsed === true;

  const fixtureOutputs = Array.isArray(replay?.fixture_outputs) ? replay.fixture_outputs : [];
  const expectedFixtureOutputs = example.verification?.fixture_replay?.fixture_outputs || [];
  const fixturesMatch =
    equivalenceUsed ||
    !example.verification?.fixture_executable ||
    stableStringify(canonicalFixturePayload(fixtureOutputs)) ===
      stableStringify(canonicalFixturePayload(expectedFixtureOutputs));
  const terminalPredicateResults = recomputeTerminalPredicateResults(
    example,
    canonicalizedObservedCalls,
    fixtureOutputs,
    evaluator
  );
  const submittedPredicateResults = Array.isArray(replay?.terminal_predicate_results)
    ? replay.terminal_predicate_results
    : [];
  const submittedPredicatesPass =
    submittedPredicateResults.length === terminalPredicateResults.length &&
    terminalPredicateResults.every((_result, index) => {
      const submitted = submittedPredicateResults.find(item => item?.predicate_index === index);
      return submitted?.passed === true;
    });
  const terminalPredicatesPass =
    submittedPredicatesPass && terminalPredicateResults.every(result => result.passed === true);
  return {
    comparison_mode: 'completion_equivalence_v1',
    canonicalizedObservedCalls,
    observedCallErrors,
    sequenceMatches,
    argumentComparisons,
    argumentsMatch,
    equivalenceUsed,
    fixturesMatch,
    terminalPredicateResults,
    terminalPredicatesPass,
    passed:
      observedCallErrors.length === 0 &&
      sequenceMatches &&
      argumentsMatch &&
      fixturesMatch &&
      terminalPredicatesPass,
  };
}

function applyStrongModelReplay(example, replay, manifest, adapter) {
  if (!replay) return { applied: false, example };
  const errors = [];
  if (replay.registry_hash !== manifest.registryHash) errors.push('replay registry_hash is stale');
  const oracleHash = canonicalOracleHash(example);
  if (replay.canonical_oracle_hash !== oracleHash) errors.push('replay canonical_oracle_hash is stale');
  if (stableStringify(replay.canonical_calls || []) !== stableStringify(example.oracle?.acceptable_calls || [])) {
    errors.push('replay canonical_calls are stale');
  }
  if (
    stableStringify(replay.terminal_predicates || []) !==
    stableStringify(example.oracle?.terminal_predicates || [])
  ) {
    errors.push('replay terminal_predicates are stale');
  }
  if (!REPLAY_STATUSES.has(replay.status)) errors.push(`invalid replay status ${replay.status}`);
  if (!REPLAY_REASON_CODES.has(replay.reason_code)) errors.push(`invalid replay reason ${replay.reason_code}`);
  if (!Array.isArray(replay.observed_calls)) errors.push('replay observed_calls must be an array');
  if (!Array.isArray(replay.fixture_outputs)) errors.push('replay fixture_outputs must be an array');
  if (!Array.isArray(replay.terminal_predicate_results)) {
    errors.push('replay terminal_predicate_results must be an array');
  }
  if (!replay.provenance || typeof replay.provenance !== 'object') errors.push('replay provenance is required');
  const observedCalls = Array.isArray(replay.observed_calls) ? replay.observed_calls : [];
  const semanticAssessment = assessStrongModelReplaySemantics(example, replay, manifest, adapter);
  const { canonicalizedObservedCalls, observedCallErrors } = semanticAssessment;
  if (replay.status === 'passed') {
    if (replay.reason_code !== 'passed') errors.push('passed replay requires reason_code=passed');
    if (replay.semantic_verdict !== 'passed') errors.push('passed replay requires semantic_verdict=passed');
    if (!replay.model_family || !replay.model_id) errors.push('passed replay requires model family and id');
    if (observedCallErrors.length > 0) errors.push(`passed replay has invalid observed calls: ${observedCallErrors.join('; ')}`);
    if (!semanticAssessment.sequenceMatches) errors.push('passed replay canonical tool sequence differs from the oracle');
    if (!semanticAssessment.argumentsMatch) errors.push('passed replay arguments are not semantically equivalent to the oracle');
    if (!semanticAssessment.fixturesMatch) errors.push('passed replay fixture outputs differ from builder-verified fixtures');
    if (!semanticAssessment.terminalPredicatesPass) {
      errors.push('passed replay requires every terminal predicate to pass builder recomputation');
    }
    const requiredProvenance = ['runner', 'runner_version', 'generated_at', 'request_hash', 'response_hash'];
    for (const field of requiredProvenance) {
      if (!replay.provenance?.[field]) errors.push(`passed replay provenance is missing ${field}`);
    }
  }
  if (errors.length > 0) return { applied: false, example, errors };
  example.strong_model_replay = {
    ...example.strong_model_replay,
    status: replay.status,
    reason_code: replay.reason_code,
    semantic_verdict: replay.semantic_verdict || replay.status,
    model_family: replay.model_family || null,
    model_id: replay.model_id || null,
    canonical_oracle_hash: oracleHash,
    observed_calls: deepClone(observedCalls),
    canonicalized_observed_calls: deepClone(canonicalizedObservedCalls),
    observed_call_errors: observedCallErrors,
    semantic_argument_comparisons: deepClone(semanticAssessment.argumentComparisons),
    builder_semantic_verified: semanticAssessment.passed,
    fixture_outputs: deepClone(replay.fixture_outputs || example.strong_model_replay.fixture_outputs || []),
    terminal_predicate_results: deepClone(semanticAssessment.terminalPredicateResults),
    provenance: deepClone(replay.provenance || {}),
  };
  return { applied: true, example };
}

function buildDataset(inputPaths = [], outputRoot = RELEASE_ROOT, replayPaths = []) {
  const manifest = readJson(MANIFEST_PATH);
  const adapter = buildAdapter(manifest);
  const benchmarks = loadAutomaticBenchmarks();
  const replayResults = loadReplayResults(replayPaths);
  const externalSources = inputPaths.flatMap(readJsonl);
  const registrySources = sourceFromRegistrySamples(manifest, adapter);
  const deterministicFixtureSources = buildDeterministicFixtureSources({
    projectSplit: projectedSplitForIsolatedFamily,
  });
  const sources = [
    ...registrySources,
    ...sourceFromRegistryCompositions(registrySources, adapter),
    ...deterministicFixtureSources,
    ...loadCuratedSources(),
    ...externalSources.map(source => ({
      ...source,
      provenance: {
        ...(source.provenance || {}),
        source_type: source.provenance?.source_type || 'external_verified_candidate',
      },
    })),
  ]
    .map(normalizeSource)
    .map(source => {
      const assessment = inferSourceStatefulness(source, adapter);
      const resolvedForSplit = validateAndResolveCalls(source, manifest, adapter);
      return {
        ...source,
        stateful: assessment.stateful,
        statefulness_basis: source.statefulness_basis || assessment.basis,
        split_canonical_call_signature:
          resolvedForSplit.valid && resolvedForSplit.calls.length > 0
            ? sha256(stableStringify(resolvedForSplit.calls))
            : null,
        split_template_family_signature: source.provenance?.generator_template
          ? sha256(String(source.provenance.generator_template))
          : null,
      };
    });
  const getSplitAssignment = splitAssignmentForSources(sources);

  const accepted = [];
  const rejected = [];
  const seenSources = new Set();
  for (const source of sources) {
    const sourceKey = `${source.family_id}\n${normalizeText(source.user_query)}\n${normalizeToolSignature(source.calls)}`;
    if (seenSources.has(sourceKey)) {
      rejected.push({ family_id_hash: sha256(source.family_id), reason: 'duplicate_source' });
      continue;
    }
    seenSources.add(sourceKey);
    const result = buildExample(source, manifest, adapter, benchmarks, getSplitAssignment);
    if (result.accepted) {
      const replay = replayResults.get(result.example.example_id);
      if (replay) replayResults.delete(result.example.example_id);
      const replayResult = applyStrongModelReplay(result.example, replay, manifest, adapter);
      if (replayResult.errors?.length) {
        throw new Error(`${result.example.example_id}: invalid strong-model replay: ${replayResult.errors.join('; ')}`);
      } else {
        accepted.push(replayResult.example);
      }
    } else rejected.push({ family_id_hash: sha256(source.family_id), reason: result.reason, errors: result.errors || [] });
  }

  if (replayResults.size > 0) {
    throw new Error(`Replay sidecar contains ${replayResults.size} unknown or rejected example_id value(s)`);
  }

  const validationErrors = accepted.flatMap(example =>
    validateExample(example, adapter, benchmarks).map(error => `${example.example_id}: ${error}`)
  );
  if (validationErrors.length > 0) throw new Error(`Dataset validation failed:\n${validationErrors.join('\n')}`);

  fs.mkdirSync(outputRoot, { recursive: true });
  const splitFiles = {};
  for (const split of ['train', 'dev', 'holdout']) {
    const records = accepted.filter(example => example.split === split);
    const filePath = path.join(outputRoot, `${split}.jsonl`);
    writeJsonl(filePath, records);
    splitFiles[split] = {
      count: records.length,
      sha256: sha256(fs.readFileSync(filePath)),
    };
  }
  const candidatePreferences = accepted
    .filter(example => example.oracle.decision === 'call' && example.split !== 'holdout')
    .map(example => mutateCall(example, adapter))
    .filter(preference => preference?.verification?.rejected_schema_valid && preference?.verification?.semantic_mismatch);
  const preferences = candidatePreferences.filter(
    preference =>
      preference.verification.training_eligible === true &&
      preference.verification.semantic_negative_replay_status === 'passed'
  );
  const candidatePreferencesPath = path.join(outputRoot, 'candidate-preferences.jsonl');
  writeJsonl(candidatePreferencesPath, candidatePreferences);
  const preferencesPath = path.join(outputRoot, 'preferences.jsonl');
  writeJsonl(preferencesPath, preferences);
  const catalog = {
    schema_version: '2.0',
    registry_hash: manifest.registryHash,
    tools: adapter.snapshot.tools.map(toCanonicalNativeFunctionTool).filter(Boolean),
  };
  const catalogPath = path.join(outputRoot, 'tool-catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  const rejectionCounts = rejected.reduce((counts, item) => {
    counts[item.reason] = (counts[item.reason] || 0) + 1;
    return counts;
  }, {});
  const candidateCountHistogram = accepted.reduce((counts, example) => {
    const count = example.tool_catalog.candidate_tool_names.length;
    counts[count] = (counts[count] || 0) + 1;
    return counts;
  }, {});
  const validationTierCounts = accepted.reduce((counts, example) => {
    const tier = example.verification.validation_tier;
    counts[tier] = (counts[tier] || 0) + 1;
    return counts;
  }, {});
  const deterministicFixtureRecords = accepted.filter(
    example => example.provenance.source_type === 'deterministic_fixture_generator_v2'
  );
  const deterministicFixtureSingles = deterministicFixtureRecords.filter(
    example => example.oracle.acceptable_calls.length === 1
  );
  const deterministicFixtureTools = [
    ...new Set(
      deterministicFixtureRecords.flatMap(example =>
        example.oracle.acceptable_calls.map(call => call.tool_name)
      )
    ),
  ].sort();
  const deterministicFixtureSplits = Object.fromEntries(
    ['train', 'dev', 'holdout'].map(split => {
      const records = deterministicFixtureRecords.filter(example => example.split === split);
      return [
        split,
        {
          records: records.length,
          single_call: records.filter(example => example.oracle.acceptable_calls.length === 1).length,
          dependent_workflows: records.filter(
            example => example.oracle.argument_provenance.length > 0
          ).length,
          tools: [
            ...new Set(records.flatMap(example => example.oracle.acceptable_calls.map(call => call.tool_name))),
          ].sort(),
        },
      ];
    })
  );
  if (
    deterministicFixtureSingles.length < 120 ||
    deterministicFixtureTools.length < 15 ||
    deterministicFixtureRecords.some(example =>
      example.labels.stateful || !example.verification.fixture_executable
    ) ||
    Object.values(deterministicFixtureSplits).some(
      split => split.single_call === 0 || split.dependent_workflows === 0 || split.tools.length < 3
    )
  ) {
    throw new Error('Deterministic fixture corpus failed production coverage gates');
  }
  const releaseManifest = {
    schema_version: '2.0',
    generator_version: GENERATOR_VERSION,
    generated_at: new Date().toISOString(),
    benchmark_scope: {
      automatic_simple: 143,
      automatic_complex: 29,
      manual_tests_included: 0,
      use: 'leakage_fingerprints_only',
      fingerprint_hash: sha256(benchmarks.map(item => item.normalizedPrompt).sort().join('\n')),
    },
    registry_hash: manifest.registryHash,
    candidate_limit: CANDIDATE_LIMIT,
    candidate_curriculum: deepClone(CANDIDATE_COUNT_CURRICULUM),
    candidate_count_histogram: candidateCountHistogram,
    input_sources: sources.length,
    accepted_examples: accepted.length,
    rejected_examples: rejected.length,
    rejection_counts: rejectionCounts,
    splits: splitFiles,
    preferences: {
      count: preferences.length,
      sha256: sha256(fs.readFileSync(preferencesPath)),
      use: 'promoted_training_only',
    },
    candidate_preferences: {
      count: candidatePreferences.length,
      sha256: sha256(fs.readFileSync(candidatePreferencesPath)),
      use: 'replay_queue_not_training',
      schema_valid_semantic_negative_rate: 1,
    },
    validation_tier_counts: validationTierCounts,
    deterministic_fixture_corpus: {
      runner: PINNED_FIXTURE_RUNNER,
      generated_records: deterministicFixtureRecords.length,
      fixture_executable_stateless_single_calls: deterministicFixtureSingles.length,
      dependent_workflows: deterministicFixtureRecords.length - deterministicFixtureSingles.length,
      covered_tool_count: deterministicFixtureTools.length,
      covered_tools: deterministicFixtureTools,
      target_core_tools: [...DETERMINISTIC_FIXTURE_TOOL_NAMES],
      splits: deterministicFixtureSplits,
      declared_outputs_recomputed: true,
      stateful_tools_verified: 0,
    },
    statefulness: {
      stateful: accepted.filter(example => example.labels.stateful).length,
      stateless: accepted.filter(example => !example.labels.stateful).length,
      quarantined: accepted.filter(example => example.labels.state_verification_quarantine).length,
    },
    strong_model_replays: {
      supplied: replayPaths.length > 0,
      passed: accepted.filter(example => example.strong_model_replay.status === 'passed').length,
      failed: accepted.filter(example => example.strong_model_replay.status === 'failed').length,
      blocked: accepted.filter(example => example.strong_model_replay.status === 'blocked').length,
      not_run: accepted.filter(example => example.strong_model_replay.status === 'not_run').length,
    },
    tool_catalog_sha256: sha256(fs.readFileSync(catalogPath)),
    training_eligible_by_split: Object.fromEntries(
      ['train', 'dev', 'holdout'].map(split => {
        const records = accepted.filter(example => example.split === split);
        return [split, records.filter(isExampleTrainingEligible).length];
      })
    ),
    release_gates: {
      schema_valid_rate: 1,
      fixture_executable_rate:
        accepted.filter(example => example.verification.fixture_executable).length / Math.max(1, accepted.length),
      state_verified_rate:
        accepted.filter(example => example.verification.state_verified).length / Math.max(1, accepted.length),
      strong_model_replay_pass_rate:
        accepted.filter(example => example.strong_model_replay.status === 'passed').length /
        Math.max(1, accepted.length),
      leakage_pass_rate: 1,
      atomic_component_split_overlap: 0,
      training_promotion_ready:
        accepted.length > 0 &&
        ['train', 'dev', 'holdout'].every(
          split =>
            accepted.filter(
              example => example.split === split && isExampleTrainingEligible(example)
            ).length > 0
        ),
    },
    replay_contract: {
      comparison_modes: ['semantic_canonical_equivalence', 'completion_equivalence_v1'],
      promotion_rule: 'builder completion-equivalence recomputation is authoritative; valid alternative plans and extra read-only calls are promoted',
      statuses: [...REPLAY_STATUSES],
      reason_codes: [...REPLAY_REASON_CODES],
      required_fields: [
        'example_id',
        'registry_hash',
        'canonical_oracle_hash',
        'canonical_calls',
        'observed_calls',
        'fixture_outputs',
        'terminal_predicates',
        'provenance',
        'status',
        'reason_code',
        'semantic_verdict',
      ],
      strong_model_required_for_training_promotion: true,
    },
    promotion_contract: {
      tool_call_requires_fixture_execution: true,
      tool_call_requires_strong_model_semantic_replay: true,
      stateful_requires_state_verification: true,
      no_call_requires_fixture_execution: false,
      schema_only_rows_are_candidates_not_training: true,
    },
  };
  fs.writeFileSync(path.join(outputRoot, 'manifest.json'), JSON.stringify(releaseManifest, null, 2) + '\n');
  fs.writeFileSync(path.join(outputRoot, 'rejections.json'), JSON.stringify(rejected, null, 2) + '\n');
  return releaseManifest;
}

function validateRelease(outputRoot = RELEASE_ROOT) {
  const manifest = readJson(MANIFEST_PATH);
  const adapter = buildAdapter(manifest);
  const benchmarks = loadAutomaticBenchmarks();
  const releaseManifestPath = path.join(outputRoot, 'manifest.json');
  const catalogPath = path.join(outputRoot, 'tool-catalog.json');
  if (!fs.existsSync(releaseManifestPath) || !fs.existsSync(catalogPath)) {
    throw new Error('Release manifest and frozen tool catalog are required');
  }
  const releaseManifest = readJson(releaseManifestPath);
  const catalog = readJson(catalogPath);
  const splitRecords = Object.fromEntries(
    ['train', 'dev', 'holdout'].map(split => [split, readJsonl(path.join(outputRoot, `${split}.jsonl`))])
  );
  const records = Object.values(splitRecords).flat();
  if (records.length === 0) throw new Error('No release records found; run the build command first');
  const errors = records.flatMap(example =>
    validateExample(example, adapter, benchmarks).map(error => `${example.example_id}: ${error}`)
  );
  if (releaseManifest.schema_version !== '2.0') errors.push('Release manifest schema_version must be 2.0');
  if (releaseManifest.registry_hash !== manifest.registryHash) errors.push('Release registry hash is stale');
  if (
    releaseManifest.benchmark_scope?.automatic_simple !== 143 ||
    releaseManifest.benchmark_scope?.automatic_complex !== 29 ||
    releaseManifest.benchmark_scope?.manual_tests_included !== 0
  ) {
    errors.push('Release benchmark scope must be exactly 143 simple + 29 complex and zero manual tests');
  }
  if (releaseManifest.tool_catalog_sha256 !== sha256(fs.readFileSync(catalogPath))) {
    errors.push('Frozen tool catalog file hash does not match the release manifest');
  }
  const expectedCatalog = {
    schema_version: '2.0',
    registry_hash: manifest.registryHash,
    tools: adapter.snapshot.tools.map(toCanonicalNativeFunctionTool).filter(Boolean),
  };
  if (stableStringify(catalog) !== stableStringify(expectedCatalog)) {
    errors.push('Frozen tool catalog does not match the current canonical registry schemas');
  }
  for (const [split, splitRows] of Object.entries(splitRecords)) {
    const splitPath = path.join(outputRoot, `${split}.jsonl`);
    if (releaseManifest.splits?.[split]?.count !== splitRows.length) {
      errors.push(`${split}: record count does not match the release manifest`);
    }
    if (releaseManifest.splits?.[split]?.sha256 !== sha256(fs.readFileSync(splitPath))) {
      errors.push(`${split}: file hash does not match the release manifest`);
    }
  }
  if (releaseManifest.accepted_examples !== records.length) {
    errors.push('accepted_examples does not match the split files');
  }
  const candidateHistogram = records.reduce((counts, example) => {
    const count = example.tool_catalog?.candidate_tool_names?.length || 0;
    counts[count] = (counts[count] || 0) + 1;
    return counts;
  }, {});
  if (stableStringify(candidateHistogram) !== stableStringify(releaseManifest.candidate_count_histogram || {})) {
    errors.push('Candidate count histogram does not match release records');
  }
  if (
    stableStringify(releaseManifest.candidate_curriculum || {}) !==
    stableStringify(CANDIDATE_COUNT_CURRICULUM)
  ) {
    errors.push('Candidate curriculum metadata is stale');
  }
  const familySplits = new Map();
  const componentSplits = new Map();
  const canonicalPayloadSplits = new Map();
  const exampleIds = new Set();
  for (const example of records) {
    if (exampleIds.has(example.example_id)) errors.push(`${example.example_id}: duplicate example id`);
    exampleIds.add(example.example_id);
    const existing = familySplits.get(example.scenario_family_id);
    if (existing && existing !== example.split) errors.push(`${example.scenario_family_id}: split overlap`);
    familySplits.set(example.scenario_family_id, example.split);
    const componentSplit = componentSplits.get(example.split_group_id);
    if (componentSplit && componentSplit !== example.split) errors.push(`${example.split_group_id}: component split overlap`);
    componentSplits.set(example.split_group_id, example.split);
    const calls = example.oracle?.acceptable_calls || [];
    if (calls.length > 0) {
      const payloadHash = sha256(stableStringify(calls));
      const payloadSplit = canonicalPayloadSplits.get(payloadHash);
      if (payloadSplit && payloadSplit !== example.split) {
        errors.push(`${example.example_id}: exact canonical call payload crosses split boundaries`);
      }
      canonicalPayloadSplits.set(payloadHash, example.split);
    }
  }
  const fixtureExecutableBySplit = Object.fromEntries(
    Object.entries(splitRecords).map(([split, splitRows]) => [
      split,
      splitRows.filter(example => example.verification?.fixture_executable).length,
    ])
  );
  if (Object.values(fixtureExecutableBySplit).some(count => count === 0)) {
    errors.push('Every split must contain fixture-executable records');
  }
  const eligibleBySplit = Object.fromEntries(
    Object.entries(splitRecords).map(([split, splitRows]) => [
      split,
      splitRows.filter(isExampleTrainingEligible).length,
    ])
  );
  const computedTrainingReady = Object.values(eligibleBySplit).every(count => count > 0);
  if (releaseManifest.release_gates?.training_promotion_ready !== computedTrainingReady) {
    errors.push('training_promotion_ready does not match per-split eligible records');
  }
  const fixtureRate = records.filter(example => example.verification?.fixture_executable).length / records.length;
  if (Math.abs((releaseManifest.release_gates?.fixture_executable_rate ?? -1) - fixtureRate) > 1e-12) {
    errors.push('fixture_executable_rate does not match release records');
  }
  for (const [field, filename] of [
    ['preferences', 'preferences.jsonl'],
    ['candidate_preferences', 'candidate-preferences.jsonl'],
  ]) {
    const filePath = path.join(outputRoot, filename);
    const rows = readJsonl(filePath);
    if (releaseManifest[field]?.count !== rows.length) errors.push(`${field}: count does not match manifest`);
    if (releaseManifest[field]?.sha256 !== sha256(fs.readFileSync(filePath))) {
      errors.push(`${field}: file hash does not match manifest`);
    }
    if (
      field === 'preferences' &&
      rows.some(row =>
        row.verification?.training_eligible !== true ||
        row.verification?.semantic_negative_replay_status !== 'passed'
      )
    ) {
      errors.push('Training preferences require passed semantic-negative replay');
    }
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
  return {
    valid: true,
    examples: records.length,
    families: familySplits.size,
    atomicComponents: componentSplits.size,
    benchmarkFingerprints: benchmarks.length,
    fixtureExecutableBySplit,
    trainingEligibleBySplit: eligibleBySplit,
  };
}

function main() {
  const [command = 'validate', ...argv] = process.argv.slice(2);
  const outputIndex = argv.indexOf('--output');
  const outputRoot = outputIndex === -1 ? RELEASE_ROOT : path.resolve(argv[outputIndex + 1]);
  if (command === 'build') {
    console.log(
      JSON.stringify(buildDataset(parseInputPaths(argv), outputRoot, parseReplayPaths(argv)), null, 2)
    );
    return;
  }
  if (command === 'validate') {
    console.log(JSON.stringify(validateRelease(outputRoot), null, 2));
    return;
  }
  throw new Error(
    'Usage: node scripts/tool-calling-dataset.js <build|validate> [--input candidates.jsonl] [--replay-results replay.jsonl] [--output release-dir]'
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  CANDIDATE_COUNT_CURRICULUM,
  buildDataset,
  buildDeterministicFixtureSources,
  applyStrongModelReplay,
  canonicalOracleHash,
  checkLeakage,
  canonicalizeToolCall,
  canonicalizeToolSchema,
  deterministicCandidateTarget,
  inferCanonicalPropertyMap,
  inferSourceStatefulness,
  inferToolCallStatefulness,
  isExampleTrainingEligible,
  loadAutomaticBenchmarks,
  materializeCandidates,
  mutateCall,
  normalizeText,
  projectedSplitForIsolatedFamily,
  resolveResultReferences,
  splitAssignmentForSources,
  splitForFamily,
  toCanonicalNativeFunctionTool,
  validateAndResolveCalls,
  validateCanonicalParameters,
  validateRelease,
};
