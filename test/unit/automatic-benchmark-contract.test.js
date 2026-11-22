import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const require = createRequire(import.meta.url);
const DynamicToolsSnapshotAdapter = require('../../src/renderer/modules/DynamicToolsSnapshotAdapter.js');
const StrictAutomaticEvaluator = require('../../src/renderer/modules/benchmark-suites/StrictAutomaticEvaluator.js');
const { buildBenchmarkToolResult } = require('../../scripts/lib/benchmark-tool-results');

const ROOT = process.cwd();
const SUITE_DIR = path.join(ROOT, 'src/renderer/modules/benchmark-suites');
const MANIFEST_PATH = path.join(ROOT, 'tools_registry/generated/tool-registry-manifest.json');

function loadBenchmarkSuites() {
  const sandbox = {
    window: {
      songBenchmarkDebug: { detectedTools: [] },
      chatManager: {
        toolExecutionTracker: {
          currentTestId: null,
          getSessionExecutions: () => [],
          getTestExecutions: () => [],
        },
        getLastExecutionData: () => null,
      },
      genomeBrowser: { tabManager: { tabs: new Map() } },
      electronAPI: { checkFileExists: async () => true },
    },
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    Date,
    JSON,
    Math,
    RegExp,
    Object,
    Array,
    Number,
    String,
    Boolean,
    Set,
    Map,
    Promise,
  };
  vm.createContext(sandbox);
  for (const file of [
    'BenchmarkEvaluatorBase.js',
    'AutomaticSimpleSuite.js',
    'AutomaticComplexSuite.js',
    'ManualSuite.js',
    'ManualComplexSuite.js',
  ]) {
    vm.runInContext(fs.readFileSync(path.join(SUITE_DIR, file), 'utf-8'), sandbox, { filename: file });
  }
  return {
    simple: new sandbox.window.AutomaticSimpleSuite(),
    complex: new sandbox.window.AutomaticComplexSuite(),
    manual: new sandbox.window.ManualSuite(),
    manualComplex: new sandbox.window.ManualComplexSuite(),
  };
}

function isDefaultExpectation(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    Object.prototype.hasOwnProperty.call(value, 'benchmarkDefaultValue')
  );
}

function combineProperties(entries, index = 0, current = {}) {
  if (index >= entries.length) return [current];
  const [key, alternatives] = entries[index];
  return alternatives.flatMap(value => combineProperties(entries, index + 1, { ...current, [key]: value }));
}

function expandExpectedValue(value) {
  if (isDefaultExpectation(value)) return expandExpectedValue(value.benchmarkDefaultValue);
  if (Array.isArray(value)) {
    return value.reduce(
      (arrays, item) => arrays.flatMap(array => expandExpectedValue(item).map(candidate => [...array, candidate])),
      [[]]
    );
  }
  if (!value || typeof value !== 'object') return [value];

  const branches = Array.isArray(value.benchmarkAnyOf) ? value.benchmarkAnyOf : [null];
  // A null default represents an omitted filter, while concrete defaults can satisfy required fields.
  const ownEntries = Object.entries(value).filter(
    ([key, item]) => key !== 'benchmarkAnyOf' && !(isDefaultExpectation(item) && item.benchmarkDefaultValue === null)
  );
  const ownAlternatives = ownEntries.map(([key, item]) => [key, expandExpectedValue(item)]);
  const ownObjects = combineProperties(ownAlternatives);

  return branches.flatMap(branch => {
    const expandedBranches = branch === null ? [{}] : expandExpectedValue(branch);
    return ownObjects.flatMap(own => expandedBranches.map(candidate => ({ ...own, ...candidate })));
  });
}

function isPlaceholder(value) {
  if (typeof value !== 'string') return false;
  return /^<[^>]+>$/.test(value) || /\{[^{}]+\}/.test(value);
}

function firstSchemaAlternative(schema) {
  const alternatives = Array.isArray(schema?.oneOf) ? schema.oneOf : Array.isArray(schema?.anyOf) ? schema.anyOf : [];
  if (alternatives.length === 0) return schema || {};
  const base = { ...schema };
  delete base.oneOf;
  delete base.anyOf;
  return { ...base, ...alternatives[0] };
}

