// @ts-check
/**
 * Hardcoded AI-callable tool capability policy categories.
 *
 * Keep this in source code rather than YAML/JSON config so execution policy
 * remains explicit and reviewable.
 */
class ToolCapabilityPolicy {
  constructor() {
    this.policies = {
      file_operations: {
        tools: [
          'load_genome',
          'load_genome_file',
          'load_fasta',
          'load_fasta_file',
          'load_genbank',
          'load_genbank_file',
          'load_gbk',
          'load_gbk_file',
          'load_annotation',
          'load_annotation_file',
          'load_bed',
          'load_bed_file',
          'load_gff',
          'load_gff_file',
          'load_gff3',
          'load_gff3_file',
          'load_gtf',
          'load_gtf_file',
          'load_variant',
          'load_variant_file',
          'load_vcf',
          'load_vcf_file',
          'load_reads',
          'load_reads_file',
          'load_bam',
          'load_bam_file',
          'load_sam',
          'load_sam_file',
          'load_wig',
          'load_wig_file',
          'load_wig_tracks',
          'load_bigwig',
          'load_bigwig_file',
          'load_bedgraph',
          'load_bedgraph_file',
          'load_track',
          'load_track_file',
          'load_tracks',
          'load_operon',
          'load_operons',
          'load_operon_file',
        ],
        policy: 'conditional_re_execution',
      },

      ui_operations: {
        tools: [
          'open_new_tab',
          'close_tab',
          'switch_tab',
          'create_annotation',
          'update_annotation',
          'delete_annotation',
          'bulk_update_annotations',
          'get_annotation_history',
          'delete_feature',
          'export_data',
        ],
        policy: 'once_per_round',
      },

      position_navigation: {
        tools: ['navigate_to_position'],
        policy: 'parameter_based',
      },

      scroll_operations: {
        tools: ['scroll_left', 'scroll_right', 'pan_left', 'pan_right'],
        policy: 'always_allowed',
      },

      task_management: {
        tools: ['add_task', 'update_task', 'list_tasks', 'clear_tasks', 'delete_task'],
        policy: 'always_allowed',
      },

      system_utility: {
        tools: [
          'set_working_directory',
          'utility_download_internet_file',
          'utility_toggle_settings_modal',
          'open_benchmark',
          'start_benchmark',
          'stop_benchmark',
          'pause_benchmark',
          'resume_benchmark',
          'get_benchmark_results',
          'get_benchmark_status',
          'export_benchmark_results',
        ],
        policy: 'always_allowed',
      },

      sequence_editing_actions: {
        tools: [
          'copy_sequence',
          'cut_sequence',
          'paste_sequence',
          'delete_sequence',
          'insert_sequence',
          'replace_sequence',
          'execute_actions',
          'get_action_list',
          'show_action_list',
          'clear_actions',
          'get_clipboard_content',
        ],
        policy: 'always_allowed',
      },

      zoom_operations: {
        tools: ['zoom_in', 'zoom_out'],
        policy: 'rate_limited',
      },

      feature_navigation: {
        tools: ['jump_to_gene', 'jump_to_feature', 'focus_on_gene', 'select_gene', 'select_sequence_region'],
        policy: 'parameter_based',
      },

      search: {
        tools: ['find_gene_by_name', 'search_features', 'search_sequence_motif'],
        policy: 'parameter_based',
      },

      analysis: {
        tools: [
          'codon_usage_analysis',
          'compute_gc',
          'translate_dna',
          'reverse_complement',
          'get_coding_sequence',
          'analyze_interpro_domains',
          'calculate_molecular_weight',
          'calculate_entropy',
          'find_restriction_sites',
          'virtual_digest',
          'list_restriction_enzymes',
          'simulate_gel_electrophoresis',
        ],
        policy: 'parameter_based',
      },

      primer_design: {
        tools: [
          'design_primers',
          'calculate_primer_properties',
          'find_primer_binding_sites',
          'add_primer_annotation',
          'list_primer_annotations',
          'clear_primer_annotations',
        ],
        policy: 'parameter_based',
      },

      display_operations: {
        tools: ['show_hide_features', 'set_view_mode', 'refresh_view'],
        policy: 'once_per_round',
      },

      track_operations: {
        tools: ['toggle_track', 'toggle_annotation_track'],
        policy: 'parameter_based_rate_limited',
      },

      state: {
        tools: [
          'get_current_state',
          'get_genome_info',
          'get_file_info',
          'get_sequence',
          'get_current_region',
          'get_visible_tracks',
          'get_annotation',
          'list_annotations',
          'search_annotations',
          'get_operons',
        ],
        policy: 'parameter_based',
      },

      external_api: {
        tools: [
          'blast_search',
          'fetch_protein_structure',
          'get_uniprot_entry',
          'search_uniprot_database',
          'advanced_uniprot_search',
          'search_interpro_entry',
          'get_interpro_entry_details',
          'fetch_alphafold_structure',
        ],
        policy: 'rate_limited',
      },
    };
  }

  getPolicyForTool(toolName) {
    for (const [name, policy] of Object.entries(this.policies)) {
      if (policy.tools.includes(toolName)) {
        return { name, policy };
      }
    }

    return { name: null, policy: null };
  }
}

if (typeof window !== 'undefined') {
  window.ToolCapabilityPolicy = ToolCapabilityPolicy;
}

if (typeof globalThis !== 'undefined') {
  globalThis.ToolCapabilityPolicy = ToolCapabilityPolicy;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToolCapabilityPolicy;
}
