/**
 * Golden-path guard for the Automatic Complex benchmark suite.
 *
 * Every test in this suite is scored by an evaluator, so a wrong expectation silently
 * caps the achievable success rate: the model does exactly what the instruction asks and
 * is still marked as failed. These tests pin both directions:
 *
 *   1. An ideal run (the tool calls the instruction asks for, with schema defaults omitted
 *      the way models actually omit them) must be scored as a success.
 *   2. Wrong or incomplete runs must still be scored as failures.
 *   3. Expectations must stay consistent with the tool registry: real tool names, real
 *      parameter names, and any value that merely restates a schema default wrapped in
 *      schemaDefault() so omitting it is not punished.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = process.cwd();
const SUITE_DIR = path.join(ROOT, 'src/renderer/modules/benchmark-suites');
const MANIFEST_PATH = path.join(ROOT, 'tools_registry/generated/tool-registry-manifest.json');
const BUILTIN_PATH = path.join(ROOT, 'tools_registry/builtin_tools_integration.js');

const DIR = './';
const PRIMER = 'ATGACCATGATTACGGATTCACT';
const DAPA_SEQUENCE =
  'MFTGSIVAIVTPMDEKGNVCRASLKKLIDYHVASGTSAIVSVGTTGESATLNHDEHADVVMMTLDLADGRIPVIAGTGANATAEAISLTQRFNDSGIVGCLTVTPYYNRPSQEGLYQHFKAIAEHTDLPQILYNVPSRTGCDLLPETVGRLAKVKNIIGIKEATGNLTRVNQIKELVSDDFVLLSGDDASALDFMQLGGHGVISVTANVAARDMAQMCKLAAEGHFAEARVINQRLMPLHNKLFVEPNPIPVKWACKELGLVATDTLRLPMTPITDSGRETVRAALKHAGLL';
const BLAST_QUERY =
  'TTAGTTGGCGTCATCAAAGCTGAAGACATCTTCGCAGGCTTGCTGCAATGCGCTGTCACTTTGGATATTGCAGTTGCGCGTCCAGCCGGTGACGCCGTTGCGTTATCCCAACCCGGTGTCATGACGACGCTTAGCCCATTAGACTTTCTTGCCCGGTCAGCGACACC';

/**
 * The tool calls a competent model makes for each test. Parameters whose value is the
 * tool's schema default are deliberately omitted here — that is what models do, and the
 * resulting behaviour is identical to sending them.
 */