function materializePlaceholder(schema, propertyName) {
  const effectiveSchema = firstSchemaAlternative(schema);
  if (Object.prototype.hasOwnProperty.call(effectiveSchema, 'const')) return effectiveSchema.const;
  if (Array.isArray(effectiveSchema.enum) && effectiveSchema.enum.length > 0) return effectiveSchema.enum[0];
  if (effectiveSchema.default !== undefined) return effectiveSchema.default;

  const types = Array.isArray(effectiveSchema.type)
    ? effectiveSchema.type
    : effectiveSchema.type
      ? [effectiveSchema.type]
      : [];
  if (types.includes('integer') || types.includes('number')) {
    const minimum = Number.isFinite(effectiveSchema.minimum) ? effectiveSchema.minimum : 1;
    return types.includes('integer') ? Math.ceil(minimum) : minimum;
  }
  if (types.includes('boolean')) return true;
  if (types.includes('array')) return [];
  if (types.includes('object')) return {};

  const normalizedName = String(propertyName || '').toLowerCase();
  if (normalizedName.includes('chromosome')) return 'U00096';
  if (normalizedName.includes('data_ref')) return 'dataref://fixture/1';
  if (normalizedName.includes('sequence') || normalizedName === 'dna') return 'ATGC';
  if (normalizedName.includes('path') || normalizedName.includes('file')) return '/tmp/fixture.dat';
  if (normalizedName.includes('database') || normalizedName.includes('dbname')) return 'fixture_db';
  return 'fixture';
}

function materializeExpected(value, schema, propertyName = '') {
  const effectiveSchema = firstSchemaAlternative(schema);
  if (isPlaceholder(value)) return materializePlaceholder(effectiveSchema, propertyName);
  if (Array.isArray(value)) {
    return value.map(item => materializeExpected(item, effectiveSchema.items || {}, propertyName));
  }
  if (!value || typeof value !== 'object') return value;

  const properties = effectiveSchema.properties || {};
  const additionalSchema =
    effectiveSchema.additionalProperties && typeof effectiveSchema.additionalProperties === 'object'
      ? effectiveSchema.additionalProperties
      : {};
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      materializeExpected(item, properties[key] || additionalSchema, key),
    ])
  );
}

function expectedSteps(test) {
  const expected = test.expectedResult || {};
  const sequence = Array.isArray(expected.tool_sequence)
    ? expected.tool_sequence
    : expected.tool_name
      ? [expected.tool_name]
      : [];
  const parameters = Array.isArray(expected.parameters) ? expected.parameters : [expected.parameters || {}];
  return sequence.map((toolNames, index) => ({
    toolNames: Array.isArray(toolNames) ? toolNames : [toolNames],
    parameters: parameters[index] || {},
  }));
}

