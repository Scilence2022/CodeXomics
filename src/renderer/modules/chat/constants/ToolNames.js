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
    GET_CURRENT_REGION: 'get_current_region',
    SCROLL_LEFT: 'scroll_left',
    SCROLL_RIGHT: 'scroll_right',
    ZOOM_IN: 'zoom_in',
    ZOOM_OUT: 'zoom_out',
    BOOKMARK_POSITION: 'bookmark_position',
    GET_BOOKMARKS: 'get_bookmarks',
    SAVE_VIEW_STATE: 'save_view_state',
  },

  // === Search Tools ===
  SEARCH: {
    SEARCH_FEATURES: 'search_features',
    SEARCH_GENE_BY_NAME: 'search_gene_by_name',
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
    SEQUENCE_STATISTICS: 'sequence_statistics',
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
  },

  // === Annotation CRUD Tools ===
  ANNOTATION: {
    CREATE_ANNOTATION: 'create_annotation',
    EDIT_ANNOTATION: 'edit_annotation',
    DELETE_ANNOTATION: 'delete_annotation',
    LIST_ANNOTATIONS: 'list_annotations',
    GET_ANNOTATION: 'get_annotation',
    UPDATE_ANNOTATION: 'update_annotation',
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
    BLAST_SEQUENCE_FROM_REGION: 'blast_sequence_from_region',
    GET_BLAST_DATABASES: 'get_blast_databases',
    BATCH_BLAST_SEARCH: 'batch_blast_search',
    ADVANCED_BLAST_SEARCH: 'advanced_blast_search',
    LOCAL_BLAST_DATABASE_INFO: 'local_blast_database_info',
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
    DELETE_GENE: 'delete_gene',
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
    ANALYZE_REGION: 'analyze_region',
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
};