const GOLDEN_RUNS = {
  file_auto_01: [
    ['load_genome_file', { filePath: DIR + 'ECOLI.gbk' }],
    ['load_reads_file', { filePath: DIR + '1655_C10.sorted.bam' }],
    ['load_variant_file', { filePath: DIR + '1655_C10.mutations.vcf' }],
    ['load_wig_tracks', { filePaths: [DIR + 'sample.wig', DIR + 'another_sample.wig'] }],
  ],
  nav_auto_01: [
    ['navigate_to_position', { start: 1230000, end: 1300000 }],
    ['zoom_in', { factor: 10 }],
  ],
  nav_auto_complex_02: [
    ['navigate_to_position', { start: 110000, end: 112000 }],
    ['highlight_region', { start: 110000, end: 112000, label: 'benchmark_focus' }],
    ['list_highlights', {}],
    ['remove_highlight', { start: 110000, end: 112000 }],
    ['clear_highlights', {}],
    ['save_view_state', { name: 'benchmark smoke view' }],
    ['navigate_to_position', { start: 130000, end: 131000 }],
    ['restore_view_state', { name: 'benchmark smoke view' }],
    ['bookmark_position', { name: 'Test bookmark', start: 120000, end: 121000 }],
  ],
  analysis_auto_01: [
    ['calc_region_gc', {}],
    ['export_bed_format', { filePath: DIR + 'exported_files/region_features.bed' }],
  ],
  analysis_auto_02: [
    ['get_genome_info', {}],
    ['genome_codon_usage_analysis', {}],
    ['calc_region_gc', {}],
  ],
  analysis_auto_complex_03: [
    ['get_coding_sequence', { geneName: 'lacZ' }],
    ['translate_dna', { dna: 'ATGACCATG', readingFrame: 1 }],
    ['calculate_molecular_weight', { sequence: 'MTM', type: 'protein' }],
  ],
  analysis_auto_complex_05: [
    ['navigate_to_position', { start: 100000, end: 101000 }],
    ['get_sequence', { start: 100000, end: 101000 }],
    ['calculate_entropy', { sequence: 'ATGC' }],
    ['reverse_complement', { sequence: 'ATGC' }],
    ['translate_dna', { dna: 'ATGC' }],
  ],
  restrict_auto_01: [['virtual_digest', { enzymes: ['EcoRI', 'HindIII'] }]],
  gel_auto_01: [
    ['virtual_digest', { enzymes: ['EcoRI', 'HindIII'] }],
    ['simulate_gel_electrophoresis', { fragments: [{ size: 1200 }] }],
  ],
  gel_auto_03: [
    ['virtual_digest', { enzymes: ['NotI', 'SalI'] }],
    ['simulate_gel_electrophoresis', { fragments: [{ size: 1200 }], gelPercentage: 0.8, ladderType: 'lambda_hindiii' }],
  ],
  gel_auto_workflow_02: [
    ['find_restriction_sites', { enzyme: 'EcoRI' }],
    ['virtual_digest', { enzymes: ['EcoRI', 'HindIII'] }],
    ['simulate_gel_electrophoresis', { fragments: [{ size: 1200 }], bandColorScheme: 'methylene_blue' }],
  ],
  annotation_auto_complex_01: [
    [
      'create_annotation',
      { name: 'regulatory_region_A', chromosome: 'U00096', start: 150000, end: 150500, type: 'regulatory' },
    ],
    [
      'update_annotation',
      { identifier: 'regulatory_region_A', updates: { note: 'Highly conserved regulatory region' } },
    ],
    ['list_annotations', { chromosome: 'U00096', start: 150000, end: 150500 }],
  ],
  annotation_auto_complex_02: [
    [
      'create_annotation',
      { name: 'benchmark_bulk_gene', chromosome: 'U00096', start: 160000, end: 160900, type: 'CDS' },
    ],
    [
      'bulk_update_annotations',
      { updates: [{ identifier: 'benchmark_bulk_gene', updates: { description: 'Bulk benchmark annotation' } }] },
    ],
    ['get_annotation_history', { identifier: 'benchmark_bulk_gene' }],
    ['list_annotations', { chromosome: 'U00096', start: 160000, end: 160900 }],
  ],
  // Deliberately hides Variants before showing GC: the two toggles are independent.
  track_auto_complex_01: [
    ['get_track_status', {}],
    ['toggle_track', { track_name: 'Variants', visible: false }],
    ['toggle_track', { track_name: 'gc', visible: true }],
    ['get_track_status', {}],
  ],
  task_auto_complex_01: [
    ['clear_tasks', { confirm: true }],
    ['add_task', { title: 'Benchmark complex task', status: 'in_progress', progress: 10 }],
    ['list_tasks', { status: 'in_progress' }],
    ['update_task', { id: 'task-1', status: 'completed', progress: 100 }],
    ['delete_task', { id: 'task-1' }],
    ['list_tasks', {}],
  ],
  primer_auto_01: [['design_primers', { geneName: 'lacZ' }]],
  primer_auto_complex_01: [
    ['design_primers', { geneName: 'lacZ' }],
    ['calculate_primer_properties', { sequence: PRIMER }],
    ['find_primer_binding_sites', { sequence: PRIMER, maxMismatches: 2 }],
  ],
  primer_auto_complex_02: [
    ['design_primers', { geneName: 'lysC', upstreamBp: 50 }],
    ['save_primer', { name: 'lysC_F', chromosome: 'U00096', start: 4225000, end: 4225020, sequence: 'ATGCGTAAAGTC' }],
    ['jump_to_gene', { geneName: 'lysC' }],
    ['toggle_track', { track_name: 'primers', visible: true }],
  ],
  export_auto_complex_01: [
    ['export_fasta_sequence', { filePath: DIR + 'exported_files/exported_sequences.fasta' }],
    ['export_genbank_format', { filePath: DIR + 'exported_files/exported_data.gbk' }],
    ['export_gff_annotations', { filePath: DIR + 'exported_files/exported_annotations.gff3' }],
    ['export_bed_format', { filePath: DIR + 'exported_files/exported_features.bed' }],
    ['export_cds_fasta', { filePath: DIR + 'exported_files/exported_cds.fasta' }],
    ['export_protein_fasta', { filePath: DIR + 'exported_files/exported_proteins.fasta' }],
  ],
  export_auto_complex_02: [
    ['navigate_to_position', { start: 100000, end: 120000 }],
    ['export_current_view_fasta', { filePath: DIR + 'exported_files/current_view_region.fasta' }],
  ],
  file_auto_complex_02: [
    [
      'capture_screenshot',
      { target: 'tracks', mode: 'visible', filePath: DIR + 'exported_files/benchmark_tracks_review.png' },
    ],
    ['open_image_file', { filePath: DIR + 'exported_files/benchmark_tracks_review.png' }],
  ],
  ui_auto_01: [
    ['open_new_tab', {}],
    ['open_new_tab', {}],
    ['open_new_tab', {}],
    ['open_new_tab', {}],
    ['open_new_tab', {}],
  ],
  ui_auto_complex_02: [
    ['open_new_tab', {}],
    ['switch_to_tab', { tabIndex: 2 }],
    ['close_tab', {}],
  ],
  protein_auto_complex_01: [
    ['get_uniprot_entry', { uniprot_id: 'P04637' }],
    ['fetch_alphafold_structure', { uniprot_id: 'P04637' }],
    ['open_protein_viewer', { data_ref: 'dataref://alphafold/P04637' }],
  ],
  // Uses the abbreviated organism name and runs the PDB lookup early, both of which are legitimate.
  protein_auto_complex_02: [
    ['search_uniprot_database', { search_query: 'DapA', organism: 'E. coli' }],
    ['search_pdb_structures', { geneName: 'dapA', organism: 'E. coli' }],
    ['get_uniprot_entry', { uniprot_id: 'P0A6L2', include_sequence: true }],
    ['analyze_interpro_domains', { sequence: DAPA_SEQUENCE, analysis_type: 'domains' }],
  ],
  blast_auto_complex_01: [
    ['blast_create_db_from_genome', { chromosome: 'U00096', dbName: 'ecoli_nucl' }],
    ['blast_list_databases', {}],
    ['blast_search_local', { sequence: BLAST_QUERY, blastType: 'blastn', database: 'ecoli_nucl' }],
  ],
  blast_auto_complex_02: [
    ['blast_create_protein_db_from_genome', { chromosome: 'U00096', dbName: 'Ecoli_protein' }],
    ['blast_list_databases', {}],
    [
      'blast_search_local',
      { sequence: 'MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQ', blastType: 'blastp', database: 'Ecoli_protein' },
    ],
  ],
  blast_auto_complex_03: [
    ['export_current_view_fasta', { filePath: DIR + 'exported_files/benchmark_blast_input.fasta' }],
    [
      'blast_create_database',
      {
        inputFile: DIR + 'exported_files/benchmark_blast_input.fasta',
        dbName: 'benchmark_view_nucl',
        dbType: 'nucl',
      },
    ],
    ['blast_validate_database', { dbName: 'benchmark_view_nucl' }],
    ['blast_list_databases', {}],
    ['blast_delete_database', { dbName: 'benchmark_view_nucl', confirm: true }],
  ],
  blast_auto_complex_04: [
    ['blast_detect_sequence_type', { sequence: 'ATGAAAGCGCTGAAAGCGCTG' }],
    ['blast_search', { sequence: 'ATGAAAGCGCTGAAAGCGCTG', database: 'nt', maxTargets: 5 }],
    ['blast_filter_results', { results: [{ identity: 95 }], minIdentity: 90, maxHits: 5 }],
    [
      'blast_export_results',
      { searchId: 'search-1', format: 'csv', outputPath: DIR + 'exported_files/benchmark_blast_results.csv' },
    ],
  ],
};