describe('benchmark contracts against the current tool registry', () => {
  let suites;
  let adapter;

  beforeAll(() => {
    suites = loadBenchmarkSuites();
    const snapshot = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    adapter = new DynamicToolsSnapshotAdapter(snapshot, null);
  });

  it('loads exactly the 143 simple and 29 complex automatic tests', () => {
    expect(suites.simple.getTests()).toHaveLength(143);
    expect(suites.complex.getTests()).toHaveLength(29);
  });

  it('gives every expected tool alternative a schema-valid parameter contract', () => {
    const invalid = [];
    let stepCount = 0;
    let alternativeCount = 0;

    for (const suite of Object.values(suites)) {
      for (const test of suite.getTests()) {
        const completionSteps = Object.entries(test.expectedResult?.completionAlternatives || {}).map(
          ([toolName, parameters]) => ({ toolNames: [toolName], parameters })
        );
        for (const step of [...expectedSteps(test), ...completionSteps]) {
          stepCount += 1;
          const candidates = expandExpectedValue(step.parameters);
          const coveredCandidates = new Set();
          for (const toolName of step.toolNames) {
            alternativeCount += 1;
            const tool = adapter.toolsByName.get(toolName);
            if (!tool) {
              invalid.push(`${test.id}: unknown tool ${toolName}`);
              continue;
            }

            const schema = adapter.sanitizeNativeSchema(adapter.normalizeToolSchema(tool), true);
            const attempts = candidates.map((candidate, index) => {
              const parameters = materializeExpected(candidate, schema);
              const result = adapter.validateToolCall(toolName, parameters);
              if (result.valid) coveredCandidates.add(index);
              return { parameters, result };
            });
            if (attempts.some(attempt => attempt.result.valid)) continue;

            invalid.push(
              `${test.id}: ${toolName} ${attempts
                .map(attempt => `${JSON.stringify(attempt.parameters)} => ${attempt.result.errors.join(', ')}`)
                .join(' | ')}`
            );
          }
          candidates.forEach((candidate, index) => {
            if (!coveredCandidates.has(index) && step.toolNames.length > 1) {
              invalid.push(`${test.id}: no tool in ${step.toolNames.join(', ')} accepts ${JSON.stringify(candidate)}`);
            }
          });
        }
      }
    }

    expect(invalid, `Audited ${stepCount} expected steps and ${alternativeCount} alternative tool contracts`).toEqual(
      []
    );
  });

  function evaluateRecordedCall(test, toolName, parameters, success = true, assessmentMode = 'completion') {
    const evaluator = new StrictAutomaticEvaluator({
      assessmentMode,
      requireExecutionForCompletion: true,
      validateToolCall: (name, args) => adapter.validateToolCall(name, args),
    });
    return evaluator.evaluate(test, {
      llmInteractionData: {
        response: {
          functionCalls: [{ id: 'call-1', tool_name: toolName, parameters }],
          toolExecutions: success === null ? [] : [{ tool_call_id: 'call-1', tool_name: toolName, success }],
        },
      },
    });
  }

  it('accepts one WIG path through either published argument and checks the effective file list', () => {
    const test = suites.simple.getTests().find(test => test.id === 'load_auto_05');
    const [filePath] = test.expectedResult.parameters.filePaths;
    for (const args of [{ filePath }, { filePaths: filePath }, { filePaths: [filePath] }]) {
      expect(evaluateRecordedCall(test, 'load_wig_tracks', args).success).toBe(true);
    }
    for (const args of [{ filePath, filePaths: ['other.wig'] }, { filePaths: [filePath, 'other.wig'] }]) {
      expect(evaluateRecordedCall(test, 'load_wig_tracks', args).success).toBe(false);
    }
  });

  it('accepts the note or description field for an annotation update draft', () => {
    const test = suites.simple.getTests().find(test => test.id === 'annot_auto_05');
    const { identifier, updates } = test.expectedResult.parameters;
    for (const args of [
      { identifier, updates },
      { identifier, updates: { description: updates.note } },
    ]) {
      expect(evaluateRecordedCall(test, 'update_annotation', args).success).toBe(true);
      expect(evaluateRecordedCall(test, 'update_annotation', args, false).success).toBe(false);
    }
    expect(
      evaluateRecordedCall(test, 'update_annotation', { identifier, updates: { product: updates.note } }).success
    ).toBe(false);
    expect(test.verifyExecution({ applied: true, changeSet: { status: 'awaiting_approval' } })).toBe(false);
    expect(test.verifyExecution({ applied: false, changeSet: { status: 'awaiting_approval' } })).toBe(true);
  });

  it('distinguishes the visible FASTA export from the whole-genome export', () => {
    const test = suites.simple.getTests().find(test => test.id === 'export_auto_07');
    const { filename } = test.expectedResult.parameters;
    const args = { filename, sequence_type: 'current_view' };
    expect(evaluateRecordedCall(test, 'export_fasta_sequence', args).success).toBe(true);
    expect(evaluateRecordedCall(test, 'export_fasta_sequence', args, false).success).toBe(false);
    expect(evaluateRecordedCall(test, 'export_fasta_sequence', { filename }).success).toBe(false);
    expect(evaluateRecordedCall(test, 'export_current_view_fasta', { filename }).success).toBe(true);
    const wholeGenome = suites.simple.getTests().find(test => test.id === 'export_auto_01');
    const genomeFilename = wholeGenome.expectedResult.parameters.filename;
    expect(evaluateRecordedCall(wholeGenome, 'export_fasta_sequence', { filename: genomeFilename }).success).toBe(true);
    expect(
      evaluateRecordedCall(wholeGenome, 'export_fasta_sequence', { ...args, filename: genomeFilename }).success
    ).toBe(false);
  });

  it('accepts the standard genetic-code ID from the recorded translation call', () => {
    const test = suites.simple.getTests().find(candidate => candidate.id === 'seq_auto_03');
    const { dna } = test.expectedResult.parameters;
    const score = args => evaluateRecordedCall(test, 'translate_dna', { dna, ...args });
    expect(score({ genetic_code: '1', include_stop_codons: true }).success).toBe(true);
    expect(score({ genetic_code: 'standard' }).success).toBe(true);
    expect(score({}).success).toBe(true);
    expect(score({ genetic_code: '2' }).success).toBe(false);
    expect(score({ genetic_code: 1 }).success).toBe(false);
  });

  it('checks the requested UniProt filters and lets the caller choose an unspecified limit', () => {
    const test = suites.simple.getTests().find(candidate => candidate.id === 'db_auto_01');
    const flat = { proteinName: 'beta-galactosidase', organism: 'Escherichia coli', reviewedOnly: true };
    const nested = {
      query_fields: { protein_name: flat.proteinName, organism: flat.organism },
      filters: { reviewed_only: true },
    };
    const score = (testCase, args) => evaluateRecordedCall(testCase, 'advanced_uniprot_search', args);

    for (const args of [flat, nested, { ...flat, max_results: 25 }]) {
      expect(score(test, args).success).toBe(true);
      expect(evaluateRecordedCall(test, 'advanced_uniprot_search', args, true, 'contract').success).toBe(true);
    }
    expect(score(test, { ...flat, reviewedOnly: false }).success).toBe(false);

    const limited = {
      ...test,
      expectedResult: { ...test.expectedResult, parameters: { ...test.expectedResult.parameters, limit: 25 } },
    };
    expect(score(limited, { ...flat, max_results: 25 }).success).toBe(true);
    expect(score(limited, { ...flat, max_results: 10 }).success).toBe(false);
    expect(score(limited, flat).success).toBe(false);
  });

  it('compares the effective arguments without rewriting the submitted schema', () => {
    const evaluator = new StrictAutomaticEvaluator({ assessmentMode: 'contract' });
    expect(
      evaluator.compareParameters({ identifier: 'lacZ' }, { gene_name: 'lacZ' }, 'get_coding_sequence').match
    ).toBe(true);
    expect(
      evaluator.compareParameters(
        { gene_name: 'lacZ', identifier: 'araA' },
        { gene_name: 'lacZ' },
        'get_coding_sequence'
      ).match
    ).toBe(false);
    expect(
      evaluator.compareParameters(
        { query: 'lacZ', searchType: 'gene_name' },
        { search_query: 'lacZ', search_type: 'gene_name' },
        'search_uniprot_database'
      ).match
    ).toBe(true);
    expect(evaluator.compareParameters({ frame: 0 }, { reading_frame: 1 }, 'translate_dna').match).toBe(true);
    expect(
      evaluator.compareParameters({ frame: 1, reading_frame: 1 }, { reading_frame: 1 }, 'translate_dna').match
    ).toBe(false);
    expect(
      evaluator.compareParameters(
        { includeStatistics: true, include_statistics: false },
        { include_statistics: false },
        'codon_usage_analysis'
      ).match
    ).toBe(true);
  });

  it('feeds downstream calls result fields from the current tool contracts', async () => {
    const cds = await buildBenchmarkToolResult('get_coding_sequence', { identifier: 'demo' });
    expect(cds.codingSequence).toHaveLength(cds.length);
    const translation = await buildBenchmarkToolResult('translate_dna', { dna: cds.codingSequence, frame: 0 });
    expect(translation.protein).toHaveLength(Math.floor(cds.length / 3));
    const workflow = suites.complex.getTests().find(candidate => candidate.id === 'analysis_auto_complex_03');
    expect(workflow.expectedResult.parameters[2].sequence).toBe('{translate_dna.protein}');

    const structure = await buildBenchmarkToolResult('fetch_alphafold_structure', { uniprotId: 'P04637' });
    expect(adapter.validateToolCall('open_protein_viewer', { data_ref: structure._dataRef }).valid).toBe(true);
    const search = await buildBenchmarkToolResult('search_uniprot_database', {
      query: 'dapA',
      searchType: 'gene_name',
      organism: 'Escherichia coli',
    });
    expect(search.results[0].uniprotId).toBe('P0A6L2');
    const entry = await buildBenchmarkToolResult('get_uniprot_entry', {
      uniprotId: search.results[0].uniprotId,
      includeSequence: false,
    });
    expect(entry.entry_info.uniprot_id).toBe('P0A6L2');
    expect(entry).not.toHaveProperty('protein_sequence');
  });

  it('keeps summary and detailed codon usage distinct in offline benchmark results', async () => {
    const args = { sequence: 'GCTNNNGCC' };
    const summary = await buildBenchmarkToolResult('codon_usage_analysis', { ...args, includeStatistics: false });
    expect(summary.totalCodons).toBe(2);
    expect(summary).not.toHaveProperty('codonUsage');
    const detailed = await buildBenchmarkToolResult('codon_usage_analysis', args);
    expect(detailed.codonCounts).toEqual({ GCT: 1, GCC: 1 });
    expect(await buildBenchmarkToolResult('codon_usage_analysis', { geneName: 'demo' })).toMatchObject({
      success: false,
    });
  });

  it.each([
    ['search_auto_02', 'search_annotations', { query: 'DNA Polymerase', limit: 50 }, { query: 'RNA Polymerase' }],
    ['search_auto_03', 'get_annotation', { identifier: 'b0344' }, { identifier: 'b0343' }],
  ])('accepts a successful alternative for %s and checks the lookup arguments', (id, toolName, args, wrongArgs) => {
    const test = suites.simple.getTests().find(candidate => candidate.id === id);
    expect(evaluateRecordedCall(test, toolName, args)).toMatchObject({
      success: true,
      score: 5,
      details: { executionRequired: true },
    });
    expect(evaluateRecordedCall(test, toolName, wrongArgs).success).toBe(false);
    expect(evaluateRecordedCall(test, toolName, args, false).success).toBe(false);
    expect(evaluateRecordedCall(test, toolName, args, null).success).toBe(false);
    expect(evaluateRecordedCall(test, toolName, args, true, 'contract').success).toBe(false);
    expect(evaluateRecordedCall(test, test.expectedResult.tool_name, test.expectedResult.parameters).success).toBe(
      true
    );
  });

  it('accepts generic GenBank export only with the requested format and destination', () => {
    const test = suites.simple.getTests().find(candidate => candidate.id === 'export_auto_02');
    const { filename } = test.expectedResult.parameters;
    const evaluateExport = (parameters, success = true) =>
      evaluateRecordedCall(test, 'export_data', parameters, success);

    for (const format of ['genbank', 'gb', 'gbk']) {
      expect(evaluateExport({ filename, format, auto_save: true })).toMatchObject({ success: true, score: 5 });
    }
    expect(evaluateExport({ filename }).success).toBe(true);
    expect(evaluateExport({ filename, format: 'fasta' }).success).toBe(false);
    expect(evaluateExport({ filename, format: 'GENBANK' }).details.schemasExact).toBe(false);
    expect(evaluateExport({ filename: '/tmp/wrong.gbk', format: 'genbank' }).success).toBe(false);
    expect(evaluateExport({ filename, format: 'genbank' }, false).success).toBe(false);
    expect(evaluateRecordedCall(test, 'export_genbank_format', { filename }).success).toBe(true);
  });
});
