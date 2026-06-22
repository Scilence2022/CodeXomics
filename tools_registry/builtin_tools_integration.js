/**
 * Built-in Tools Integration Module
 * Bridges ChatManager's built-in tools with the dynamic registry system
 * Provides seamless integration between native and dynamic tool execution
 */

class BuiltInToolsIntegration {
  constructor() {
    this.builtInToolsMap = new Map();
    this.registryPath = __dirname;
    this.initializeBuiltInToolsMapping();
  }

  /**
   * Initialize the mapping between built-in tools and their registry definitions
   */
  initializeBuiltInToolsMapping() {
    // Map registry tool names to ChatManager built-in methods
    this.builtInToolsMap.set('load_genome_file', {
      method: 'loadGenomeFile',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('load_annotation_file', {
      method: 'loadAnnotationFile',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('load_variant_file', {
      method: 'loadVariantFile',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('load_reads_file', {
      method: 'loadReadsFile',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('load_wig_tracks', {
      method: 'loadWigTracks',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('load_operon_file', {
      method: 'loadOperonFile',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_loaded_files_list', {
      method: 'getLoadedFilesList',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    // Additional built-in tools can be added here
    this.builtInToolsMap.set('navigate_to_position', {
      method: 'navigateToPosition',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('open_new_tab', {
      method: 'openNewTab',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('switch_to_tab', {
      method: 'switchToTab',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('close_tab', {
      method: 'closeTab',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_current_state', {
      method: 'getCurrentState',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_sequence', {
      method: 'getSequence',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('compute_gc', {
      method: 'calculateGCContent',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('calc_region_gc', {
      method: 'calcRegionGc',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('set_working_directory', {
      method: 'setWorkingDirectory',
      category: 'system',
      type: 'built-in',
      priority: 1,
    });

    // Task Management tools
    this.builtInToolsMap.set('add_task', {
      method: 'addTask',
      category: 'task_management',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('update_task', {
      method: 'updateTask',
      category: 'task_management',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('list_tasks', {
      method: 'listTasks',
      category: 'task_management',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('clear_tasks', {
      method: 'clearTasks',
      category: 'task_management',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('delete_task', {
      method: 'deleteTask',
      category: 'task_management',
      type: 'built-in',
      priority: 1,
    });

    // Co-Scientist research agent tools
    this.builtInToolsMap.set('start_co_scientist_session', {
      method: 'startCoScientistSession',
      category: 'co_scientist',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('list_co_scientist_sessions', {
      method: 'listCoScientistSessions',
      category: 'co_scientist',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('add_co_scientist_evidence', {
      method: 'addCoScientistEvidence',
      category: 'co_scientist',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('generate_co_scientist_hypotheses', {
      method: 'generateCoScientistHypotheses',
      category: 'co_scientist',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('run_co_scientist_cycle', {
      method: 'runCoScientistCycle',
      category: 'co_scientist',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('get_co_scientist_report', {
      method: 'getCoScientistReport',
      category: 'co_scientist',
      type: 'built-in',
      priority: 2,
    });

    // Database tools - UniProt
    this.builtInToolsMap.set('search_uniprot_database', {
      method: 'searchUniProtDatabase',
      category: 'database',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('advanced_uniprot_search', {
      method: 'advancedUniProtSearch',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('get_uniprot_entry', {
      method: 'getUniProtEntry',
      category: 'database',
      type: 'built-in',
      priority: 1,
    });

    // Database tools - InterPro
    this.builtInToolsMap.set('analyze_interpro_domains', {
      method: 'analyzeInterProDomains',
      category: 'database',
      type: 'built-in',
      priority: 1,
    });

    // Database tools - AlphaFold
    this.builtInToolsMap.set('search_alphafold_structures', {
      method: 'searchAlphaFoldStructures',
      category: 'protein',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('fetch_alphafold_structure', {
      method: 'fetchAlphaFoldStructure',
      category: 'protein',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('open_protein_viewer', {
      method: 'openProteinViewer',
      category: 'protein',
      type: 'built-in',
      priority: 1,
    });

    // Database tools - PDB
    this.builtInToolsMap.set('search_pdb_structures', {
      method: 'searchPDBStructures',
      category: 'protein',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('search_interpro_entry', {
      method: 'searchInterProEntry',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('get_interpro_entry_details', {
      method: 'getInterProEntryDetails',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    // Data management tools - Codon usage analysis
    this.builtInToolsMap.set('codon_usage_analysis', {
      method: 'codonUsageAnalysis',
      category: 'data_management',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('genome_codon_usage_analysis', {
      method: 'genomeCodonUsageAnalysis',
      category: 'data_management',
      type: 'built-in',
      priority: 2,
    });

    // BLAST Tools Integration
    // Legacy blast_search tool (maps to blastSearch)
    this.builtInToolsMap.set('blast_search', {
      method: 'blastSearch',
      category: 'external_apis',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('blast_search_online', {
      method: 'blastSearchOnline',
      category: 'external_apis',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('blast_search_local', {
      method: 'blastSearchLocal',
      category: 'external_apis',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('blast_search_batch', {
      method: 'blastSearchBatch',
      category: 'external_apis',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_create_database', {
      method: 'blastCreateDatabase',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_list_databases', {
      method: 'blastListDatabases',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_delete_database', {
      method: 'blastDeleteDatabase',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_create_db_from_genome', {
      method: 'blastCreateDbFromGenome',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_create_protein_db_from_genome', {
      method: 'blastCreateProteinDbFromGenome',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_filter_results', {
      method: 'blastFilterResults',
      category: 'data_management',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_export_results', {
      method: 'blastExportResults',
      category: 'data_management',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_detect_sequence_type', {
      method: 'blastDetectSequenceType',
      category: 'data_management',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_validate_database', {
      method: 'blastValidateDatabase',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_get_installation_status', {
      method: 'blastGetInstallationStatus',
      category: 'system',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_create_quick_db_for_current_genome', {
      method: 'blastCreateQuickDbForCurrentGenome',
      category: 'database',
      type: 'built-in',
      priority: 1,
    });

    // BLAST legacy aliases (map to same methods as primary entries)
    this.builtInToolsMap.set('blast_sequence_from_region', {
      method: 'blastSequenceFromRegion',
      category: 'external_apis',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('batch_blast_search', {
      method: 'blastSearchBatch',
      category: 'external_apis',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('advanced_blast_search', {
      method: 'blastSearchOnline',
      category: 'external_apis',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('get_blast_databases', {
      method: 'blastListDatabases',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    // Utility Tools
    this.builtInToolsMap.set('download_internet_file', {
      method: 'downloadInternetFile',
      category: 'utility',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('view_markdown_file', {
      method: 'viewMarkdownFile',
      category: 'utility',
      type: 'built-in',
      priority: 2,
    });

    // System Tools - List Available Tools
    this.builtInToolsMap.set('list_available_tools', {
      method: 'listAvailableTools',
      category: 'system',
      type: 'built-in',
      priority: 1,
    });

    // Navigation & View Control Tools
    this.builtInToolsMap.set('zoom_in', {
      method: 'zoomIn',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('zoom_out', {
      method: 'zoomOut',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('pan_left', {
      method: 'panLeft',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('pan_right', {
      method: 'panRight',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('jump_to_gene', {
      method: 'jumpToGene',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('find_gene_by_name', {
      method: 'searchGeneByName',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    // Legacy alias: find_gene → find_gene_by_name
    this.builtInToolsMap.set('find_gene', {
      method: 'searchGeneByName',
      category: 'navigation',
      type: 'built-in',
      priority: 2, // lower priority than find_gene_by_name
    });

    this.builtInToolsMap.set('search_features', {
      method: 'searchFeatures',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('zoom_to_gene', {
      method: 'zoomToGene',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    // Gene/Sequence Selection Tools
    this.builtInToolsMap.set('select_gene', {
      method: 'selectGene',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('select_sequence_region', {
      method: 'selectSequenceRegion',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('save_view_state', {
      method: 'saveViewState',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('bookmark_position', {
      method: 'bookmarkPosition',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    // Sequence Tools
    this.builtInToolsMap.set('translate_sequence', {
      method: 'executeMicrobeFunction_translateDNA',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
      isAliasOf: 'translate_dna',
    });

    this.builtInToolsMap.set('translate_dna', {
      method: 'executeMicrobeFunction_translateDNA',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('reverse_complement', {
      method: 'reverseComplement',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('search_sequence_motif', {
      method: 'searchMotif',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_coding_sequence', {
      method: 'getCodingSequence',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('calculate_entropy', {
      method: 'executeMicrobeFunction_calculateEntropy',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('calculate_molecular_weight', {
      method: 'executeMicrobeFunction_calculateMolecularWeight',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('predict_promoter', {
      method: 'predictPromoter',
      category: 'sequence',
      type: 'built-in',
      priority: 2,
    });

    // Sequence Editing Tools
    this.builtInToolsMap.set('replace_sequence', {
      method: 'executeActionTool_replace_sequence',
      category: 'sequence_editing',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('delete_sequence', {
      method: 'executeActionTool_delete_sequence',
      category: 'sequence_editing',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('insert_sequence', {
      method: 'executeActionTool_insert_sequence',
      category: 'sequence_editing',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('copy_sequence', {
      method: 'executeActionTool_copy_sequence',
      category: 'sequence_editing',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('cut_sequence', {
      method: 'executeActionTool_cut_sequence',
      category: 'sequence_editing',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('paste_sequence', {
      method: 'executeActionTool_paste_sequence',
      category: 'sequence_editing',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('execute_actions', {
      method: 'executeActionTool_execute_actions',
      category: 'sequence_editing',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_action_list', {
      method: 'executeActionTool_get_action_list',
      category: 'sequence_editing',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('show_action_list', {
      method: 'executeActionTool_show_action_list',
      category: 'sequence_editing',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('clear_actions', {
      method: 'executeActionTool_clear_actions',
      category: 'sequence_editing',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_clipboard_content', {
      method: 'executeActionTool_get_clipboard_content',
      category: 'sequence_editing',
      type: 'built-in',
      priority: 1,
    });

    // Export Tools
    this.builtInToolsMap.set('export_fasta_sequence', {
      method: 'exportFastaSequence',
      category: 'file_operations',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('export_genbank_format', {
      method: 'exportGenBankFormat',
      category: 'file_operations',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('export_cds_fasta', {
      method: 'exportCDSFasta',
      category: 'file_operations',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('export_protein_fasta', {
      method: 'exportProteinFasta',
      category: 'file_operations',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('export_gff_annotations', {
      method: 'exportGFFAnnotations',
      category: 'file_operations',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('export_bed_format', {
      method: 'exportBEDFormat',
      category: 'file_operations',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('export_current_view_fasta', {
      method: 'exportCurrentViewFasta',
      category: 'file_operations',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('export_data', {
      method: 'exportData',
      category: 'file_operations',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('configure_export_settings', {
      method: 'configureExportSettings',
      category: 'file_operations',
      type: 'built-in',
      priority: 2,
    });

    // Annotation Tools
    this.builtInToolsMap.set('create_annotation', {
      method: 'createAnnotation',
      category: 'annotation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_gene_details', {
      method: 'getGeneDetails',
      category: 'annotation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_operons', {
      method: 'getOperons',
      category: 'annotation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_nearby_features', {
      method: 'getNearbyFeatures',
      category: 'annotation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('find_intergenic_regions', {
      method: 'findIntergenicRegions',
      category: 'annotation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('list_annotations', {
      method: 'listAnnotations',
      category: 'annotation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_annotation', {
      method: 'getAnnotation',
      category: 'annotation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('update_annotation', {
      method: 'updateAnnotation',
      category: 'annotation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('delete_annotation', {
      method: 'deleteAnnotation',
      category: 'annotation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('search_annotations', {
      method: 'searchAnnotations',
      category: 'annotation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('bulk_update_annotations', {
      method: 'bulkUpdateAnnotations',
      category: 'annotation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_annotation_history', {
      method: 'getAnnotationHistory',
      category: 'annotation',
      type: 'built-in',
      priority: 1,
    });

    // Track & Display Tools
    this.builtInToolsMap.set('toggle_track', {
      method: 'toggleTrack',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('toggle_annotation_track', {
      method: 'toggleAnnotationTrack',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_track_status', {
      method: 'getTrackStatus',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    // Track Settings Tools
    this.builtInToolsMap.set('get_track_settings', {
      method: 'getTrackSettings',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('set_track_settings', {
      method: 'setTrackSettings',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_all_track_settings', {
      method: 'getAllTrackSettings',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('reset_track_settings', {
      method: 'resetTrackSettings',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_track_settings_schema', {
      method: 'getTrackSettingsSchema',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('batch_set_track_settings', {
      method: 'batchSetTrackSettings',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    // Primer Design Tools
    this.builtInToolsMap.set('calculate_primer_properties', {
      method: 'primerCalculateProperties',
      category: 'primer_design',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('design_primers', {
      method: 'primerDesign',
      category: 'primer_design',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('find_primer_binding_sites', {
      method: 'primerFindBindingSites',
      category: 'primer_design',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('save_primer', {
      method: 'primerAddAnnotation',
      category: 'primer_design',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('list_primers', {
      method: 'listPrimerAnnotations',
      category: 'primer_design',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('delete_primers', {
      method: 'clearPrimerAnnotations',
      category: 'primer_design',
      type: 'built-in',
      priority: 1,
    });
    // Deprecated tool names (add_primer_annotation/list_primer_annotations/
    // clear_primer_annotations) are normalized to the canonical names by
    // ToolExecutionService.legacyAliases, so they are not mapped here.

    // Restriction Analysis Tools
    this.builtInToolsMap.set('search_pattern', {
      method: 'searchPattern',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('find_restriction_sites', {
      method: 'findRestrictionSites',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('virtual_digest', {
      method: 'virtualDigest',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('list_restriction_enzymes', {
      method: 'listRestrictionEnzymes',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('simulate_gel_electrophoresis', {
      method: 'simulateGelElectrophoresis',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('list_dna_markers', {
      method: 'listDnaMarkers',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_dna_marker_info', {
      method: 'getDnaMarkerInfo',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    // Multi-window Tools
    this.builtInToolsMap.set('list_genome_windows', {
      method: 'listGenomeWindows',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('switch_active_window', {
      method: 'switchActiveWindow',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    // System Tools
    this.builtInToolsMap.set('get_chromosome_list', {
      method: 'getChromosomeList',
      category: 'system',
      type: 'built-in',
      priority: 1,
    });

    // Settings Modal Tools
    this.builtInToolsMap.set('toggle_settings_modal', {
      method: 'toggleSettingsModal',
      category: 'system',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('switch_ui_style', {
      method: 'switchUiStyle',
      category: 'system',
      type: 'built-in',
      priority: 1,
    });

    // Benchmark tools
    this.builtInToolsMap.set('open_benchmark', {
      method: 'openBenchmark',
      category: 'benchmark',
      type: 'built-in',
      priority: 1,
    });
    this.builtInToolsMap.set('start_benchmark', {
      method: 'startBenchmark',
      category: 'benchmark',
      type: 'built-in',
      priority: 1,
    });
    this.builtInToolsMap.set('stop_benchmark', {
      method: 'stopBenchmark',
      category: 'benchmark',
      type: 'built-in',
      priority: 1,
    });
    this.builtInToolsMap.set('pause_benchmark', {
      method: 'pauseBenchmark',
      category: 'benchmark',
      type: 'built-in',
      priority: 1,
    });
    this.builtInToolsMap.set('resume_benchmark', {
      method: 'resumeBenchmark',
      category: 'benchmark',
      type: 'built-in',
      priority: 1,
    });
    this.builtInToolsMap.set('get_benchmark_results', {
      method: 'getBenchmarkResults',
      category: 'benchmark',
      type: 'built-in',
      priority: 1,
    });
    this.builtInToolsMap.set('get_benchmark_status', {
      method: 'getBenchmarkStatus',
      category: 'benchmark',
      type: 'built-in',
      priority: 1,
    });
    this.builtInToolsMap.set('export_benchmark_results', {
      method: 'exportBenchmarkResults',
      category: 'benchmark',
      type: 'built-in',
      priority: 1,
    });

    console.log(`✅ Built-in Tools Integration: Mapped ${this.builtInToolsMap.size} built-in tools`);
  }

  /**
   * Check if a tool is built-in
   */
  isBuiltInTool(toolName) {
    return this.builtInToolsMap.has(toolName);
  }

  /**
   * Get built-in tool information
   */
  getBuiltInToolInfo(toolName) {
    return this.builtInToolsMap.get(toolName);
  }

  /**
   * Execute a built-in tool via ChatManager
   */
  async executeBuiltInTool(toolName, parameters, chatManagerInstance) {
    if (!this.isBuiltInTool(toolName)) {
      throw new Error(`Tool ${toolName} is not a built-in tool`);
    }

    if (!chatManagerInstance) {
      throw new Error('ChatManager instance not provided for built-in tool execution');
    }

    const toolInfo = this.getBuiltInToolInfo(toolName);
    const methodName = toolInfo.method;

    console.log(`🔧 [Built-in Tools] Executing built-in tool: ${toolName} -> ${methodName}`);

    try {
      // Check if the method exists on the ChatManager instance
      if (typeof chatManagerInstance[methodName] !== 'function') {
        throw new Error(`Method ${methodName} not found on ChatManager instance`);
      }

      // Execute the built-in method
      const startTime = Date.now();
      const result = await chatManagerInstance[methodName](parameters);
      const executionTime = Date.now() - startTime;

      console.log(`✅ [Built-in Tools] Tool ${toolName} executed successfully in ${executionTime}ms`);

      return {
        success: true,
        tool: toolName,
        method: methodName,
        result: result,
        executionTime: executionTime,
        timestamp: new Date().toISOString(),
        type: 'built-in',
      };
    } catch (error) {
      console.error(`❌ [Built-in Tools] Tool ${toolName} execution failed:`, error);
      throw new Error(`Built-in tool execution failed: ${error.message}`);
    }
  }

  /**
   * Get all built-in tools for a specific category
   */
  getBuiltInToolsByCategory(category) {
    const tools = [];
    for (const [toolName, toolInfo] of this.builtInToolsMap.entries()) {
      if (toolInfo.category === category) {
        tools.push({
          name: toolName,
          ...toolInfo,
        });
      }
    }
    return tools;
  }

  /**
   * Get enhanced file loading intent detection patterns
   */
  getFileLoadingIntentPatterns() {
    return {
      // Direct file path patterns
      file_path:
        /[\w\-\\./]+\.(fasta|fa|genbank|gbk|gb|gff|gff3|bed|gtf|vcf|sam|bam|wig|bigwig|bedgraph|json|csv|txt)$/i,

      // Quoted file paths
      quoted_path: /"[^"]*\.(fasta|fa|genbank|gbk|gb|gff|gff3|bed|gtf|vcf|sam|bam|wig|bigwig|bedgraph|json|csv|txt)"/i,

      // Load commands with file types
      load_genome: /(load|open|import)\s+(genome|fasta|genbank|gbk|gb)\s+(file)?/i,
      load_annotation: /(load|open|import)\s+(annotation|gff|bed|gtf)\s+(file)?/i,
      load_variant: /(load|open|import)\s+(variant|vcf|mutation)\s+(file)?/i,
      load_reads: /(load|open|import)\s+(reads|sam|bam|alignment)\s+(file)?/i,
      load_wig: /(load|open|import)\s+(wig|wiggle|bigwig|bedgraph|track)\s+(file)?/i,
      load_operon: /(load|open|import)\s+(operon|operons|regulatory)\s+(file)?/i,

      // Generic file loading
      load_file: /(load|open|import)\s+(file|data)/i,

      // File extensions in context
      has_extension: /\.(fasta|fa|genbank|gbk|gb|gff|gff3|bed|gtf|vcf|sam|bam|wig|bigwig|bedgraph|json|csv|txt)/i,
    };
  }

  /**
   * Analyze query for built-in tool relevance with enhanced file loading detection
   */
  analyzeBuiltInToolRelevance(query) {
    const queryLower = query.toLowerCase();
    const patterns = this.getFileLoadingIntentPatterns();
    const relevantTools = [];

    // Check for system management patterns (working directory, etc.)
    if (
      /\b(set|change|working|directory|folder|path|cd|current)\b/i.test(query) &&
      (/\b(working\s+directory|current\s+directory|set\s+directory|change\s+directory)\b/i.test(query) ||
        /\b(working\s+dir|current\s+dir|set\s+working|change\s+working)\b/i.test(query))
    ) {
      relevantTools.push({
        name: 'set_working_directory',
        confidence: 0.9,
        reason: 'Working directory management keywords detected',
      });
    }

    // Check for list_available_tools patterns
    if (
      /\b(list|show|display|what|available|all)\s+.*?\b(tools?|functions?|capabilities?|commands?)\b/i.test(query) ||
      /\b(tools?|functions?|capabilities?)\s+.*?\b(list|available|all|show)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'list_available_tools',
        confidence: 0.85,
        reason: 'Tool listing/discovery keywords detected',
      });
    }

    // Check for download_internet_file patterns
    if (
      /\b(download|fetch|save|get)\s+.*?\b(file|url|link|internet|online|web)\b/i.test(query) ||
      /\b(download|fetch)\s+.*?\b(from|via)\s+.*?\b(web|internet|online|url)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'download_internet_file',
        confidence: 0.85,
        reason: 'Internet file download keywords detected',
      });
    }

    // Check for view_markdown_file patterns
    // Matches: "view the markdown file", "open README.md", "show/display/read the .md file",
    //          "open the guide markdown", "view documentation file"
    if (
      /\b(view|open|show|display|read|render)\s+.*?\b(markdown|\.md\b|readme)/i.test(query) ||
      /\b(markdown|\.md\b)\s+.*?\b(view|open|show|display|read|render|file)\b/i.test(query) ||
      /\b(view|open|show|display|read)\s+.*?\bmarkdown\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'view_markdown_file',
        confidence: 0.9,
        reason: 'Markdown file viewing keywords detected',
      });
    }

    // Check for task tracking/management patterns
    if (
      /\b(task|tasks|todo|todos)\b/i.test(query) ||
      /\b(add|update|clear|list|show)\s+.*?\b(tasks?|todos?)\b/i.test(query)
    ) {
      relevantTools.push(
        {
          name: 'add_task',
          confidence: 0.9,
          reason: 'Task management keywords detected',
        },
        {
          name: 'update_task',
          confidence: 0.9,
          reason: 'Task management keywords detected',
        },
        {
          name: 'list_tasks',
          confidence: 0.9,
          reason: 'Task management keywords detected',
        },
        {
          name: 'clear_tasks',
          confidence: 0.9,
          reason: 'Task management keywords detected',
        },
        {
          name: 'delete_task',
          confidence: 0.9,
          reason: 'Task management keywords detected',
        }
      );
    }

    // Check for Co-Scientist research workflow patterns
    if (
      /\b(co[-\s]?scientist|autonomous\s+scientist|scientific\s+discovery|hypothes(es|is)|research\s+cycle|meta[-\s]?review|tournament\s+ranking)\b/i.test(
        query
      ) ||
      /自主科学家|科学发现|假设生成|假设排序|研究循环/i.test(query)
    ) {
      relevantTools.push(
        {
          name: 'start_co_scientist_session',
          confidence: 0.92,
          reason: 'Co-Scientist research session keywords detected',
        },
        {
          name: 'generate_co_scientist_hypotheses',
          confidence: 0.9,
          reason: 'Co-Scientist hypothesis generation keywords detected',
        },
        {
          name: 'run_co_scientist_cycle',
          confidence: 0.9,
          reason: 'Co-Scientist discovery cycle keywords detected',
        },
        {
          name: 'get_co_scientist_report',
          confidence: 0.85,
          reason: 'Co-Scientist report keywords detected',
        }
      );

      if (/\b(evidence|literature|paper|experiment|observation|feedback|result|data)\b/i.test(query)) {
        relevantTools.push({
          name: 'add_co_scientist_evidence',
          confidence: 0.9,
          reason: 'Co-Scientist evidence or feedback keywords detected',
        });
      }

      if (/\b(list|show|display|sessions?|memory|state)\b/i.test(query)) {
        relevantTools.push({
          name: 'list_co_scientist_sessions',
          confidence: 0.82,
          reason: 'Co-Scientist session listing keywords detected',
        });
      }
    }

    // Check for file loading patterns
    for (const [patternName, regex] of Object.entries(patterns)) {
      if (regex.test(query)) {
        console.log(`🎯 [Built-in Tools] File loading pattern detected: ${patternName}`);

        // Add relevant file loading tools based on pattern
        if (patternName.includes('genome') || queryLower.includes('fasta') || queryLower.includes('genbank')) {
          relevantTools.push({
            name: 'load_genome_file',
            confidence: 0.95,
            reason: `Genome file pattern detected: ${patternName}`,
          });
        }

        if (patternName.includes('annotation') || queryLower.includes('gff') || queryLower.includes('bed')) {
          relevantTools.push({
            name: 'load_annotation_file',
            confidence: 0.95,
            reason: `Annotation file pattern detected: ${patternName}`,
          });
        }

        if (patternName.includes('variant') || queryLower.includes('vcf')) {
          relevantTools.push({
            name: 'load_variant_file',
            confidence: 0.95,
            reason: `Variant file pattern detected: ${patternName}`,
          });
        }

        if (patternName.includes('reads') || queryLower.includes('sam') || queryLower.includes('bam')) {
          relevantTools.push({
            name: 'load_reads_file',
            confidence: 0.95,
            reason: `Reads file pattern detected: ${patternName}`,
          });
        }

        if (patternName.includes('wig') || queryLower.includes('track')) {
          relevantTools.push({
            name: 'load_wig_tracks',
            confidence: 0.95,
            reason: `WIG track pattern detected: ${patternName}`,
          });
        }

        if (patternName.includes('operon') || queryLower.includes('regulatory')) {
          relevantTools.push({
            name: 'load_operon_file',
            confidence: 0.95,
            reason: `Operon file pattern detected: ${patternName}`,
          });
        }

        // Generic file loading - add all file loading tools with lower confidence
        if (patternName === 'load_file' || patternName === 'file_path') {
          const fileLoadingTools = this.getBuiltInToolsByCategory('file_loading');
          for (const tool of fileLoadingTools) {
            if (!relevantTools.some(t => t.name === tool.name)) {
              relevantTools.push({
                name: tool.name,
                confidence: 0.7,
                reason: `Generic file loading pattern detected: ${patternName}`,
              });
            }
          }
        }

        break; // Use first matching pattern for primary detection
      }
    }

    // Check for navigation patterns
    if (/\b(navigate|go\s+to|jump|position|location|show|display|view)\b/i.test(query)) {
      relevantTools.push({
        name: 'navigate_to_position',
        confidence: 0.9,
        reason: 'Navigation or visualization keywords detected',
      });
    }

    // Check for genomic region visualization patterns
    if (
      /\b(show|display|view).*\b(genomic|region|position|coordinate|chromosome)\b/i.test(query) ||
      /\b(genomic|region|position|coordinate|chromosome).*\b(from|to|between)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'navigate_to_position',
        confidence: 0.95,
        reason: 'Genomic region visualization request detected',
      });
    }

    // Check for chromosome list patterns
    // Matches: "list chromosomes", "get chromosome list", "show chromosomes"
    const chromPattern1 = /\b(list|get|show|display|what|available|all)\s+/i;
    const chromPattern2 = /\b(chromosomes?|contigs?|scaffolds?)\b/i;
    const chromPattern3 = /\b(list|names?|available|all|show|display)\b/i;
    if (
      (chromPattern1.test(query) && chromPattern2.test(query)) ||
      (chromPattern2.test(query) && chromPattern3.test(query))
    ) {
      relevantTools.push({
        name: 'get_chromosome_list',
        confidence: 0.95,
        reason: 'Chromosome/contig/scaffold listing keywords detected',
      });
    }

    // Check for zoom patterns
    if (/\b(zoom\s*in|magnify|enlarge|focus|scale\s*up)\b/i.test(query)) {
      relevantTools.push({
        name: 'zoom_in',
        confidence: 0.9,
        reason: 'Zoom in keywords detected',
      });
    }

    if (/\b(zoom\s*out|zoom\s*back|zoom\s*back\s*out|shrink|broader|wider)\b/i.test(query)) {
      relevantTools.push({
        name: 'zoom_out',
        confidence: 0.9,
        reason: 'Zoom out keywords detected',
      });
    }

    // Check for zoom-to-gene patterns
    // Matches: "zoom to gene lacZ", "zoom to the lacZ gene", "focus on gene", "center on gene",
    //          "fit gene in view", "zoom to fit gene", "show gene region"
    const zoomToGenePatterns = [
      /\b(zoom|focus|center)\s+.*?\b(to|on|fit|in)?\s*.*?\bgene\b/i,
      /\b(zoom\s+to)\s+.*?\b(gene|[a-z]{3,})\b/i,
      /\b(fit|show|display)\s+.*?\bgene\b.*?\b(view|region|in)\b/i,
    ];
    if (zoomToGenePatterns.some(pattern => pattern.test(query))) {
      relevantTools.push({
        name: 'zoom_to_gene',
        confidence: 0.95,
        reason: 'Zoom to gene / focus on gene keywords detected',
      });
    }

    // Check for gene navigation patterns
    // Supports intermediate words: "navigate to the gene thrA", "go to gene xyz"
    if (
      /\b(jump|go|navigate|move)\s+.*?\bgene\b/i.test(query) ||
      /\b(find|locate)\s+.*?\bgene\b/i.test(query) ||
      /\bgene\s+(name|location|position)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'jump_to_gene',
        confidence: 0.9,
        reason: 'Gene navigation keywords detected',
      });
    }

    // Check for gene/sequence selection patterns
    // Matches: "select gene lacZ", "select the gene", "highlight gene dnaA", "choose gene thrA"
    if (
      /\b(select|highlight|choose|pick|activate|set\s+selection)\s+.*?\bgene\b/i.test(query) ||
      /\bselect\s+.*?\b(lacZ|dnaA|thrA|araA|lysC|recA|gyrA|rpoB|trpA|pyrF|leuA|ilvA|metA|cysA|serA|proA|hisA|argA|valA|alaA|glyA|pheA|tyrA|trpA)/i.test(
        query
      ) ||
      /\bgene\s+(selection|selected|highlighted|active)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'select_gene',
        confidence: 0.9,
        reason: 'Gene selection/highlight keywords detected',
      });
    }

    // Check for sequence region selection patterns
    // Matches: "select region 1000-5000", "select the sequence from position X to Y", "highlight region"
    if (
      /\b(select|highlight|choose)\s+.*?\b(region|range|sequence\s+region|interval|area)\b/i.test(query) ||
      /\b(select|highlight)\s+.*?\b(position|coordinates?)\s+.*?\b(to|until|through|-)\b/i.test(query) ||
      /\bregion\s+(selection|selected|highlighted|active)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'select_sequence_region',
        confidence: 0.9,
        reason: 'Sequence region selection keywords detected',
      });
    }

    // Check for gene search patterns — SPECIFIC gene name/identifier lookup
    // Matches: "search for gene lacZ", "find gene b0062", "locate the gene called dnaA"
    // Does NOT match broad queries like "find kinase genes" (those go to search_features)
    if (
      /\b(search\s+for|find|look\s+up|locate)\s+(the\s+)?gene\b/i.test(query) ||
      /\bgene\s+(named|called|with\s+name)\b/i.test(query) ||
      /\bgene\s+search\b/i.test(query) ||
      /\blocus\s+tag\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'find_gene_by_name',
        confidence: 0.9,
        reason: 'Specific gene name/identifier lookup keywords detected',
      });
    }

    // Check for list_annotations patterns
    // Matches: "list annotations", "list all annotations", "show annotations in region",
    //          "display annotations", "list genes in region", "list features"
    if (
      /\b(list|show|display|get|view)\s+.*?\b(annotations?|genes?|features?)\b/i.test(query) &&
      !/\b(search|find|look\s+up)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'list_annotations',
        confidence: 0.95,
        reason: 'Annotation listing keywords detected (list/show/display annotations)',
      });
    }

    // Check for get_annotation (single annotation details) patterns
    // Matches: "get annotation details for lacZ", "annotation details", "get details for gene"
    if (
      /\b(get|show|retrieve|fetch|lookup)\s+.*?\b(annotation|gene)\s+.*?\b(details?|info|information)\b/i.test(query) ||
      (/\b(annotation|gene)\s+.*?\b(details?|info|information)\b/i.test(query) &&
        !/\b(list|all|search|find)\b/i.test(query))
    ) {
      relevantTools.push({
        name: 'get_annotation',
        confidence: 0.95,
        reason: 'Single annotation detail lookup keywords detected',
      });
    }

    // Check for search_annotations patterns
    // Matches: "search for annotations matching X", "search annotations", "find annotations"
    if (/\b(search|find)\s+.*?\bannotations?\b/i.test(query) || /\bsearch\s+annotations?\b/i.test(query)) {
      relevantTools.push({
        name: 'search_annotations',
        confidence: 0.95,
        reason: 'Annotation search keywords detected',
      });
    }

    // Check for get_nearby_features patterns
    // Matches: "features near position X", "nearby features", "genes around position",
    //          "features within Xbp of position", "flanking features"
    if (
      /\b(nearby|near|close|around|surrounding|flanking|neighborhood)\s+.*?\b(features?|genes?)\b/i.test(query) ||
      /\b(features?|genes?)\s+.*?\b(near|nearby|close|around|surrounding|flanking)\b/i.test(query) ||
      /\b(get|find|show)\s+.*?\b(nearby|near|flanking)\s+.*?\b(features?|genes?)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'get_nearby_features',
        confidence: 0.95,
        reason: 'Nearby features query keywords detected',
      });
    }

    // Check for feature search patterns — BROAD search by annotation/function/type
    // Matches: "search for features", "find all tRNA", "search kinase genes"
    // Key distinction: "kinase genes" → search_features (functional keyword)
    //                 "gene lacZ" → find_gene_by_name (specific identifier)
    if (
      /\b(search|find|look\s+up)\s+.*?\bfeatures?\b/i.test(query) ||
      (/\bannotation\b/i.test(query) &&
        !relevantTools.some(
          t => t.name === 'list_annotations' || t.name === 'get_annotation' || t.name === 'search_annotations'
        )) ||
      /\b(all|every)\s+(genes?|proteins?|cds|trna|rrna)\b/i.test(query) ||
      /\bfeatures?\s+search\b/i.test(query) ||
      /\b(search|find)\s+.*?\b(genes?|proteins?)\s+(by|with|related\s+to|containing)\s+(function|type|annotation|activity)/i.test(
        query
      )
    ) {
      relevantTools.push({
        name: 'search_features',
        confidence: 0.9,
        reason: 'Broad feature search by function/type/annotation keywords detected',
      });
    }

    // Check for tab management patterns
    // Patterns support: intermediate words (e.g., "switch to the analysis tab"),
    // plural forms (tabs/windows), and prepositions (go to, switch to)
    if (
      /\b(switch|change|activate|select|goto|go\s+to)\s+.*?\b(tabs?|windows?)\b/i.test(query) ||
      /\b(tabs?|windows?)\s+(switch|change|activate|select)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'switch_to_tab',
        confidence: 0.85,
        reason: 'Tab switching keywords detected',
      });
    }

    // Check for new tab patterns
    // Matches: "open a new tab", "open three new tabs", "create 2 new tabs",
    // "new tabs for comparison", "open two tabs", "new tab"
    if (
      /\b(open|create)\s+.*?\b(tabs?|windows?)\b/i.test(query) ||
      /\bnew\s+tabs?\b/i.test(query) ||
      /\b(tabs?|windows?)\s+for\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'open_new_tab',
        confidence: 0.85,
        reason: 'New tab keywords detected',
      });
    }

    // Check for close tab patterns
    // Matches: "close all tabs", "close the second tab", "close three tabs",
    // "remove multiple tabs", "close tab"
    if (
      /\b(close|remove|delete|dismiss)\s+.*?\b(tabs?|windows?)\b/i.test(query) ||
      /\b(tabs?|windows?)\s+(close|remove|delete|dismiss)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'close_tab',
        confidence: 0.85,
        reason: 'Close tab keywords detected',
      });
    }

    // Check for pan/scroll patterns
    // Supports: "scroll to the left", "pan to the right by 1000bp", "scroll left"
    if (
      /\b(scroll|pan|move)\s+.*?\b(left|right|up|down)\b/i.test(query) ||
      /\b(scroll|pan)\s+(left|right|up|down)\b/i.test(query)
    ) {
      const direction = query.match(/\b(left|right)\b/i)?.[1]?.toLowerCase();
      if (direction === 'left') {
        relevantTools.push({ name: 'pan_left', confidence: 0.9, reason: 'Pan/scroll left keywords detected' });
      } else if (direction === 'right') {
        relevantTools.push({ name: 'pan_right', confidence: 0.9, reason: 'Pan/scroll right keywords detected' });
      } else {
        relevantTools.push({ name: 'pan_left', confidence: 0.7, reason: 'Pan/scroll direction detected' });
        relevantTools.push({ name: 'pan_right', confidence: 0.7, reason: 'Pan/scroll direction detected' });
      }
    }

    // Check for save view state / bookmark patterns
    if (
      /\b(save|store|preserve|snapshot|capture)\s+.*?\b(view|state|position|workspace|layout)\b/i.test(query) ||
      /\b(save|store)\s+.*?\b(bookmark|view)\b/i.test(query)
    ) {
      relevantTools.push({ name: 'save_view_state', confidence: 0.9, reason: 'Save view state keywords detected' });
    }

    if (
      /\b(bookmark|mark|pin|flag)\s+.*?\b(position|location|region|spot)\b/i.test(query) ||
      /\b(add|create|make)\s+.*?\bbookmarks?\b/i.test(query)
    ) {
      relevantTools.push({ name: 'bookmark_position', confidence: 0.9, reason: 'Bookmark position keywords detected' });
    }

    if (/\b(bookmarks?|saved\s+views?)\b/i.test(query) && /\b(list|get|show|display|view|all)\b/i.test(query)) {
      relevantTools.push({ name: 'get_bookmarks', confidence: 0.85, reason: 'List bookmarks keywords detected' });
    }

    // Check for track toggle patterns
    // Supports: "toggle the coverage track", "show the gc track", "hide annotation track"
    if (
      /\b(toggle|show|hide|turn\s+(on|off)|enable|disable)\s+.*?\btrack\b/i.test(query) ||
      /\btrack\s+(toggle|show|hide|visibility|on|off)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'toggle_track',
        confidence: 0.9,
        reason: 'Track toggle keywords detected',
      });
    }

    // Check for track status/visibility patterns
    // Matches: "get track status", "track visibility", "which tracks are visible",
    //          "show track status", "current tracks"
    if (
      /\b(get|show|display|check|what|which)\s+.*?\btrack\s*(status|visibility|state)\b/i.test(query) ||
      /\btrack\s*(status|visibility|state)\b/i.test(query) ||
      /\b(which|what)\s+.*?\btracks?\s+.*?\b(visible|shown|hidden|active)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'get_track_status',
        confidence: 0.95,
        reason: 'Track status/visibility query keywords detected',
      });
    }

    // Check for delete_annotation patterns
    // Matches: "delete annotation", "remove annotation", "delete gene annotation"
    if (/\b(delete|remove|erase|drop)\s+.*?\b(annotation|gene|feature)\b/i.test(query)) {
      relevantTools.push({
        name: 'delete_annotation',
        confidence: 0.95,
        reason: 'Annotation deletion keywords detected',
      });
    }

    // Check for sequence analysis patterns
    if (/\b(sequence)\b/i.test(query)) {
      relevantTools.push({
        name: 'get_sequence',
        confidence: 0.9,
        reason: 'Sequence keyword detected',
      });
    }

    if (
      /\b(gc|content)\b/i.test(query) &&
      /\b(region|current\s+(view|region)|chromosome|chr|coordinate|position|genomic)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'calc_region_gc',
        confidence: 0.9,
        reason: 'Genomic region GC content keywords detected',
      });
    } else if (/\b(gc|content)\b/i.test(query)) {
      relevantTools.push({
        name: 'compute_gc',
        confidence: 0.8,
        reason: 'GC content keywords detected',
      });
    }

    if (
      /\b(calculate|compute|measure|determine)\s+.*?\b(entropy|complexity|information\s+content)\b/i.test(query) ||
      /\b(entropy|shannon)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'calculate_entropy',
        confidence: 0.85,
        reason: 'Sequence entropy keywords detected',
      });
    }

    if (
      /\b(calculate|compute|measure|determine)\s+.*?\b(molecular\s+weight|molar\s+mass|mw|daltons?)\b/i.test(query) ||
      /\b(molecular\s+weight|molar\s+mass)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'calculate_molecular_weight',
        confidence: 0.85,
        reason: 'Molecular weight keywords detected',
      });
    }

    // Check for export patterns
    if (/\b(export|save|download|write|output)\b/i.test(query)) {
      if (/\b(fasta|fa|sequence\s+file)\b/i.test(query) && !/\b(cds|protein|coding)\b/i.test(query)) {
        relevantTools.push({
          name: 'export_fasta_sequence',
          confidence: 0.9,
          reason: 'FASTA export keywords detected',
        });
      }
      if (/\b(genbank|gbk|gb)\b/i.test(query)) {
        relevantTools.push({
          name: 'export_genbank_format',
          confidence: 0.9,
          reason: 'GenBank export keywords detected',
        });
      }
      if (/\b(gff|gff3|annotation\s+format)\b/i.test(query)) {
        relevantTools.push({
          name: 'export_gff_annotations',
          confidence: 0.9,
          reason: 'GFF export keywords detected',
        });
      }
      if (/\b(bed|bed\s+format)\b/i.test(query)) {
        relevantTools.push({
          name: 'export_bed_format',
          confidence: 0.9,
          reason: 'BED export keywords detected',
        });
      }
      if (/\b(cds|coding\s+sequence)\b/i.test(query) && /\b(fasta|export|save)\b/i.test(query)) {
        relevantTools.push({
          name: 'export_cds_fasta',
          confidence: 0.9,
          reason: 'CDS FASTA export keywords detected',
        });
      }
      if (/\b(protein|amino\s+acid|peptide)\b/i.test(query) && /\b(fasta|export|save)\b/i.test(query)) {
        relevantTools.push({
          name: 'export_protein_fasta',
          confidence: 0.9,
          reason: 'Protein FASTA export keywords detected',
        });
      }
      if (
        /\b(current\s+view|visible\s+region|current\s+region)\b/i.test(query) &&
        /\b(fasta|export|save)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'export_current_view_fasta',
          confidence: 0.9,
          reason: 'Current view FASTA export keywords detected',
        });
      }
      // Generic export pattern
      if (!relevantTools.some(t => t.name.startsWith('export_'))) {
        relevantTools.push({
          name: 'export_fasta_sequence',
          confidence: 0.7,
          reason: 'Generic export keywords detected',
        });
      }
    }

    // Check for sequence editing patterns
    // Supports intermediate words: "replace the sequence at position 100", "edit the sequence here"
    if (
      /\b(replace|substitute|swap)\s+.*?\b(sequence|region|bases?|nucleotides?)\b/i.test(query) ||
      /\b(edit|modify)\s+.*?\bsequence\b/i.test(query) ||
      /\bmutate\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'replace_sequence',
        confidence: 0.9,
        reason: 'Sequence replacement/editing keywords detected',
      });
    }

    if (/\b(delete|remove)\s+.*?\b(sequence|region|bases?|nucleotides?)\b/i.test(query)) {
      relevantTools.push({
        name: 'delete_sequence',
        confidence: 0.9,
        reason: 'Sequence deletion keywords detected',
      });
    }

    if (/\b(insert|add)\s+.*?\b(sequence|bases?|nucleotides?)\b/i.test(query)) {
      relevantTools.push({
        name: 'insert_sequence',
        confidence: 0.9,
        reason: 'Sequence insertion keywords detected',
      });
    }

    if (
      /\b(show|display|open|view|inspect|get|list)\s+.*?\b(action\s+list|actions?\s+queue|sequence\s+editing\s+queue)\b/i.test(
        query
      ) ||
      /\b(action\s+list|actions?\s+queue|sequence\s+editing\s+queue)\s+.*?\b(show|display|open|view|inspect|get|list)\b/i.test(
        query
      )
    ) {
      relevantTools.push(
        {
          name: 'show_action_list',
          confidence: 0.95,
          reason: 'Action list interface keywords detected',
        },
        {
          name: 'get_action_list',
          confidence: 0.9,
          reason: 'Action queue inspection keywords detected',
        }
      );
    }

    // Check for clipboard content patterns
    // Matches: "get clipboard content", "what is in the clipboard", "show clipboard",
    //          "check clipboard", "clipboard content", "what was copied"
    if (
      /\b(clipboard)\s+.*?\b(content|contents?|data|sequence|what|show|get|check)\b/i.test(query) ||
      /\b(get|show|check|display|view|what)\s+.*?\bclipboard\b/i.test(query) ||
      /\b(what)\s+.*?\b(copied|cut|in)\s+.*?\b(clipboard)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'get_clipboard_content',
        confidence: 0.95,
        reason: 'Clipboard content query keywords detected',
      });
    }

    // Check for track settings patterns
    if (
      /\b(track\s+settings?|track\s+options?|track\s+config|configure\s+track|display\s+settings?|track\s+styling?)\b/i.test(
        query
      ) ||
      /\b(configure|set|change|adjust|update|reset|get|show|view|retrieve)\s+.*?\b(track\s+settings?|track\s+options?|track\s+configs?)\b/i.test(
        query
      )
    ) {
      relevantTools.push({
        name: 'get_track_settings',
        confidence: 0.85,
        reason: 'Track settings keywords detected',
      });
      relevantTools.push({
        name: 'set_track_settings',
        confidence: 0.85,
        reason: 'Track settings configuration keywords detected',
      });
      relevantTools.push({
        name: 'get_all_track_settings',
        confidence: 0.8,
        reason: 'Track settings query keywords detected',
      });
      relevantTools.push({
        name: 'reset_track_settings',
        confidence: 0.8,
        reason: 'Track settings reset keywords detected',
      });
      relevantTools.push({
        name: 'get_track_settings_schema',
        confidence: 0.8,
        reason: 'Track settings schema query keywords detected',
      });
      relevantTools.push({
        name: 'batch_set_track_settings',
        confidence: 0.8,
        reason: 'Batch track settings configuration keywords detected',
      });
    }

    // Check for settings modal open/close/toggle patterns
    if (
      /\b(open|close|show|hide|toggle|launch|display)\s+(settings?|config|preferences?|options?)\b/i.test(query) ||
      /\b(settings?|config|preferences?)\s+(modal|panel|window|dialog)\b/i.test(query) ||
      /\b(llm\s+config|chatbox\s+settings|general\s+settings|track\s+settings|mcp\s+settings|agent\s+settings|multi[-\s]?agent\s+settings|tab\s+settings|search\s+settings|gene\s+detail\s+settings|external\s+tools?\s+settings|plugin\s+(management|settings)|literature\s+settings)\b/i.test(
        query
      ) ||
      /\bconfigure\s+(llm|model|chat|agent|mcp|track|search|plugin)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'toggle_settings_modal',
        confidence: 0.9,
        reason: 'Settings modal open/close/toggle keywords detected',
      });
    }

    // Check for UI style / theme switching patterns
    if (
      /\b(switch|change|set|apply|activate|use)\s+.*?\b(ui\s*style|style|theme|appearance|color\s*scheme|visual\s*style|look\s*and\s*feel)\b/i.test(
        query
      ) ||
      /\b(ui\s*style|theme|appearance)\s+.*?\b(switch|change|set|apply|activate|toggle)\b/i.test(query) ||
      /\b(switch\s+style|change\s+style|switch\s+theme|change\s+theme|switch\s+ui|change\s+ui)\b/i.test(query) ||
      /\b(light\s*mode|enable\s*light|turn\s+on\s+light)\b/i.test(query) ||
      /\b(ai\s*dynamic|professional\s*style|minimal\s*style|elegant\s*style|midnight\s*style|pastel\s*style|amy\s*style|pink\s*blue\s*style|red\s*style|crimson\s*style)\b/i.test(
        query
      )
    ) {
      relevantTools.push({
        name: 'switch_ui_style',
        confidence: 0.95,
        reason: 'UI style/theme switching keywords detected',
      });
    }

    // Check for benchmark patterns
    if (/\b(benchmark|benchmarks)\b/i.test(query)) {
      // start_benchmark (check FIRST — 'start' and 'run' are the primary trigger verbs)
      if (
        /\b(start|run|execute|begin|kick\s+off)\s+.*?\bbenchmark\b/i.test(query) ||
        /\bbenchmark\s+.*?\b(start|run|execute|begin)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'start_benchmark',
          confidence: 0.95,
          reason: 'Benchmark start/run keywords detected',
        });
      } else if (
        /\b(open|show|display|launch|view)\s+.*?\bbenchmark\b/i.test(query) ||
        /\bbenchmark\s+.*?\b(panel|interface|window|ui)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'open_benchmark',
          confidence: 0.9,
          reason: 'Benchmark interface open keywords detected',
        });
      }
      // If query contains just 'benchmark' alone (no other verb), include both open and start
      if (/^\s*benchmark\s*$/i.test(query.trim()) || /^\s*benchmarks?\s*(please|now)?\s*$/i.test(query.trim())) {
        relevantTools.push({
          name: 'open_benchmark',
          confidence: 0.85,
          reason: 'Standalone benchmark keyword — offering interface',
        });
        relevantTools.push({
          name: 'start_benchmark',
          confidence: 0.85,
          reason: 'Standalone benchmark keyword — offering start',
        });
      }
      // stop_benchmark
      if (
        /\b(stop|cancel|halt|abort|terminate|end)\s+.*?\bbenchmark\b/i.test(query) ||
        /\bbenchmark\s+.*?\b(stop|cancel|halt|abort|terminate|end)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'stop_benchmark',
          confidence: 0.9,
          reason: 'Benchmark stop/cancel keywords detected',
        });
      }
      // pause_benchmark
      if (
        /\b(pause|suspend|hold|freeze)\s+.*?\bbenchmark\b/i.test(query) ||
        /\bbenchmark\s+.*?\b(pause|suspend|hold|freeze)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'pause_benchmark',
          confidence: 0.9,
          reason: 'Benchmark pause keywords detected',
        });
      }
      // resume_benchmark
      if (
        /\b(resume|continue|unpause|restart)\s+.*?\bbenchmark\b/i.test(query) ||
        /\bbenchmark\s+.*?\b(resume|continue|unpause)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'resume_benchmark',
          confidence: 0.9,
          reason: 'Benchmark resume/continue keywords detected',
        });
      }
      // get_benchmark_results
      if (
        /\bbenchmark\s+.*?\b(result|results|stat|stats|statistics|history|score|scores|report)\b/i.test(query) ||
        /\b(result|results|stat|stats|statistics|history|score|scores|report)\s+.*?\bbenchmark\b/i.test(query) ||
        /\b(get|show|view|display)\s+.*?\bbenchmark\s+.*?\b(result|stat|history|score|report)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'get_benchmark_results',
          confidence: 0.9,
          reason: 'Benchmark results/statistics keywords detected',
        });
      }
      // get_benchmark_status
      if (
        /\bbenchmark\s+.*?\b(status|state|running|ready|initialized)\b/i.test(query) ||
        /\b(status|state|check)\s+.*?\bbenchmark\b/i.test(query) ||
        /\bis\s+.*?\bbenchmark\s+.*?\b(running|ready|available)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'get_benchmark_status',
          confidence: 0.9,
          reason: 'Benchmark status/state keywords detected',
        });
      }
      // export_benchmark_results
      if (
        /\b(export|save|download)\s+.*?\bbenchmark\b/i.test(query) ||
        /\bbenchmark\s+.*?\b(export|save|download)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'export_benchmark_results',
          confidence: 0.9,
          reason: 'Benchmark export keywords detected',
        });
      }
    }

    // Check for primer design patterns
    if (/\b(primers?|pcr|amplif\w*)\b/i.test(query)) {
      if (/\b(design|create|generate|find)\b/i.test(query)) {
        relevantTools.push({
          name: 'design_primers',
          confidence: 0.9,
          reason: 'Primer design keywords detected',
        });
      }
      if (/\b(propert(y|ies)|tm|melting|gc|length|weight|stability|structure)\b/i.test(query)) {
        relevantTools.push({
          name: 'calculate_primer_properties',
          confidence: 0.9,
          reason: 'Primer properties keywords detected',
        });
      }
      if (
        /\b(binding\s+sites?|anneal\w*|specificity|target|match|mismatch|off.?target|non.?specific|cross.?react|thermodynamic|binding\s+.*?strength)\b/i.test(
          query
        )
      ) {
        relevantTools.push({
          name: 'find_primer_binding_sites',
          confidence: 0.95,
          reason: 'Primer binding site keywords detected',
        });
      }
      if (
        /\b(add|annotate|display|visuali[sz]e|draw)\s+.*?\bprimers?\b/i.test(query) ||
        /\bprimers?\s+.*?\b(display|visuali[sz]e|annotation)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'save_primer',
          confidence: 0.9,
          reason: 'Primer save/visualization keywords detected',
        });
      }
      if (
        /\b(list|show|display|get)\s+.*?\bprimer\s+annotations?\b/i.test(query) ||
        /\bprimers?\s+.*?\b(list|annotations?|current|shown|displayed)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'list_primers',
          confidence: 0.9,
          reason: 'Primer listing keywords detected',
        });
      }
      if (
        /\b(clear|remove|delete)\s+.*?\bprimer\s+annotations?\b/i.test(query) ||
        /\bprimers?\s+.*?\b(clear|remove|delete)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'delete_primers',
          confidence: 0.9,
          reason: 'Primer deletion keywords detected',
        });
      }
    }

    // Check for annotation patterns
    // Supports intermediate words: "create a new annotation", "add an annotation here"
    if (/\b(create|add|make)\s+.*?\bannotation\b/i.test(query) || /\bannotate\b/i.test(query)) {
      relevantTools.push({
        name: 'create_annotation',
        confidence: 0.85,
        reason: 'Annotation creation keywords detected',
      });
    }

    if (/\b(update|edit|modify|change|rewrite|patch)\s+.*?\bannotations?\b/i.test(query)) {
      if (/\b(bulk|batch|multiple|all)\b/i.test(query)) {
        relevantTools.push({
          name: 'bulk_update_annotations',
          confidence: 0.9,
          reason: 'Bulk annotation update keywords detected',
        });
      } else {
        relevantTools.push({
          name: 'update_annotation',
          confidence: 0.9,
          reason: 'Annotation update keywords detected',
        });
      }
    }

    if (
      /\b(get|retrieve|fetch|show|view|find|search|list|query)\s+.*?\bannotations?\b/i.test(query) ||
      /\bannotations?\s+.*?\b(get|retrieve|fetch|show|view|find|search|list|query)\b/i.test(query)
    ) {
      if (/\b(list|all|region|visible)\b/i.test(query)) {
        relevantTools.push({
          name: 'list_annotations',
          confidence: 0.85,
          reason: 'Annotation listing keywords detected',
        });
      } else if (/\b(search|find|query|lookup)\b/i.test(query)) {
        relevantTools.push({
          name: 'search_annotations',
          confidence: 0.85,
          reason: 'Annotation search keywords detected',
        });
      } else {
        relevantTools.push({
          name: 'get_annotation',
          confidence: 0.85,
          reason: 'Annotation retrieval keywords detected',
        });
      }
    }

    if (
      /\b(history|updates|changes|logs)\s+.*?\bannotations?\b/i.test(query) ||
      /\bannotations?\s+.*?\b(history|updates|changes|logs)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'get_annotation_history',
        confidence: 0.9,
        reason: 'Annotation history/log keywords detected',
      });
    }

    if (/\b(get|show|view|retrieve|details|info|information)\s+.*?\bgenes?\b/i.test(query)) {
      relevantTools.push({
        name: 'get_gene_details',
        confidence: 0.85,
        reason: 'Gene details query keywords detected',
      });
    }

    if (/\b(get|show|find|list|predict)\s+.*?\boperons?\b/i.test(query) || /\boperons?\b/i.test(query)) {
      relevantTools.push({
        name: 'get_operons',
        confidence: 0.9,
        reason: 'Operon query keywords detected',
      });
    }

    if (
      /\b(nearby|adjacent|neighboring)\s+.*?\b(features?|genes?)\b/i.test(query) ||
      /\b(features?|genes?)\s+.*?\b(nearby|adjacent|neighboring)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'get_nearby_features',
        confidence: 0.9,
        reason: 'Nearby features query keywords detected',
      });
    }

    if (
      /\b(find|search|identify|get|list)\s+.*?\bintergenic\s+regions?\b/i.test(query) ||
      /\bintergenic\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'find_intergenic_regions',
        confidence: 0.9,
        reason: 'Intergenic regions query keywords detected',
      });
    }

    // Check for database search patterns - UniProt
    if (/\b(uniprot|protein\s+database|search\s+protein|protein\s+search)\b/i.test(query)) {
      if (/\b(advanced|multiple|complex)\b/i.test(query)) {
        relevantTools.push({
          name: 'advanced_uniprot_search',
          confidence: 0.9,
          reason: 'Advanced UniProt search keywords detected',
        });
      } else if (/\b(get|retrieve|fetch|entry|id)\b/i.test(query)) {
        relevantTools.push({
          name: 'get_uniprot_entry',
          confidence: 0.9,
          reason: 'UniProt entry retrieval keywords detected',
        });
      } else {
        relevantTools.push({
          name: 'search_uniprot_database',
          confidence: 0.85,
          reason: 'UniProt database search keywords detected',
        });
      }
    }

    // Check for database search patterns - InterPro
    if (/\b(interpro|domain|family|families|functional\s+site)\b/i.test(query)) {
      if (
        /\b(analyze|analysis|predict|domain\s+analysis)\b/i.test(query) ||
        /\b(protein\s+domain|domain\s+architecture)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'analyze_interpro_domains',
          confidence: 0.95,
          reason: 'InterPro domain analysis keywords detected',
        });
      } else if (/\b(get|retrieve|fetch|entry|details)\b/i.test(query)) {
        relevantTools.push({
          name: 'get_interpro_entry_details',
          confidence: 0.9,
          reason: 'InterPro entry details keywords detected',
        });
      } else if (/\b(search|find|lookup)\b/i.test(query)) {
        relevantTools.push({
          name: 'search_interpro_entry',
          confidence: 0.85,
          reason: 'InterPro search keywords detected',
        });
      } else {
        // Generic domain mention - suggest search
        relevantTools.push({
          name: 'search_interpro_entry',
          confidence: 0.75,
          reason: 'Domain-related keywords detected, suggesting InterPro search',
        });
      }
    }

    // Check for protein/domain analysis patterns (generic)
    if (
      /\b(protein|domain|pfam|smart|prosite)\b/i.test(query) &&
      /\b(analyze|analysis|identify|predict|find)\b/i.test(query)
    ) {
      // Add InterPro domain analysis if not already added
      if (!relevantTools.some(t => t.name === 'analyze_interpro_domains')) {
        relevantTools.push({
          name: 'analyze_interpro_domains',
          confidence: 0.8,
          reason: 'Generic protein domain analysis keywords detected',
        });
      }
    }

    // Check for specific domain names or "has/have domains" patterns
    if (/\b(kinase|phosphatase|transferase|helicase|protease)\b/i.test(query) && /\b(domain|domains)\b/i.test(query)) {
      if (!relevantTools.some(t => t.name === 'search_interpro_entry')) {
        relevantTools.push({
          name: 'search_interpro_entry',
          confidence: 0.85,
          reason: 'Specific domain type search detected',
        });
      }
    }

    // Check for "what domains" or "which domains" patterns
    if (/\b(what|which|show|list)\b/i.test(query) && /\b(domain|domains)\b/i.test(query)) {
      if (!relevantTools.some(t => t.name === 'analyze_interpro_domains')) {
        relevantTools.push({
          name: 'analyze_interpro_domains',
          confidence: 0.85,
          reason: 'Domain query pattern detected',
        });
      }
    }

    // Check for protein structure viewer patterns
    // Matches: "open protein viewer", "open alphafold viewer", "show 3D structure", "visualize protein structure"
    if (
      /\b(open|show|display|launch|visualize|view)\s+.*?\b(protein\s+viewer|alphafold\s+viewer|3[dD]\s+structure|structure\s+viewer)\b/i.test(
        query
      ) ||
      /\b(protein|alphafold)\s+.*?\b(viewer|3[dD]|visualization)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'open_protein_viewer',
        confidence: 0.9,
        reason: 'Protein structure viewer keywords detected',
      });
    }

    // Check for BLAST patterns
    if (/\b(blast|alignment|align|sequence\s+search|homology)\b/i.test(query)) {
      if (/\b(online|web|remote|internet|ncbi)\b/i.test(query)) {
        relevantTools.push({
          name: 'blast_search_online',
          confidence: 0.95,
          reason: 'Online BLAST keywords detected',
        });
      } else if (/\b(local|offline|server|host)\b/i.test(query)) {
        relevantTools.push({
          name: 'blast_search_local',
          confidence: 0.95,
          reason: 'Local BLAST keywords detected',
        });
      } else if (/\b(create|make|build|generate|setup)\s+.*?\b(db|database)\b/i.test(query)) {
        if (/\b(chrom|chromosome|chr\d+|plasmid|replicon)\b/i.test(query)) {
          relevantTools.push({
            name: 'blast_create_db_from_genome',
            confidence: 0.95,
            reason: 'Create BLAST database for specific chromosome keywords detected',
          });
        } else {
          relevantTools.push({
            name: 'blast_create_quick_db_for_current_genome',
            confidence: 0.95,
            reason: 'Create BLAST database for entire genome keywords detected',
          });
        }
      } else if (/\b(list|show|view|get|available)\s+.*?\b(dbs|databases)\b/i.test(query)) {
        relevantTools.push({
          name: 'blast_list_databases',
          confidence: 0.95,
          reason: 'List BLAST databases keywords detected',
        });
      } else if (/\b(filter|limit|restrict)\s+.*?\b(results|hits|alignments)\b/i.test(query)) {
        relevantTools.push({
          name: 'blast_filter_results',
          confidence: 0.9,
          reason: 'Filter BLAST results keywords detected',
        });
      } else if (/\b(status|install|available|configured|check)\b/i.test(query)) {
        relevantTools.push({
          name: 'blast_get_installation_status',
          confidence: 0.9,
          reason: 'Check BLAST installation status keywords detected',
        });
      } else {
        // Broad default BLAST triggers
        relevantTools.push({
          name: 'blast_search_online',
          confidence: 0.8,
          reason: 'Broad BLAST keywords detected (defaulting to online search)',
        });
        relevantTools.push({
          name: 'blast_search_local',
          confidence: 0.8,
          reason: 'Broad BLAST keywords detected (defaulting to local search)',
        });
        relevantTools.push({
          name: 'blast_create_quick_db_for_current_genome',
          confidence: 0.75,
          reason: 'Broad BLAST keywords detected (offering database creation)',
        });
        relevantTools.push({
          name: 'blast_list_databases',
          confidence: 0.75,
          reason: 'Broad BLAST keywords detected (offering database list)',
        });
        relevantTools.push({
          name: 'blast_get_installation_status',
          confidence: 0.7,
          reason: 'Broad BLAST keywords detected (offering installation check)',
        });
      }
    }

    // Check for restriction analysis / pattern search patterns
    if (/\b(restriction|enzyme|digest|cut|recognition\s+site|cleave)\b/i.test(query)) {
      if (/\b(list|show|browse|available|what\s+enzymes)\b/i.test(query)) {
        relevantTools.push({
          name: 'list_restriction_enzymes',
          confidence: 0.95,
          reason: 'Enzyme list/browse keywords detected',
        });
      } else if (/\b(digest|simulate|virtual|run|perform)\b/i.test(query)) {
        relevantTools.push({
          name: 'virtual_digest',
          confidence: 0.95,
          reason: 'Virtual restriction digest keywords detected',
        });
        relevantTools.push({
          name: 'find_restriction_sites',
          confidence: 0.8,
          reason: 'Restriction site mapping also relevant to digest',
        });
        if (/\b(gel|electrophoresis|show|visualize)\b/i.test(query)) {
          relevantTools.push({
            name: 'simulate_gel_electrophoresis',
            confidence: 0.9,
            reason: 'Gel visualization requested alongside digest',
          });
        }
      } else {
        relevantTools.push({
          name: 'find_restriction_sites',
          confidence: 0.95,
          reason: 'Restriction site mapping keywords detected',
        });
        relevantTools.push({
          name: 'virtual_digest',
          confidence: 0.85,
          reason: 'Restriction enzyme digest simulation keywords detected',
        });
      }
    }

    if (
      /\b(search|find|locate|match)\s+.*?\b(pattern|motif|sequence|regex|regular\s+expression|string)\b/i.test(query) ||
      /\b(pattern|motif|regex)\s+.*?\b(search|find|locate|match)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'search_pattern',
        confidence: 0.85,
        reason: 'Sequence pattern or motif search keywords detected',
      });
    }

    if (
      /\b(gel|electrophoresis|agarose)\b/i.test(query) ||
      /\b(run|simulate|show|visualize)\s+.*?\b(gel|electrophoresis)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'simulate_gel_electrophoresis',
        confidence: 0.95,
        reason: 'Gel electrophoresis simulation keywords detected',
      });
      relevantTools.push({
        name: 'virtual_digest',
        confidence: 0.8,
        reason: 'Virtual digest is prerequisite for gel simulation',
      });
    }

    if (
      /\b(dna\s+marker|dna\s+ladder|marker|ladder)\b/i.test(query) &&
      /\b(list|show|browse|available|search|find|what)\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'list_dna_markers',
        confidence: 0.9,
        reason: 'DNA marker/ladder browse keywords detected',
      });
    }

    return relevantTools;
  }

  /**
   * Get built-in tools statistics
   */
  getBuiltInToolsStats() {
    const stats = {
      total_builtin_tools: this.builtInToolsMap.size,
      categories: {},
    };

    for (const [toolName, toolInfo] of this.builtInToolsMap.entries()) {
      if (!stats.categories[toolInfo.category]) {
        stats.categories[toolInfo.category] = {
          count: 0,
          tools: [],
        };
      }
      stats.categories[toolInfo.category].count++;
      stats.categories[toolInfo.category].tools.push(toolName);
    }

    return stats;
  }

  /**
   * Generate non-dynamic system prompt with built-in tools emphasis
   */
  generateNonDynamicSystemPrompt(context = {}) {
    const fileLoadingTools = this.getBuiltInToolsByCategory('file_loading');
    const navigationTools = this.getBuiltInToolsByCategory('navigation');
    const sequenceTools = this.getBuiltInToolsByCategory('sequence');
    const databaseTools = this.getBuiltInToolsByCategory('database');
    const systemTools = this.getBuiltInToolsByCategory('system');

    return `# CodeXomics - Built-in Tools System (Non-Dynamic Mode)

You are an advanced AI assistant for CodeXomics with access to high-performance built-in tools.

## 🧬 Current Context
- **Network Status**: ${context.hasNetwork ? 'Connected' : 'Offline'}
- **Authentication**: ${context.hasAuth ? 'Authenticated' : 'Not authenticated'}
- **Loaded Files**: ${context.loadedFiles || 0} files
- **Current Position**: ${context.currentPosition || 'None'}

## 🔧 Built-in File Loading Tools (Highest Priority)

${fileLoadingTools.map(tool => `- **${tool.name}**: Built-in ${tool.category} tool`).join('\n')}

**File Loading Instructions:**
- Use load_genome_file for FASTA/GenBank genome files (.fasta, .fa, .genbank, .gbk, .gb)
- Use load_annotation_file for annotation files (.gff, .gff3, .bed, .gtf)
- Use load_variant_file for variant files (.vcf)
- Use load_reads_file for read alignment files (.sam, .bam)
- Use load_wig_tracks for track files (.wig, .bigwig, .bedgraph)
- Use load_operon_file for operon/regulatory files (.json, .csv, .txt)

## 🧭 Built-in Navigation & Tab Management Tools

${navigationTools.map(tool => `- **${tool.name}**: Built-in ${tool.category} tool`).join('\n')}

**Tab Management Instructions:**
- Use open_new_tab to create new analysis tabs for parallel workflows
- Use switch_to_tab to navigate between existing tabs by ID, name, or index
- Use close_tab to close tabs by ID, name, or index (cannot close the last remaining tab)
- Use navigate_to_position to move within the current tab to specific genomic locations

## 🧬 Built-in Sequence Analysis Tools

${sequenceTools.map(tool => `- **${tool.name}**: Built-in ${tool.category} tool`).join('\n')}

## 🗄️ Built-in Database Integration Tools

${databaseTools.map(tool => `- **${tool.name}**: Built-in ${tool.category} tool`).join('\n')}

**Database Tools Instructions:**
- **UniProt Tools**: Search and retrieve protein information from UniProt database
  - search_uniprot_database: Basic protein/gene searches
  - advanced_uniprot_search: Complex multi-field searches
  - get_uniprot_entry: Get detailed entry by UniProt ID

- **InterPro Tools**: Analyze protein domains and functional sites
  - analyze_interpro_domains: Analyze domains by **sequence**, UniProt ID, or gene name
  - search_interpro_entry: Search InterPro database for domain families
  - get_interpro_entry_details: Get detailed InterPro entry information

**Important**: analyze_interpro_domains supports three input methods:
  1. Direct sequence: Provide protein amino acid sequence
  2. Gene name: Provide gene name + organism (auto-resolves sequence)
  3. UniProt ID: Provide UniProt accession ID (auto-resolves sequence)

## ⚙️ Built-in System Tools

${systemTools.map(tool => `- **${tool.name}**: Built-in ${tool.category} tool`).join('\n')}

## 🎯 Tool Usage Guidelines

1. **File Loading Priority**: Always use built-in file loading tools for importing data
2. **Database Access**: Use built-in database tools for protein/domain analysis
3. **Direct Execution**: Built-in tools execute directly without external dependencies
4. **Performance**: Built-in tools are optimized for speed and reliability
5. **Error Handling**: Built-in tools provide comprehensive error messages

## ⚡ Response Format

For built-in tools, respond with JSON:
${'```'}json
{"tool_name": "tool_name", "parameters": {"param1": "value1"}}
${'```'}

## 📊 Built-in Tools Advantages

- **Speed**: Direct execution without network overhead
- **Reliability**: No external dependencies
- **Integration**: Deep integration with genome browser
- **Optimization**: Specifically optimized for genomic data
- **Flexibility**: Multiple input methods for database tools

Remember: Built-in tools are your primary toolkit for file operations, database access, and core functionality. Use them for the best performance and reliability.`;
  }
}

module.exports = BuiltInToolsIntegration;