const WRONG_RUNS = [
  {
    label: 'toggles the tracks to the opposite visibility',
    testId: 'track_auto_complex_01',
    calls: [
      ['get_track_status', {}],
      ['toggle_track', { track_name: 'Variants', visible: true }],
      ['toggle_track', { track_name: 'gc', visible: false }],
      ['get_track_status', {}],
    ],
  },
  {
    label: 'runs the gel with the wrong ladder and percentage',
    testId: 'gel_auto_01',
    calls: [['simulate_gel_electrophoresis', { fragments: [{ size: 1 }], gelPercentage: 2.5, ladderType: '100bp' }]],
  },
  {
    label: 'runs a protein BLAST when a nucleotide BLAST was requested',
    testId: 'blast_auto_complex_04',
    calls: [
      ['blast_detect_sequence_type', { sequence: 'ATGAAAGCGCTGAAAGCGCTG' }],
      ['blast_search', { sequence: 'ATGAAAGCGCTGAAAGCGCTG', blastType: 'blastp', database: 'nt', maxTargets: 5 }],
      ['blast_filter_results', { results: [], minIdentity: 90, maxHits: 5 }],
      ['blast_export_results', { searchId: 's', format: 'csv', outputPath: DIR + 'x.csv' }],
    ],
  },
  {
    label: 'stops before saving and restoring the view',
    testId: 'nav_auto_complex_02',
    calls: [
      ['navigate_to_position', { start: 110000, end: 112000 }],
      ['highlight_region', { start: 110000, end: 112000, label: 'benchmark_focus' }],
      ['list_highlights', {}],
    ],
  },
  {
    label: 'annotates the wrong coordinates',
    testId: 'annotation_auto_complex_01',
    calls: [
      [
        'create_annotation',
        { name: 'regulatory_region_A', chromosome: 'U00096', start: 99, end: 500, type: 'regulatory' },
      ],
      [
        'update_annotation',
        { identifier: 'regulatory_region_A', updates: { note: 'Highly conserved regulatory region' } },
      ],
      ['list_annotations', { chromosome: 'U00096', start: 99, end: 500 }],
    ],
  },
  { label: 'opens a single tab instead of five', testId: 'ui_auto_01', calls: [['open_new_tab', {}]] },
  {
    label: 'every tab call failed',
    testId: 'ui_auto_01',
    failed: true,
    calls: [
      ['open_new_tab', {}],
      ['open_new_tab', {}],
      ['open_new_tab', {}],
      ['open_new_tab', {}],
      ['open_new_tab', {}],
    ],
  },
  {
    label: 'queries the human protein instead of the E. coli one',
    testId: 'protein_auto_complex_02',
    calls: [
      ['search_uniprot_database', { search_query: 'DapA', organism: 'Homo sapiens' }],
      ['get_uniprot_entry', { uniprot_id: 'P0A6L2' }],
      ['analyze_interpro_domains', { sequence: DAPA_SEQUENCE, analysis_type: 'domains' }],
      ['search_pdb_structures', { geneName: 'dapA', organism: 'Homo sapiens' }],
    ],
  },
  {
    label: 'designs primers for the wrong gene',
    testId: 'primer_auto_complex_01',
    calls: [
      ['design_primers', { geneName: 'araA' }],
      ['calculate_primer_properties', { sequence: PRIMER }],
      ['find_primer_binding_sites', { sequence: PRIMER, maxMismatches: 2 }],
    ],
  },
  { label: 'only clears the checklist', testId: 'task_auto_complex_01', calls: [['clear_tasks', { confirm: true }]] },
  { label: 'loads no files at all', testId: 'file_auto_01', calls: [] },
];

