import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const require = createRequire(import.meta.url);
const DynamicToolsSnapshotAdapter = require('../../src/renderer/modules/DynamicToolsSnapshotAdapter.js');

const ROOT = process.cwd();
const SUITE_DIR = path.join(ROOT, 'src/renderer/modules/benchmark-suites');
const MANIFEST_PATH = path.join(ROOT, 'tools_registry/generated/tool-registry-manifest.json');

function loadAutomaticSuites() {
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
  for (const file of ['BenchmarkEvaluatorBase.js', 'AutomaticSimpleSuite.js', 'AutomaticComplexSuite.js']) {
    vm.runInContext(fs.readFileSync(path.join(SUITE_DIR, file), 'utf-8'), sandbox, { filename: file });
  }
  return {
    simple: new sandbox.window.AutomaticSimpleSuite(),
    complex: new sandbox.window.AutomaticComplexSuite(),
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
  const ownEntries = Object.entries(value).filter(([key]) => key !== 'benchmarkAnyOf');
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

describe('automatic benchmark contracts against the current tool registry', () => {
  let suites;
  let adapter;

  beforeAll(() => {
    suites = loadAutomaticSuites();
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

    for (const suite of [suites.simple, suites.complex]) {
      for (const test of suite.getTests()) {
        for (const step of expectedSteps(test)) {
          stepCount += 1;
          const candidates = expandExpectedValue(step.parameters);
          for (const toolName of step.toolNames) {
            alternativeCount += 1;
            const tool = adapter.toolsByName.get(toolName);
            if (!tool) {
              invalid.push(`${test.id}: unknown tool ${toolName}`);
              continue;
            }

            const schema = adapter.sanitizeNativeSchema(adapter.normalizeToolSchema(tool), true);
            const attempts = candidates.map(candidate => {
              const parameters = materializeExpected(candidate, schema);
              return { parameters, result: adapter.validateToolCall(toolName, parameters) };
            });
            if (attempts.some(attempt => attempt.result.valid)) continue;

            invalid.push(
              `${test.id}: ${toolName} ${attempts
                .map(attempt => `${JSON.stringify(attempt.parameters)} => ${attempt.result.errors.join(', ')}`)
                .join(' | ')}`
            );
          }
        }
      }
    }

    expect(invalid, `Audited ${stepCount} expected steps and ${alternativeCount} alternative tool contracts`).toEqual(
      []
    );
  });
});
