/**
 * ToolNames - Central registry of all tool name constants used in ChatManager
 * Eliminates magic strings throughout the codebase.
 */

// eslint-disable-next-line no-unused-vars
const TOOL_NAMES = {
  // === Navigation Tools ===
  NAVIGATION: {
    NAVIGATE_TO_POSITION: 'navigate_to_position',
    OPEN_NEW_TAB: 'open_new_tab',
    SWITCH_TO_TAB: 'switch_to_tab',
    CLOSE_TAB: 'close_tab',
    NAVIGATE_TO: 'navigate_to',
    JUMP_TO_GENE: 'jump_to_gene',
    ZOOM_TO_GENE: 'zoom_to_gene',
    SELECT_GENE: 'select_gene',
    SELECT_SEQUENCE_REGION: 'select_sequence_region',
    HIGHLIGHT_REGION: 'highlight_region',
    REMOVE_HIGHLIGHT: 'remove_highlight',
    LIST_HIGHLIGHTS: 'list_highlights',
    CLEAR_HIGHLIGHTS: 'clear_highlights',
    GET_CURRENT_REGION: 'get_current_region',
    SCROLL_LEFT: 'scroll_left',
    SCROLL_RIGHT: 'scroll_right',
    ZOOM_IN: 'zoom_in',
    ZOOM_OUT: 'zoom_out',
    BOOKMARK_POSITION: 'bookmark_position',
    GET_BOOKMARKS: 'get_bookmarks',
    SAVE_VIEW_STATE: 'save_view_state',
    RESTORE_VIEW_STATE: 'restore_view_state',
  },

  // === Search Tools ===
  SEARCH: {
    SEARCH_FEATURES: 'search_features',
    SEARCH_GENE_BY_NAME: 'find_gene_by_name',
    FIND_GENE: 'find_gene', // legacy alias for find_gene_by_name
    SEARCH_MOTIF: 'search_motif',
    SEARCH_PATTERN: 'search_pattern',
    SEARCH_BY_POSITION: 'search_by_position',
    SEARCH_SEQUENCE_MOTIF: 'search_sequence_motif',
    SEARCH_INTERGENIC_REGIONS: 'search_intergenic_regions',
    GET_NEARBY_FEATURES: 'get_nearby_features',
    FIND_INTERGENIC_REGIONS: 'find_intergenic_regions',
  },

  // === Sequence Analysis Tools ===
  SEQUENCE: {
    GET_SEQUENCE: 'get_sequence',
    TRANSLATE_SEQUENCE: 'translate_sequence',
    TRANSLATE_DNA: 'translate_dna',
    CALCULATE_GC_CONTENT: 'calculate_gc_content',
    COMPUTE_GC: 'compute_gc',
    CALC_REGION_GC: 'calc_region_gc',
    REVERSE_COMPLEMENT: 'reverse_complement',
    FIND_RESTRICTION_SITES: 'find_restriction_sites',
    VIRTUAL_DIGEST: 'virtual_digest',
    LIST_RESTRICTION_ENZYMES: 'list_restriction_enzymes',
    SIMULATE_GEL_ELECTROPHORESIS: 'simulate_gel_electrophoresis',
    LIST_DNA_MARKERS: 'list_dna_markers',
    GET_DNA_MARKER_INFO: 'get_dna_marker_info',
    CODON_USAGE_ANALYSIS: 'codon_usage_analysis',
    GENOME_CODON_USAGE_ANALYSIS: 'genome_codon_usage_analysis',
    AMINO_ACID_COMPOSITION: 'amino_acid_composition',
    ANALYZE_CODON_USAGE: 'analyze_codon_usage',
    CALCULATE_ENTROPY: 'calculate_entropy',
    CALCULATE_MELTING_TEMP: 'calculate_melting_temp',
    CALCULATE_MOLECULAR_WEIGHT: 'calculate_molecular_weight',
    PREDICT_PROMOTER: 'predict_promoter',
    PREDICT_RBS: 'predict_rbs',
    PREDICT_TERMINATOR: 'predict_terminator',
    GET_UPSTREAM_REGION: 'get_upstream_region',
    GET_DOWNSTREAM_REGION: 'get_downstream_region',
    COMPARE_REGIONS: 'compare_regions',
    FIND_SIMILAR_SEQUENCES: 'find_similar_sequences',
    GET_CODING_SEQUENCE: 'get_coding_sequence',
    GET_MULTIPLE_CODING_SEQUENCES: 'get_multiple_coding_sequences',
    GET_OPERONS: 'get_operons',
    FIND_OPEN_READING_FRAMES: 'find_orfs',
  },

  // === State & Info Tools ===
  STATE: {
    GET_CURRENT_STATE: 'get_current_state',
    GET_CHROMOSOME_LIST: 'get_chromosome_list',
    GET_TRACK_STATUS: 'get_track_status',
    TOGGLE_TRACK: 'toggle_track',
    TOGGLE_ANNOTATION_TRACK: 'toggle_annotation_track',
    GET_GENE_DETAILS: 'get_gene_details',
    GET_GENOME_INFO: 'get_genome_info',
    CHECK_GENOMICS_ENVIRONMENT: 'check_genomics_environment',
    GET_SELECTED_GENE: 'get_selected_gene',
    GET_CURRENT_REGION_DETAILS: 'get_current_region_details',
    GET_SEQUENCE_SELECTION: 'get_sequence_selection',
    GET_FILE_INFO: 'get_file_info',
  },

  // === File Loading Tools ===
  FILE_LOADING: {
    LOAD_GENOME_FILE: 'load_genome_file',
    LOAD_ANNOTATION_FILE: 'load_annotation_file',
    LOAD_VARIANT_FILE: 'load_variant_file',
    LOAD_READS_FILE: 'load_reads_file',
    LOAD_WIG_TRACKS: 'load_wig_tracks',
    LOAD_OPERON_FILE: 'load_operon_file',
    DOWNLOAD_INTERNET_FILE: 'download_internet_file',
    VIEW_MARKDOWN_FILE: 'view_markdown_file',
    GET_LOADED_FILES_LIST: 'get_loaded_files_list',
  },

  // === Export Tools ===
  EXPORT: {
    EXPORT_DATA: 'export_data',
    EXPORT_FASTA_SEQUENCE: 'export_fasta_sequence',
    EXPORT_GENBANK_FORMAT: 'export_genbank_format',
    EXPORT_CDS_FASTA: 'export_cds_fasta',
    EXPORT_PROTEIN_FASTA: 'export_protein_fasta',
    EXPORT_GFF_ANNOTATIONS: 'export_gff_annotations',
    EXPORT_BED_FORMAT: 'export_bed_format',
    EXPORT_CURRENT_VIEW_FASTA: 'export_current_view_fasta',
    EXPORT_REGION_FEATURES: 'export_region_features',
    CAPTURE_SCREENSHOT: 'capture_screenshot',
    OPEN_IMAGE_FILE: 'open_image_file',
  },

  // === Annotation CRUD Tools ===
  ANNOTATION: {
    CREATE_ANNOTATION: 'create_annotation',
    EDIT_ANNOTATION: 'edit_annotation',
    DELETE_ANNOTATION: 'delete_annotation',
    LIST_ANNOTATIONS: 'list_annotations',
    GET_ANNOTATION: 'get_annotation',
    UPDATE_ANNOTATION: 'update_annotation',
    MERGE_GENE_RESEARCH_REPORT: 'merge_gene_research_report',
    SEARCH_ANNOTATIONS: 'search_annotations',
    BULK_UPDATE_ANNOTATIONS: 'bulk_update_annotations',
    GET_ANNOTATION_HISTORY: 'get_annotation_history',
    BATCH_CREATE_ANNOTATIONS: 'batch_create_annotations',
    ADD_ANNOTATION: 'add_annotation',
    MERGE_ANNOTATIONS: 'merge_annotations',
  },

  // === Protein Tools ===
  PROTEIN: {
    OPEN_PROTEIN_VIEWER: 'open_protein_viewer',
    FETCH_PROTEIN_STRUCTURE: 'fetch_protein_structure',
    SEARCH_PDB_STRUCTURES: 'search_pdb_structures',
    SEARCH_UNIPROT_DATABASE: 'search_uniprot_database',
    ADVANCED_UNIPROT_SEARCH: 'advanced_uniprot_search',
    GET_UNIPROT_ENTRY: 'get_uniprot_entry',
    ANALYZE_INTERPRO_DOMAINS: 'analyze_interpro_domains',
    SEARCH_INTERPRO_ENTRY: 'search_interpro_entry',
    GET_INTERPRO_ENTRY_DETAILS: 'get_interpro_entry_details',
    GET_PDB_DETAILS: 'get_pdb_details',
    SEARCH_ALPHAFOLD_STRUCTURES: 'search_alphafold_structures',

    FETCH_ALPHAFOLD_STRUCTURE: 'fetch_alphafold_structure',
    RENDER_PROTEIN_STRUCTURE_RESULTS: 'render_protein_structure_results',
  },

  // === BLAST Tools ===
  BLAST: {
    BLAST_SEARCH: 'blast_search',
    BLAST_SEARCH_ONLINE: 'blast_search_online',
    BLAST_SEARCH_LOCAL: 'blast_search_local',
    BLAST_SEARCH_BATCH: 'blast_search_batch',
    BLAST_CREATE_DATABASE: 'blast_create_database',
    BLAST_LIST_DATABASES: 'blast_list_databases',
    BLAST_DELETE_DATABASE: 'blast_delete_database',
    BLAST_CREATE_DB_FROM_GENOME: 'blast_create_db_from_genome',
    BLAST_CREATE_PROTEIN_DB_FROM_GENOME: 'blast_create_protein_db_from_genome',
    BLAST_FILTER_RESULTS: 'blast_filter_results',
    BLAST_EXPORT_RESULTS: 'blast_export_results',
    BLAST_DETECT_SEQUENCE_TYPE: 'blast_detect_sequence_type',
    BLAST_VALIDATE_DATABASE: 'blast_validate_database',
    BLAST_GET_INSTALLATION_STATUS: 'blast_get_installation_status',
    BLAST_CREATE_QUICK_DB_FOR_CURRENT_GENOME: 'blast_create_quick_db_for_current_genome',
    // Legacy aliases (kept for backward compatibility)
    BLAST_SEQUENCE_FROM_REGION: 'blast_sequence_from_region',
    GET_BLAST_DATABASES: 'get_blast_databases',
    BATCH_BLAST_SEARCH: 'batch_blast_search',
    ADVANCED_BLAST_SEARCH: 'advanced_blast_search',
  },

  // === Pathway Tools ===
  PATHWAY: {
    SHOW_METABOLIC_PATHWAY: 'show_metabolic_pathway',
    FIND_PATHWAY_GENES: 'find_pathway_genes',
  },

  // === Sequence Editing / Action Tools ===
  ACTIONS: {
    COPY_SEQUENCE: 'copy_sequence',
    CUT_SEQUENCE: 'cut_sequence',
    PASTE_SEQUENCE: 'paste_sequence',
    DELETE_SEQUENCE: 'delete_sequence',
    INSERT_SEQUENCE: 'insert_sequence',
    REPLACE_SEQUENCE: 'replace_sequence',
    GET_ACTION_LIST: 'get_action_list',
    SHOW_ACTION_LIST: 'show_action_list',
    EXECUTE_ACTIONS: 'execute_actions',
    CLEAR_ACTIONS: 'clear_actions',
    GET_CLIPBOARD_CONTENT: 'get_clipboard_content',
    ADD_TRACK: 'add_track',
    ADD_VARIANT: 'add_variant',
  },

  // === System Tools ===
  SYSTEM: {
    SET_WORKING_DIRECTORY: 'set_working_directory',
    LIST_AVAILABLE_TOOLS: 'list_available_tools',
    SWITCH_UI_STYLE: 'switch_ui_style',
    TOGGLE_SETTINGS_MODAL: 'toggle_settings_modal',
    TOGGLE_CHATBOX: 'toggle_chatbox',
    SET_CHATBOX_LAYOUT: 'set_chatbox_layout',
    SET_CHATBOX_MINIMIZED: 'set_chatbox_minimized',
    TOGGLE_SIDEBAR: 'toggle_sidebar',
    TOGGLE_SIDEBAR_PANEL: 'toggle_sidebar_panel',
    TOGGLE_TOP_BANNER: 'toggle_top_banner',
  },

  // === Track Settings Tools ===
  TRACK_SETTINGS: {
    GET_TRACK_SETTINGS: 'get_track_settings',
    SET_TRACK_SETTINGS: 'set_track_settings',
    GET_ALL_TRACK_SETTINGS: 'get_all_track_settings',
    RESET_TRACK_SETTINGS: 'reset_track_settings',
    GET_TRACK_SETTINGS_SCHEMA: 'get_track_settings_schema',
    BATCH_SET_TRACK_SETTINGS: 'batch_set_track_settings',
  },

  // === Benchmark Tools ===
  BENCHMARK: {
    OPEN_BENCHMARK: 'open_benchmark',
    START_BENCHMARK: 'start_benchmark',
    STOP_BENCHMARK: 'stop_benchmark',
    PAUSE_BENCHMARK: 'pause_benchmark',
    RESUME_BENCHMARK: 'resume_benchmark',
    GET_BENCHMARK_RESULTS: 'get_benchmark_results',
    GET_BENCHMARK_STATUS: 'get_benchmark_status',
    EXPORT_BENCHMARK_RESULTS: 'export_benchmark_results',
  },

  PRIMER: {
    CALCULATE_PRIMER_PROPERTIES: 'calculate_primer_properties',
    DESIGN_PRIMERS: 'design_primers',
    FIND_PRIMER_BINDING_SITES: 'find_primer_binding_sites',
    SAVE_PRIMER: 'save_primer',
    LIST_PRIMERS: 'list_primers',
    DELETE_PRIMERS: 'delete_primers',
  },

  TASK: {
    ADD_TASK: 'add_task',
    UPDATE_TASK: 'update_task',
    LIST_TASKS: 'list_tasks',
    CLEAR_TASKS: 'clear_tasks',
    DELETE_TASK: 'delete_task',
  },
};