function loadSuite(trackerState = { session: [], currentTestId: null }) {
  const sandbox = {
    window: {
      chatManager: {
        toolExecutionTracker: {
          get currentTestId() {
            return trackerState.currentTestId;
          },
          getSessionExecutions: () => trackerState.session,
          getTestExecutions: testId => trackerState.session.filter(execution => execution.testId === testId),
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
  for (const file of ['BenchmarkEvaluatorBase.js', 'AutomaticComplexSuite.js']) {
    vm.runInContext(fs.readFileSync(path.join(SUITE_DIR, file), 'utf-8'), sandbox, { filename: file });
  }
  return new sandbox.window.AutomaticComplexSuite();
}

function buildRun(calls, { failed = false } = {}) {
  const executedFunctionCalls = calls.map(([tool_name, parameters]) => ({
    tool_name,
    parameters,
    success: !failed,
    status: failed ? 'failed' : 'completed',
  }));

  return {
    content: 'All requested steps have been completed successfully.',
    executedFunctionCalls: executedFunctionCalls.length > 0 ? executedFunctionCalls : undefined,
    functionCalls: executedFunctionCalls,
    parseDebugInfo: { detectedTools: executedFunctionCalls.map(call => ({ tool: call.tool_name })) },
  };
}

async function evaluateRun(test, actualResult) {
  return test.evaluator(actualResult, test.expectedResult, {
    testId: test.id,
    maxScore: test.maxScore,
    category: test.category,
    complexity: test.complexity,
    earlyReturn: test.earlyReturn || false,
    actualResult,
    parseDebugInfo: actualResult.parseDebugInfo,
  });
}

const normalizeKey = value => String(value).replace(/[-_]/g, '').toLowerCase();

describe('AutomaticComplexSuite golden paths', () => {
  let suite;
  let tests;

  beforeAll(() => {
    suite = loadSuite();
    tests = new Map(suite.getTests().map(test => [test.id, test]));
  });

  it('defines a golden run for every test in the suite', () => {
    expect(Object.keys(GOLDEN_RUNS).sort()).toEqual([...tests.keys()].sort());
  });

  it('scores an ideal run as a success for every test', async () => {
    const failures = [];

    for (const [testId, calls] of Object.entries(GOLDEN_RUNS)) {
      const test = tests.get(testId);
      const evaluation = await evaluateRun(test, buildRun(calls));
      if (!evaluation.success) {
        failures.push(`${testId}: ${evaluation.score}/${evaluation.maxScore} — ${evaluation.errors.join('; ')}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('still scores an ideal run as a success when the model adds exploratory calls', async () => {
    const failures = [];

    for (const [testId, calls] of Object.entries(GOLDEN_RUNS)) {
      const test = tests.get(testId);
      const padded = [['get_current_state', {}], ...calls, ['get_genome_info', {}]];
      const evaluation = await evaluateRun(test, buildRun(padded));
      if (!evaluation.success) {
        failures.push(`${testId}: ${evaluation.score}/${evaluation.maxScore} — ${evaluation.errors.join('; ')}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('scores wrong or incomplete runs as failures', async () => {
    const leaks = [];

    for (const wrongRun of WRONG_RUNS) {
      const test = tests.get(wrongRun.testId);
      const evaluation = await evaluateRun(test, buildRun(wrongRun.calls, { failed: wrongRun.failed }));
      if (evaluation.success) {
        leaks.push(`${wrongRun.testId} (${wrongRun.label}) was scored as a success`);
      }
    }

    expect(leaks).toEqual([]);
  });
});

describe('AutomaticComplexSuite evaluation from the execution tracker', () => {
  const NOW = Date.now();
  const trackerCall = (testId, toolName, parameters, secondsAgo) => ({
    testId,
    toolName,
    parameters,
    status: 'completed',
    success: true,
    startTime: NOW - secondsAgo * 1000,
  });

  // A response with no structured tool calls: evaluation has to come from the tracker.
  const TEXT_ONLY_RESULT = { content: 'I navigated, highlighted, saved, restored and bookmarked as requested.' };

  const currentTestCalls = [
    trackerCall('nav_auto_complex_02', 'navigate_to_position', { start: 110000, end: 112000 }, 9),
    trackerCall('nav_auto_complex_02', 'highlight_region', { start: 110000, end: 112000, label: 'benchmark_focus' }, 8),
    trackerCall('nav_auto_complex_02', 'list_highlights', {}, 7),
    trackerCall('nav_auto_complex_02', 'remove_highlight', { start: 110000, end: 112000 }, 6),
    trackerCall('nav_auto_complex_02', 'clear_highlights', {}, 5),
    trackerCall('nav_auto_complex_02', 'save_view_state', { name: 'benchmark smoke view' }, 4),
    trackerCall('nav_auto_complex_02', 'navigate_to_position', { start: 130000, end: 131000 }, 3),
    trackerCall('nav_auto_complex_02', 'restore_view_state', { name: 'benchmark smoke view' }, 2),
    trackerCall('nav_auto_complex_02', 'bookmark_position', { name: 'Test bookmark', start: 120000, end: 121000 }, 1),
  ];

  // The tracker session spans the whole run, so an earlier test's navigation is still in it.
  const priorTestCalls = [
    trackerCall('nav_auto_01', 'navigate_to_position', { start: 1230000, end: 1300000 }, 30),
    trackerCall('nav_auto_01', 'zoom_in', { factor: 10 }, 29),
  ];

  const evaluateWithTracker = async (session, currentTestId, testId) => {
    const suite = loadSuite({ session, currentTestId });
    const test = suite.getTests().find(candidate => candidate.id === testId);
    return test.evaluator(TEXT_ONLY_RESULT, test.expectedResult, {
      testId: test.id,
      maxScore: test.maxScore,
      category: test.category,
      timeout: test.timeout,
      actualResult: TEXT_ONLY_RESULT,
    });
  };

  it('scores a correct run even though an earlier test navigated elsewhere', async () => {
    const evaluation = await evaluateWithTracker(
      [...priorTestCalls, ...currentTestCalls],
      'nav_auto_complex_02',
      'nav_auto_complex_02'
    );

    expect(evaluation.errors).toEqual([]);
    expect(evaluation.success).toBe(true);
  });

  it('scores a correct run when the tracker records carry no test id', async () => {
    const unstamped = [...priorTestCalls, ...currentTestCalls].map(call => ({ ...call, testId: undefined }));
    const evaluation = await evaluateWithTracker(unstamped, 'nav_auto_complex_02', 'nav_auto_complex_02');

    expect(evaluation.success).toBe(true);
  });

  it('does not pass a run that stopped halfway through the workflow', async () => {
    const evaluation = await evaluateWithTracker(
      [...priorTestCalls, ...currentTestCalls.slice(0, 4)],
      'nav_auto_complex_02',
      'nav_auto_complex_02'
    );

    expect(evaluation.success).toBe(false);
  });

  it('does not credit a long navigation workflow for a bare navigate call', async () => {
    const evaluation = await evaluateWithTracker(
      [trackerCall('nav_auto_complex_02', 'navigate_to_position', { start: 110000, end: 112000 }, 5)],
      'nav_auto_complex_02',
      'nav_auto_complex_02'
    );

    expect(evaluation.success).toBe(false);
  });
});

describe('AutomaticComplexSuite expectations match the tool registry', () => {
  let suite;
  let toolsByName;
  let builtInToolNames;

  beforeAll(() => {
    suite = loadSuite();
    toolsByName = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')).toolsByName;
    const builtInSource = fs.readFileSync(BUILTIN_PATH, 'utf-8');
    builtInToolNames = new Set([...builtInSource.matchAll(/builtInToolsMap\.set\(['"]([^'"]+)['"]/g)].map(m => m[1]));
  });

  const lookupTool = (name, registry) =>
    registry[name] || registry[Object.keys(registry).find(key => normalizeKey(key) === normalizeKey(name)) || ''];

  const forEachStep = (suiteInstance, visit) => {
    for (const test of suiteInstance.getTests()) {
      const expected = test.expectedResult || {};
      const sequence = Array.isArray(expected.tool_sequence)
        ? expected.tool_sequence
        : expected.tool_name
          ? [expected.tool_name]
          : [];
      const parameters = Array.isArray(expected.parameters) ? expected.parameters : [expected.parameters || {}];

      sequence.forEach((step, index) => {
        const alternatives = Array.isArray(step) ? step : [step];
        visit(test, alternatives, parameters[index] || {}, index);
      });
    }
  };

  it('only expects tools that exist in the registry', () => {
    const unknown = [];

    forEachStep(suite, (test, alternatives) => {
      for (const name of alternatives) {
        if (!lookupTool(name, toolsByName) && !builtInToolNames.has(name)) {
          unknown.push(`${test.id}: ${name}`);
        }
      }
    });

    expect(unknown).toEqual([]);
  });

  it('only expects parameters that exist in the tool schema', () => {
    // Parameter names the evaluator accepts as interchangeable with a schema property.
    const aliases = new Set([
      'filepath',
      'filename',
      'path',
      'outputpath',
      'inputfile',
      'database',
      'dbname',
      'tabindex',
    ]);
    const unknown = [];

    forEachStep(suite, (test, alternatives, params) => {
      const tool = alternatives.map(name => lookupTool(name, toolsByName)).find(Boolean);
      const properties = tool?.parameters?.properties;
      if (!properties) return;

      const propertyKeys = new Set(Object.keys(properties).map(normalizeKey));
      for (const key of Object.keys(params)) {
        const normalized = normalizeKey(key);
        if (!propertyKeys.has(normalized) && !aliases.has(normalized)) {
          unknown.push(`${test.id}: ${tool.name}.${key}`);
        }
      }
    });

    expect(unknown).toEqual([]);
  });

  it('wraps every expectation that merely restates a schema default', () => {
    // Models omit parameters that match the tool default, and the tool behaves identically,
    // so an unwrapped default value would fail runs that were entirely correct.
    const unwrapped = [];

    forEachStep(suite, (test, alternatives, params) => {
      const tool = alternatives.map(name => lookupTool(name, toolsByName)).find(Boolean);
      const properties = tool?.parameters?.properties;
      if (!properties) return;

      for (const [key, value] of Object.entries(params)) {
        if (suite.isSchemaDefaultExpectation(value)) continue;
        const propertyKey = Object.keys(properties).find(pk => normalizeKey(pk) === normalizeKey(key));
        if (!propertyKey) continue;
        const schemaDefault = properties[propertyKey].default;
        if (schemaDefault !== undefined && schemaDefault === value) {
          unwrapped.push(`${test.id}: ${tool.name}.${key} = ${JSON.stringify(value)} (use this.schemaDefault(...))`);
        }
      }
    });

    expect(unwrapped).toEqual([]);
  });

  it('only expects enum values the tool actually accepts', () => {
    const invalid = [];

    forEachStep(suite, (test, alternatives, params) => {
      const tool = alternatives.map(name => lookupTool(name, toolsByName)).find(Boolean);
      const properties = tool?.parameters?.properties;
      if (!properties) return;

      for (const [key, rawValue] of Object.entries(params)) {
        const value = suite.unwrapExpectedValue(rawValue);
        if (typeof value !== 'string' || value.startsWith('<') || value.startsWith('{')) continue;
        const propertyKey = Object.keys(properties).find(pk => normalizeKey(pk) === normalizeKey(key));
        const enumValues = propertyKey ? properties[propertyKey].enum : null;
        if (Array.isArray(enumValues) && !enumValues.map(normalizeKey).includes(normalizeKey(value))) {
          invalid.push(`${test.id}: ${tool.name}.${key} = "${value}" not in [${enumValues.join(', ')}]`);
        }
      }
    });

    expect(invalid).toEqual([]);
  });
});
