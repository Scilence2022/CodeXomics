/**
 * Tool Category Manager
 * Separates tools into server-side (remote executable) and client-side (requires local browser)
 */

class ToolCategoryManager {
  constructor() {
    // Define which tools can run server-side (remotely)
    this.serverSideTools = new Set([
      // Database tools
      'search_uniprot_database',
      'advanced_uniprot_search',
      'get_uniprot_entry',
      'analyze_interpro_domains',
      'search_interpro_entry',
      'get_interpro_entry_details',

      // Protein structure tools
      'fetch_protein_structure',
      'search_alphafold_structures',
      'fetch_alphafold_structure',
      'search_alphafold_by_sequence',

      // Sequence analysis tools (pure computation)
      'compute_gc',
      'translate_dna',
      'reverse_complement',
      'codon_usage_analysis',

      // Note: list_genome_windows and switch_active_window moved to clientSideTools
      // because they need to query the Electron app's window registry via WebSocket
    ]);

    // Tools that require client-side execution (browser context)
    this.clientSideTools = new Set([
      // Navigation tools
      'navigate_to_position',
      'jump_to_gene',
      'find_gene_by_name',
      'find_gene',
      'search_features',
      'zoom_in',
      'zoom_out',
      'pan_left',
      'pan_right',

      // State management
      'get_current_state',
      'get_genome_info',
      'get_visible_region',
      'genome_codon_usage_analysis',

      // Track management
      'toggle_track',
      'show_track',
      'hide_track',

      // UI operations
      'open_new_tab',
      'switch_tab',
      'close_tab',
      'capture_screenshot',

      // Sequence operations (require genome data access)
      'get_coding_sequence',
      'get_sequence_region',
      'search_alphafold_structures',

      // Data manipulation
      'copy_sequence',
      'cut_sequence',
      'paste_sequence',
      'delete_sequence',
      'insert_sequence',
      'replace_sequence',

      // Action management
      'get_action_list',
      'execute_actions',
      'clear_actions',
      'get_clipboard_content',

      // Pathway tools (require visualization)
      'show_metabolic_pathway',
      'find_pathway_genes',

      // BLAST (requires local tool installation)
      'blast_search',

      // Multi-window management tools (require Electron app connection)
      'list_genome_windows',
      'switch_active_window',
    ]);

    // Tool execution modes
    this.executionModes = {
      SERVER_ONLY: 'server', // Can only run on server
      CLIENT_ONLY: 'client', // Must run on client
      HYBRID: 'hybrid', // Can run on either
    };
  }

  /**
   * Check if a tool can be executed server-side
   */
  isServerSideTool(toolName) {
    return this.serverSideTools.has(toolName);
  }

  /**
   * Check if a tool requires client-side execution
   */
  isClientSideTool(toolName) {
    return this.clientSideTools.has(toolName);
  }

  /**
   * Get execution mode for a tool
   */
  getExecutionMode(toolName) {
    if (this.serverSideTools.has(toolName) && !this.clientSideTools.has(toolName)) {
      return this.executionModes.SERVER_ONLY;
    }

    if (this.clientSideTools.has(toolName) && !this.serverSideTools.has(toolName)) {
      return this.executionModes.CLIENT_ONLY;
    }

    if (this.serverSideTools.has(toolName) && this.clientSideTools.has(toolName)) {
      return this.executionModes.HYBRID;
    }

    // Unknown tools default to client-side for safety
    return this.executionModes.CLIENT_ONLY;
  }

  /**
   * Check if tool can execute in given context
   */
  canExecuteInContext(toolName, context) {
    const mode = this.getExecutionMode(toolName);

    switch (context) {
      case 'remote':
        return mode === this.executionModes.SERVER_ONLY || mode === this.executionModes.HYBRID;

      case 'local':
        return mode === this.executionModes.CLIENT_ONLY || mode === this.executionModes.HYBRID;

      default:
        return false;
    }
  }

  /**
   * Filter tools by execution context
   */
  filterToolsByContext(tools, context) {
    return tools.filter(tool => {
      const toolName = tool.name || tool;
      return this.canExecuteInContext(toolName, context);
    });
  }

  /**
   * Get tools categorized by execution mode
   */
  categorizeTools(tools) {
    const categorized = {
      serverOnly: [],
      clientOnly: [],
      hybrid: [],
    };

    tools.forEach(tool => {
      const toolName = tool.name || tool;
      const mode = this.getExecutionMode(toolName);

      switch (mode) {
        case this.executionModes.SERVER_ONLY:
          categorized.serverOnly.push(tool);
          break;
        case this.executionModes.CLIENT_ONLY:
          categorized.clientOnly.push(tool);
          break;
        case this.executionModes.HYBRID:
          categorized.hybrid.push(tool);
          break;
      }
    });

    return categorized;
  }

  /**
   * Get tool metadata with execution information
   */
  getToolMetadata(toolName) {
    const mode = this.getExecutionMode(toolName);

    return {
      name: toolName,
      executionMode: mode,
      canExecuteRemotely: mode === this.executionModes.SERVER_ONLY || mode === this.executionModes.HYBRID,
      requiresClient: mode === this.executionModes.CLIENT_ONLY || mode === this.executionModes.HYBRID,
      isServerSide: this.serverSideTools.has(toolName),
      isClientSide: this.clientSideTools.has(toolName),
    };
  }

  /**
   * Validate tool execution request
   */
  validateExecution(toolName, hasClientConnection) {
    const mode = this.getExecutionMode(toolName);

    // Server-only tools can always execute
    if (mode === this.executionModes.SERVER_ONLY) {
      return { valid: true };
    }

    // Client-only tools require client connection
    if (mode === this.executionModes.CLIENT_ONLY && !hasClientConnection) {
      return {
        valid: false,
        error: `Tool '${toolName}' requires a connected CodeXomics client. This tool cannot be executed remotely.`,
        requiresClient: true,
      };
    }

    // Hybrid tools can execute either way
    if (mode === this.executionModes.HYBRID) {
      return {
        valid: true,
        preferredExecution: hasClientConnection ? 'client' : 'server',
      };
    }

    return { valid: true };
  }

  /**
   * Get statistics about tool categories
   */
  getStatistics() {
    return {
      serverSideTools: this.serverSideTools.size,
      clientSideTools: this.clientSideTools.size,
      totalUnique: new Set([...this.serverSideTools, ...this.clientSideTools]).size,
    };
  }
}

module.exports = ToolCategoryManager;
