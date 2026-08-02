'use strict';

/**
 * Domain-shaped contract tool results for offline benchmark harnesses.
 *
 * The old harness acknowledged every call with
 * `{ acknowledged: true, domain_result_available: false }`, which made
 * dependent multi-step workflows impossible to complete: the model never
 * received the sequence, fragment, task id, primer coordinates, or tab id
 * that the next step must reference. This provider returns deterministic,
 * schema-shaped results for every registry tool. When the call can be
 * executed by the pinned deterministic fixture corpus, the fixture result is
 * used verbatim; otherwise a seeded synthetic result with the fields the
 * benchmark workflows reference is returned.
 */

const { executeTool, CORE_FIXTURE_ID, UNIPROT_FIXTURE_ID } = require('./deterministic-fixture-corpus.js');

function hashCode(value) {
  let hash = 2166136261;
  for (const symbol of String(value)) {
    hash ^= symbol.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededDna(length, seed) {
  const bases = ['A', 'C', 'G', 'T'];
  let state = hashCode(seed);
  let output = '';
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    output += bases[state % 4];
  }
  return output;
}

function translateDna(dna, readingFrame = 1) {
  const table = {
    TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L', TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S',
    TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*', TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W',
    CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L', CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
    CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q', CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
    ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M', ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
    AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K', AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
    GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V', GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
    GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E', GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
  };
  const upper = String(dna || '').toUpperCase();
  let protein = '';
  for (let offset = Math.max(0, Number(readingFrame) - 1); offset + 2 < upper.length; offset += 3) {
    protein += table[upper.slice(offset, offset + 3)] || 'X';
  }
  return protein;
}

function gcContent(sequence) {
  const upper = String(sequence || '').toUpperCase();
  const valid = [...upper].filter(base => ['A', 'C', 'G', 'T'].includes(base));
  if (valid.length === 0) return 0;
  return Math.round(((valid.filter(base => base === 'G' || base === 'C').length / valid.length) * 1000)) / 10;
}

function reverseComplement(sequence) {
  const complements = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' };
  return String(sequence || '')
    .toUpperCase()
    .split('')
    .reverse()
    .map(base => complements[base] || 'N')
    .join('');
}

function geneCoordinates(seed) {
  const state = hashCode(seed);
  const start = 100000 + (state % 900000);
  return { chromosome: 'U00096', start, end: start + 800 + (state % 400), strand: '+' };
}

function annotationId(seed) {
  return `user_${Math.abs(hashCode(seed)) % 1000}_${hashCode(`${seed}:id`).toString(16).slice(0, 6)}`;
}

function primerCoordinates(seed) {
  const state = hashCode(seed);
  const start = 100000 + (state % 500000);
  const end = start + 18 + (state % 6);
  return { chromosome: 'U00096', start, end };
}

const DEFAULT_TRACKS = {
  genes: { visible: true },
  gc_content: { visible: true },
  sequence: { visible: true },
  variants: { visible: false },
  reads: { visible: false },
  proteins: { visible: false },
  primers: { visible: false },
  actions: { visible: false },
  wigTracks: { visible: false },
  blast: { visible: false },
};

function fixtureFirst(fixtureId, call) {
  try {
    const result = executeTool(fixtureId, call);
    if (result && typeof result === 'object') return result;
  } catch (_error) {
    // Fall through to the synthetic result.
  }
  return null;
}

/**
 * @param {string} toolName
 * @param {object} parameters raw model-supplied parameters
 * @returns {object} deterministic domain-shaped result
 */
function buildContractToolResult(toolName, parameters = {}) {
  const uniprotTools = new Set([
    'search_uniprot_database',
    'get_uniprot_entry',
    'analyze_interpro_domains',
    'advanced_uniprot_search',
    'get_interpro_entry_details',
  ]);
  // UniProt tools must try the UniProt fixture first: the core fixture returns
  // an empty entries array instead of throwing, which would break reference
  // resolution for chained UniProt calls.
  const fixtureResult = uniprotTools.has(toolName)
    ? fixtureFirst(UNIPROT_FIXTURE_ID, { tool_name: toolName, parameters }) ||
      fixtureFirst(CORE_FIXTURE_ID, { tool_name: toolName, parameters })
    : fixtureFirst(CORE_FIXTURE_ID, { tool_name: toolName, parameters }) ||
      fixtureFirst(UNIPROT_FIXTURE_ID, { tool_name: toolName, parameters });
  if (fixtureResult) return fixtureResult;

  const seed = `${toolName}:${JSON.stringify(parameters || {})}`;
  const chromosome = parameters.chromosome || 'U00096';
  const start = Number(parameters.start) || 1;
  const end = Number(parameters.end) || start + 99;
  const strand = parameters.strand || '+';
  const sequence = String(parameters.sequence || parameters.dna || parameters.primerSequence || parameters.templateSequence || '');
  const dna = sequence || seededDna(Math.max(1, end - start + 1), seed);

  switch (toolName) {
    case 'get_sequence':
    case 'get_coding_sequence': {
      // Cap returned sequences so models can pass values literally without
      // exhausting the token budget; references still resolve to full data.
      const capped = dna.slice(0, 120);
      return {
        success: true,
        sequence: capped,
        length: capped.length,
        chromosome,
        start,
        end,
        strand,
        format: parameters.format || 'raw',
      };
    }
    case 'reverse_complement':
      return { success: true, original_sequence: sequence, reverse_complement: reverseComplement(sequence), sequence_length: sequence.length, validation_passed: true };
    case 'translate_dna':
    case 'translate_sequence': {
      const readingFrame = Number(parameters.reading_frame) || 1;
      const protein = translateDna(dna, readingFrame);
      return {
        success: true,
        original_sequence: dna,
        amino_acid_sequence: protein,
        reading_frame: readingFrame,
        genetic_code_used: 'standard',
        sequence_length: dna.length,
        protein_length: protein.length,
      };
    }
    case 'compute_gc':
      return { success: true, gcContent: gcContent(sequence), sequence, length: sequence.length };
    case 'calculate_entropy':
      return { success: true, entropy: Math.round(gcContent(sequence) / 10 * 100) / 100, sequence, length: sequence.length };
    case 'calculate_molecular_weight':
      return { success: true, molecularWeight: Math.round(300 * dna.length * 10) / 10, dna, sequence: dna, length: dna.length };
    case 'calculate_primer_properties':
      return { success: true, properties: { tm: 58.4, gcContent: gcContent(sequence), length: sequence.length, selfComplementarity: false } };
    case 'find_primer_binding_sites':
      return { success: true, queryLength: sequence.length, sites: [] };
    case 'calc_region_gc':
      return { success: true, gcContent: gcContent(dna), chromosome, region: { start, end }, sequence: dna };
    case 'genome_codon_usage_analysis':
      return { success: true, totalCodons: Math.floor(dna.length / 3), codonUsage: { ATG: 0.02, TAA: 0.01, GAA: 0.04 }, gcContent: gcContent(dna) };
    case 'get_genome_info':
      return { success: true, genomeName: 'ECOLI.gbk', genomeLength: 4639675, chromosome: 'U00096', statistics: { gcContent: 50.8, genes: 4356, annotations: 5120 } };
    case 'get_current_state':
      return { success: true, activeChromosome: 'U00096', currentView: { start: 100000, end: 101000 }, tracks: DEFAULT_TRACKS, genomeLoaded: true };
    case 'get_chromosome_list':
      return { success: true, chromosomes: ['U00096'], count: 1 };
    case 'get_loaded_files_list':
      return { success: true, files: [{ name: 'ECOLI.gbk', type: 'genome' }, { name: '1655_C10.sorted.bam', type: 'reads' }, { name: '1655_C10.mutations.vcf', type: 'variant' }] };
    case 'find_gene_by_name':
    case 'get_gene_details': {
      const coords = geneCoordinates(seed);
      return {
        success: true,
        geneName: parameters.name || parameters.geneName || 'lacZ',
        genes_found: 1,
        count: 1,
        found: true,
        genes: [{ name: parameters.name || parameters.geneName || 'lacZ', locus_tag: 'b0344', chromosome: coords.chromosome, start: coords.start, end: coords.end, strand: '+', product: 'pinned contract gene' }],
      };
    }
    case 'get_nearby_features':
    case 'list_annotations':
      return { success: true, chromosome, total: 1, count: 1, annotations: [{ id: 'ann_1', type: 'CDS', chromosome, start, end, gene: 'lacZ', product: 'pinned contract annotation' }] };
    case 'get_annotation':
      return { success: true, identifier: parameters.identifier || 'ann_1', chromosome, annotation: { id: parameters.identifier || 'ann_1', type: 'CDS', chromosome, start, end, gene: 'lacZ', product: 'pinned contract annotation' } };
    case 'get_annotation_history':
      return { success: true, history: [{ id: 'hist_1', identifier: parameters.identifier || 'ann_1', action: 'created', timestamp: '2026-08-02T00:00:00Z' }] };
    case 'create_annotation': {
      const id = annotationId(seed);
      return { success: true, annotation_id: id, id, identifier: id, chromosome, start, end, type: parameters.type || 'gene', name: parameters.name || 'feature' };
    }
    case 'batch_create_annotations': {
      const id = annotationId(seed);
      return { success: true, annotations: [{ annotation_id: id, id, chromosome, start, end }], created: 1 };
    }
    case 'update_annotation':
    case 'bulk_update_annotations':
    case 'delete_annotation':
    case 'clear_actions':
    case 'toggle_settings_modal':
      return { success: true, updated: 1, deleted: 1, cleared: 1 };
    case 'add_task': {
      const taskId = `task_${Math.abs(hashCode(seed)) % 1000}`;
      return { success: true, task_id: taskId, id: taskId, title: parameters.title || 'contract task', status: parameters.status || 'pending', progress: parameters.progress || 0 };
    }
    case 'list_tasks': {
      const taskId = `task_${Math.abs(hashCode(seed)) % 1000}`;
      return { success: true, tasks: [{ task_id: taskId, id: taskId, title: 'contract task', status: 'pending', progress: 0 }], count: 1 };
    }
    case 'update_task':
      return { success: true, updated: 1, task_id: parameters.task_id || parameters.id || 'task_1' };
    case 'delete_task':
      return { success: true, deleted: 1, task_id: parameters.task_id || parameters.id || 'task_1' };
    case 'clear_tasks':
      return { success: true, cleared: 1 };
    case 'design_primers': {
      const coords = primerCoordinates(seed);
      return {
        success: true,
        primers: [{ name: 'primer_1', chromosome: coords.chromosome, start: coords.start, end: coords.end, forward: { genomicStart: coords.start, genomicEnd: coords.start + 19, sequence: dna.slice(0, 20) }, reverse: { genomicStart: coords.end - 19, genomicEnd: coords.end, sequence: reverseComplement(dna.slice(-20)) } }],
        target: { chromosome: coords.chromosome, start: coords.start, end: coords.end, geneName: parameters.geneName || 'lacZ' },
        forward: { genomicStart: coords.start, genomicEnd: coords.start + 19, sequence: dna.slice(0, 20) },
        reverse: { genomicStart: coords.end - 19, genomicEnd: coords.end, sequence: reverseComplement(dna.slice(-20)) },
      };
    }
    case 'save_primer':
      return { success: true, primer_id: parameters.name || 'primer_1', name: parameters.name || 'primer_1', chromosome: parameters.chromosome || 'U00096' };
    case 'list_primers':
      return { success: true, primers: [{ primer_id: 'primer_1', name: 'primer_1', chromosome: 'U00096', start: 100000, end: 100019 }], count: 1 };
    case 'delete_primers':
      return { success: true, deleted: 1 };
    case 'open_new_tab':
      return { success: true, tab_id: 'tab_1', id: 'tab_1', tabIndex: 1 };
    case 'switch_to_tab':
      return { success: true, activeTab: parameters.tab_id || parameters.tab_index || 'tab_1' };
    case 'close_tab':
      return { success: true, closed: parameters.tab_id || parameters.tab_index || 'tab_1' };
    case 'highlight_region':
      return { success: true, highlight_id: 'hl_1', id: 'hl_1', chromosome, start, end, label: parameters.label || 'highlight' };
    case 'list_highlights':
      return { success: true, highlights: [{ id: 'hl_1', chromosome, start, end, label: parameters.label || 'highlight' }], count: 1 };
    case 'remove_highlight':
    case 'clear_highlights':
      return { success: true, removed: 1 };
    case 'save_view_state':
      return { success: true, viewStateId: 'view_1', id: 'view_1', name: parameters.name || 'view' };
    case 'restore_view_state':
      return { success: true, restored: 'view_1' };
    case 'bookmark_position':
      return { success: true, bookmark_id: 'bm_1', id: 'bm_1', chromosome, start, end, name: parameters.name || 'bookmark' };
    case 'get_bookmarks':
      return { success: true, bookmarks: [{ id: 'bm_1', chromosome, start, end, name: 'bookmark' }], count: 1 };
    case 'navigate_to_position':
      return { success: true, position: { chromosome, start: parameters.start || start, end: parameters.end || end } };
    case 'zoom_in':
    case 'zoom_out':
    case 'pan_left':
    case 'pan_right':
      return { success: true, view: { chromosome, start: 100000, end: 101000 } };
    case 'jump_to_gene':
    case 'zoom_to_gene':
    case 'select_gene':
    case 'select_sequence_region':
      return { success: true, chromosome, start, end, geneName: parameters.geneName || parameters.name || null };
    case 'toggle_track': {
      const trackName = parameters.track_name || parameters.trackName || 'gc_content';
      return { success: true, track: trackName, visible: parameters.visible !== false };
    }
    case 'get_track_status':
      return { success: true, tracks: DEFAULT_TRACKS };
    case 'get_all_track_settings':
      return { success: true, tracks: DEFAULT_TRACKS, settings: DEFAULT_TRACKS };
    case 'get_track_settings_schema':
      return { success: true, schema: { trackName: { type: 'string' }, visible: { type: 'boolean' } } };
    case 'set_track_settings':
    case 'batch_set_track_settings':
      return { success: true, applied: 1 };
    case 'capture_screenshot':
      // Echo the path the caller requested so a follow-up "open the captured
      // image" step can use the real target instead of a tool-internal path.
      return {
        success: true,
        filePath: parameters.filePath || parameters.path || `/tmp/codexomics_screenshot_${Math.abs(hashCode(seed)) % 10000}.png`,
        mode: parameters.mode || 'visible',
        target: parameters.target || 'visible_tracks',
      };
    case 'open_image_file':
      return { success: true, filePath: parameters.filePath || parameters.path || '/tmp/screenshot.png' };
    case 'view_markdown_file':
      return { success: true, content: '# contract markdown\n\nRendered.', filePath: parameters.filePath || parameters.path };
    case 'download_internet_file':
      return { success: true, filePath: '/tmp/downloaded_file', url: parameters.url };
    case 'set_working_directory':
      return { success: true, directory: parameters.directory_path || parameters.directory || './' };
    case 'list_available_tools':
      return { success: true, tools: [{ name: 'list_available_tools', category: 'system' }], count: 1 };
    case 'get_clipboard_content':
      return { success: true, content: 'ATGCATGCATGC', length: 12 };
    case 'copy_sequence':
    case 'paste_sequence':
    case 'cut_sequence':
    case 'delete_sequence':
    case 'insert_sequence':
    case 'replace_sequence':
      return { success: true, chromosome, start, end, applied: 1 };
    case 'execute_actions':
      return { success: true, executed: 1 };
    case 'get_action_list':
    case 'show_action_list':
      return { success: true, actions: [{ id: 'action_1', tool: 'cut_sequence' }], count: 1 };
    case 'search_features':
    case 'search_annotations':
    case 'search_sequence_motif':
    case 'search_pattern':
      return { success: true, results: [{ id: 'ann_1', type: 'CDS', chromosome, start, end, gene: 'lacZ' }], count: 1 };
    case 'search_uniprot_database':
      return { success: true, results_count: 1, entries: [{ accession: 'P0A6L2', protein_name: 'Dihydrodipicolinate synthase', gene_name: 'dapA', organism: 'Escherichia coli', reviewed: true, length: 292 }] };
    case 'get_uniprot_entry':
      // P0A6L2 (E. coli DapA) is pinned by the benchmark fixture; returning
      // the real sequence keeps chained analysis calls consistent with the
      // oracle instead of a synthetic placeholder.
      if ((parameters.uniprot_id || parameters.geneName || '').toString().toUpperCase() === 'P0A6L2') {
        return {
          success: true,
          entry_info: { accession: 'P0A6L2', protein_name: 'Dihydrodipicolinate synthase', gene_name: 'dapA', organism: 'Escherichia coli', reviewed: true },
          protein_sequence:
            'MFTGSIVAIVTPMDEKGNVCRASLKKLIDYHVASGTSAIVSVGTTGESATLNHDEHADVVMMTLDLADGRIPVIAGTGANATAEAISLTQRFNDSGIVGCLTVTPYYNRPSQEGLYQHFKAIAEHTDLPQILYNVPSRTGCDLLPETVGRLAKVKNIIGIKEATGNLTRVNQIKELVSDDFVLLSGDDASALDFMQLGGHGVISVTANVAARDMAQMCKLAAEGHFAEARVINQRLMPLHNKLFVEPNPIPVKWACKELGLVATDTLRLPMTPITDSGRETVRAALKHAGLL',
          sequence_length: 292,
        };
      }
      return {
        success: true,
        entry_info: { accession: parameters.uniprot_id || 'P0A6L2', protein_name: 'Dihydrodipicolinate synthase', gene_name: 'dapA', organism: 'Escherichia coli', reviewed: true },
        protein_sequence: 'MK' + seededDna(90, seed),
        sequence_length: 92,
      };
    case 'search_pdb_structures':
    case 'search_alphafold_structures':
      return { success: true, structures: [{ pdb_id: '1DHP', gene_name: 'dapA', organism: 'Escherichia coli', resolution: 2.2 }], count: 1 };
    case 'fetch_protein_structure':
    case 'fetch_alphafold_structure':
      return { success: true, structureId: parameters.structureId || parameters.pdb_id || '1DHP', filePath: '/tmp/structure.pdb' };
    case 'open_protein_viewer':
      return { success: true, structureId: parameters.structureId || parameters.pdb_id || '1DHP' };
    case 'analyze_interpro_domains':
      return { success: true, domains: [{ id: 'IPR002912', name: 'DapA-like', description: 'pinned contract domain', start: 1, end: 292 }], count: 1 };
    case 'advanced_uniprot_search':
      return { success: true, results: [{ accession: 'P0A6L2', protein_name: 'Dihydrodipicolinate synthase' }], count: 1 };
    case 'get_interpro_entry_details':
      return { success: true, domains: [{ id: 'IPR002912', name: 'DapA-like' }], count: 1 };
    case 'blast_get_installation_status':
      return { success: true, installed: true, version: '2.15.0' };
    case 'blast_list_databases':
      return { success: true, databases: [{ name: 'ecoli_nucl', type: 'nucleotide' }], count: 1 };
    case 'blast_create_database':
    case 'blast_create_db_from_genome':
    case 'blast_create_quick_db_for_current_genome':
      return { success: true, database: { name: parameters.dbName || parameters.genomeName || 'ecoli_nucl', type: 'nucleotide' }, dbName: parameters.dbName || parameters.genomeName || 'ecoli_nucl' };
    case 'blast_search':
    case 'blast_search_local':
      return { success: true, results: [{ query: String(parameters.sequence || '').slice(0, 30), hits: 1, alignments: [{ database: parameters.database || 'ecoli_nucl', score: 100, identity: 0.98 }] }], count: 1 };
    case 'blast_validate_database':
      return { success: true, valid: true, database: parameters.dbName || parameters.database || 'ecoli_nucl' };
    case 'blast_delete_database':
      return { success: true, deleted: 1, database: parameters.dbName || parameters.database || 'ecoli_nucl' };
    case 'blast_detect_sequence_type':
      return { success: true, sequenceType: 'dna', confidence: 1.0 };
    case 'blast_sequence_from_region':
      return { success: true, sequence: dna, chromosome, start, end };
    case 'blast_filter_results':
      return { success: true, filtered: 1 };
    case 'blast_export_results':
      return { success: true, exported: 1, filePath: '/tmp/blast_results.tsv' };
    case 'virtual_digest': {
      const fragmentCount = Math.max(1, Math.abs(hashCode(seed)) % 4);
      return {
        success: true,
        enzymes: parameters.enzymes || [],
        chromosome,
        region: { start, end },
        totalSites: fragmentCount,
        totalFragments: fragmentCount,
        averageFragmentSize: Math.floor(dna.length / fragmentCount),
        largestFragment: Math.floor(dna.length / fragmentCount),
        smallestFragment: 1,
        sizeRange: `1 - ${dna.length} bp`,
        fragmentDetails: Array.from({ length: fragmentCount }, (_unused, index) => ({
          index,
          start: index === 0 ? 0 : Math.floor(dna.length / fragmentCount) * index,
          end: index === fragmentCount - 1 ? dna.length : Math.floor(dna.length / fragmentCount) * (index + 1),
          length: index === fragmentCount - 1 ? dna.length - Math.floor(dna.length / fragmentCount) * index : Math.floor(dna.length / fragmentCount),
          sequence: dna.slice(index === 0 ? 0 : Math.floor(dna.length / fragmentCount) * index, index === fragmentCount - 1 ? dna.length : Math.floor(dna.length / fragmentCount) * (index + 1)),
        })),
      };
    }
    case 'find_restriction_sites':
      return { success: true, enzyme: parameters.enzyme || 'EcoRI', recognitionSite: 'GAATTC', sitesFound: 0, sites: [], chromosome, searchRegion: { start, end } };
    case 'simulate_gel_electrophoresis':
      return { success: true, ladderType: parameters.ladderType || '1kb', gelPercentage: parameters.gelPercentage || 1.0, lanes: [{ well: 1, bands: [] }] };
    case 'list_restriction_enzymes':
      return { success: true, enzymes: [{ name: 'EcoRI', recognition: 'GAATTC' }, { name: 'HindIII', recognition: 'AAGCTT' }], count: 2 };
    case 'get_operons':
      return { success: true, operons: [{ id: 'OP1', chromosome, start, end, genes: ['lacZ'] }], count: 1 };
    case 'predict_promoter':
      return { success: true, promoters: [{ id: 'prom_1', chromosome, start, end, score: 0.9 }], count: 1 };
    case 'get_dna_marker_info':
    case 'list_dna_markers':
      return { success: true, markers: [{ id: 'marker_1', chromosome, start, end, name: 'contract marker' }], count: 1 };
    case 'export_fasta_sequence':
    case 'export_genbank_format':
    case 'export_gff_annotations':
    case 'export_bed_format':
    case 'export_cds_fasta':
    case 'export_protein_fasta':
    case 'export_current_view_fasta':
    case 'export_data':
      return { success: true, exported: 1, filePath: parameters.filename || parameters.filePath || `/tmp/export_${Math.abs(hashCode(seed)) % 10000}` };
    case 'open_benchmark':
    case 'get_benchmark_status':
      return { success: true, benchmarkOpen: true, status: 'idle' };
    case 'toggle_chatbox':
    case 'set_chatbox_layout':
    case 'set_chatbox_minimized':
    case 'toggle_sidebar':
    case 'toggle_sidebar_panel':
    case 'toggle_top_banner':
    case 'switch_ui_style':
      return { success: true, applied: 1 };
    default:
      return { success: true, acknowledged: true, tool: toolName };
  }
}

module.exports = { buildContractToolResult };
