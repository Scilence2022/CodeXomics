import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = process.cwd();
const SUITE_DIR = path.join(ROOT, 'src/renderer/modules/benchmark-suites');
const BENCHMARK_CSV_DIR = path.join(ROOT, 'docs/reference/benchmark-suites');
const SUITE_FILES = [
  'BenchmarkEvaluatorBase.js',
  'AutomaticSimpleSuite.js',
  'AutomaticComplexSuite.js',
  'ManualSuite.js',
  'ManualComplexSuite.js',
];
const SUITE_CLASSES = ['AutomaticSimpleSuite', 'AutomaticComplexSuite', 'ManualSuite', 'ManualComplexSuite'];

const BUILTIN_TOOL_EXEMPTIONS = {
  start_benchmark: 'Starts a nested benchmark run and can recursively mutate the active benchmark.',
  stop_benchmark: 'Stops the active benchmark run, so it cannot be part of a benchmark suite.',
  pause_benchmark: 'Pauses the active benchmark run, so it cannot be part of a benchmark suite.',
  resume_benchmark: 'Requires a paused benchmark run and mutates benchmark lifecycle state.',
  get_benchmark_results: 'Requires benchmark history and is covered by report/statistics unit tests.',
  export_benchmark_results: 'Requires completed benchmark results and is covered by report/export unit tests.',
  // Legacy aliases whose canonical counterparts are covered elsewhere.
  find_gene: 'Legacy alias of find_gene_by_name; canonical coverage lives in search_auto_01.',
  get_blast_databases: 'Legacy alias of blast_list_databases; canonical coverage lives in blast_auto_02.',
  advanced_blast_search: 'Legacy alias of blast_search_online; canonical coverage lives in ManualSuite.',
  batch_blast_search: 'Legacy alias of blast_search_batch; both share the blastSearchBatch method.',
  blast_search_batch:
    'Batch BLAST network orchestration; single-call BLAST behavior is covered by blast_search (blast_auto_03). Dropped from the automatic simple suite to avoid slow, network-dependent duplicate runs.',
};

function loadSuites() {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);

  for (const file of SUITE_FILES) {
    const source = fs.readFileSync(path.join(SUITE_DIR, file), 'utf-8');
    vm.runInContext(source, sandbox, { filename: file });
  }

  return SUITE_CLASSES.map(className => new sandbox.window[className]());
}

function collectExpectedTools(suites) {
  const tools = new Set();

  for (const suite of suites) {
    for (const test of suite.getTests()) {
      const expected = test.expectedResult || {};
      if (expected.tool_name) {
        tools.add(expected.tool_name);
      }
      if (Array.isArray(expected.tool_sequence)) {
        for (const tool of expected.tool_sequence.flat()) {
          tools.add(tool);
        }
      }
    }
  }

  return tools;
}

function parseBuiltInToolNames() {
  const source = fs.readFileSync(path.join(ROOT, 'tools_registry/builtin_tools_integration.js'), 'utf-8');
  return [...source.matchAll(/builtInToolsMap\.set\(['"]([^'"]+)['"]/g)].map(match => match[1]);
}

function parseCsvIds(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8').trim();
  const lines = text.split(/\r?\n/).slice(1);

  return lines.map(line => {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      const next = line[index + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        index++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    fields.push(current);
    return fields[1];
  });
}

describe('benchmark suite coverage', () => {
  it('keeps benchmark test IDs unique within every suite', () => {
    const suites = loadSuites();

    for (const suite of suites) {
      const ids = suite.getTests().map(test => test.id);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

      expect(duplicates, `${suite.constructor.name} duplicate IDs`).toEqual([]);
    }
  });

  it('covers every built-in tool in benchmark suites unless explicitly exempted', () => {
    const suites = loadSuites();
    const coveredTools = collectExpectedTools(suites);
    const builtInTools = parseBuiltInToolNames();
    const exemptions = new Set(Object.keys(BUILTIN_TOOL_EXEMPTIONS));
    const missing = builtInTools.filter(tool => !coveredTools.has(tool) && !exemptions.has(tool));

    expect(missing).toEqual([]);
    expect(builtInTools.filter(tool => exemptions.has(tool)).sort()).toEqual([...exemptions].sort());
  });

  it('keeps newly added complex workflows in the automatic complex suite', () => {
    const complexSuite = loadSuites().find(suite => suite.constructor.name === 'AutomaticComplexSuite');
    const testsById = new Map(complexSuite.getTests().map(test => [test.id, test]));

    const expectedWorkflows = {
      nav_auto_complex_02: ['highlight_region', 'list_highlights', 'remove_highlight', 'clear_highlights'],
      annotation_auto_complex_02: ['bulk_update_annotations', 'get_annotation_history'],
      task_auto_complex_01: ['add_task', 'list_tasks', 'update_task', 'delete_task', 'clear_tasks'],
      file_auto_complex_02: ['capture_screenshot', 'open_image_file'],
      blast_auto_complex_03: ['blast_create_database', 'blast_validate_database', 'blast_delete_database'],
      blast_auto_complex_04: ['blast_detect_sequence_type', 'blast_filter_results', 'blast_export_results'],
    };

    for (const [testId, tools] of Object.entries(expectedWorkflows)) {
      const test = testsById.get(testId);
      expect(test, `missing workflow ${testId}`).toBeTruthy();
      expect(test.complexity).toBe('complex');
      expect(test.evaluation).toBe('automatic');
      expect(test.expectedResult.tool_sequence.flat()).toEqual(expect.arrayContaining(tools));
    }
  });

  it('keeps exported automatic benchmark CSV files synchronized with suite definitions', () => {
    const suites = loadSuites();
    const automaticSuites = [
      ['AutomaticSimpleSuite', 'benchmark_AutomaticSimpleSuite.csv'],
      ['AutomaticComplexSuite', 'benchmark_AutomaticComplexSuite.csv'],
    ];

    for (const [className, csvFile] of automaticSuites) {
      const suite = suites.find(candidate => candidate.constructor.name === className);
      const suiteIds = suite
        .getTests()
        .map(test => test.id)
        .sort();
      const csvIds = parseCsvIds(path.join(BENCHMARK_CSV_DIR, csvFile)).sort();

      expect(csvIds, `${csvFile} IDs`).toEqual(suiteIds);
    }
  });
});
