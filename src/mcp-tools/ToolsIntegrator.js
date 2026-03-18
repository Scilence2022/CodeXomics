/**
 * Tools Integrator Module
 * Combines all tool modules into a unified interface
 */

const NavigationTools = require('./navigation/NavigationTools');
const SequenceTools = require('./sequence/SequenceTools');
const ProteinTools = require('./protein/ProteinTools');
const DatabaseTools = require('./database/DatabaseTools');
const DataTools = require('./data/DataTools');
const PathwayTools = require('./pathway/PathwayTools');
const ActionTools = require('./action/ActionTools');
const UtilityTools = require('./utility/UtilityTools');
const FileTools = require('./file/FileTools');
const TrackSettingsTools = require('./track/TrackSettingsTools');
const PrimerTools = require('./primer/PrimerTools');
const AnnotationTools = require('./annotation/AnnotationTools');

class ToolsIntegrator {
  constructor(server) {
    this.server = server;

    // Initialize all tool modules
    this.navigationTools = new NavigationTools(server);
    this.sequenceTools = new SequenceTools(server);
    this.proteinTools = new ProteinTools(server);
    this.databaseTools = new DatabaseTools(server);
    this.dataTools = new DataTools(server);
    this.pathwayTools = new PathwayTools(server);
    this.actionTools = new ActionTools(server);
    this.utilityTools = new UtilityTools(server);
    this.fileTools = new FileTools(server);
    this.trackSettingsTools = new TrackSettingsTools(server);
    this.primerTools = new PrimerTools(server);
    this.annotationTools = new AnnotationTools(server);

    // Combine all tools
    this.allTools = this.combineAllTools();
  }

  combineAllTools() {
    return {
      ...this.navigationTools.getTools(),
      ...this.sequenceTools.getTools(),
      ...this.proteinTools.getTools(),
      ...this.databaseTools.getTools(),
      ...this.dataTools.getTools(),
      ...this.pathwayTools.getTools(),
      ...this.actionTools.getTools(),
      ...this.utilityTools.getTools(),
      ...this.fileTools.getTools(),
      ...this.trackSettingsTools.getTools(),
      ...this.primerTools.getTools(),
      ...this.annotationTools.getTools(),
      // Multi-window management tools (server-side only)
      ...this.getWindowManagementTools(),
    };
  }

  /**
   * Get window management tools for multi-window genome support.
   * These tools are executed server-side (main process), not delegated to renderer.
   */
  getWindowManagementTools() {
    return {
      list_genome_windows: {
        name: 'list_genome_windows',
        description:
          'List all open CodeXomics genome browser windows and their loaded genomes. Use this to see which genomes are open and which window is focused.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      switch_active_window: {
        name: 'switch_active_window',
        description:
          'Focus/activate a specific CodeXomics window by its windowId. Subsequent tool calls without an explicit windowId will target this window.',
        inputSchema: {
          type: 'object',
          properties: {
            windowId: {
              type: 'string',
              description:
                'The window ID to focus (e.g., "win_1", "win_2"). Use list_genome_windows to see available IDs.',
            },
          },
          required: ['windowId'],
        },
      },
    };
  }

  getAvailableTools() {
    const tools = Object.values(this.allTools);

    // Convert 'parameters' to 'inputSchema' for MCP SDK compatibility
    return tools.map(tool => {
      if (tool.parameters && !tool.inputSchema) {
        return {
          ...tool,
          inputSchema: tool.parameters,
        };
      }
      return tool;
    });
  }

  getToolByName(toolName) {
    return this.allTools[toolName];
  }

  async executeTool(toolName, parameters, clientId) {
    console.log(`[ToolsIntegrator] executeTool called for: ${toolName}`);
    const tool = this.allTools[toolName];
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    // Route to appropriate tool module based on tool name
    try {
      // Navigation tools
      if (this.navigationTools.getTools()[toolName]) {
        return await this.navigationTools.executeClientTool(toolName, parameters, clientId);
      }

      // Sequence tools
      if (this.sequenceTools.getTools()[toolName]) {
        // Pure server-side computations
        if (toolName === 'compute_gc') {
          return { gcContent: this.sequenceTools.calculateGCContent(parameters.sequence) };
        } else if (toolName === 'translate_dna') {
          return { protein: this.sequenceTools.translateDNA(parameters.dna, parameters.frame) };
        } else if (toolName === 'reverse_complement') {
          return { reverseComplement: this.sequenceTools.reverseComplement(parameters.dna) };
        } else {
          // All other sequence tools (get_sequence, search_sequence_motif, get_coding_sequence)
          // require client-side access to genome data
          return await this.sequenceTools.executeClientTool(toolName, parameters, clientId);
        }
      }

      // Protein tools - delegate all to client (ChatManager has working implementations)
      if (this.proteinTools.getTools()[toolName]) {
        // All protein structure tools require client-side execution
        // as ChatManager handles PDB/AlphaFold API calls
        return await this.proteinTools.executeClientTool(toolName, parameters, clientId);
      }

      // Database tools - delegate all to client (ChatManager has working implementations)
      if (this.databaseTools.getTools()[toolName]) {
        // All database tools (UniProt, InterPro) require client-side execution
        // as ChatManager.searchUniProtDatabase etc. have full implementations
        return await this.databaseTools.executeClientTool(toolName, parameters, clientId);
      }

      // Data tools
      if (this.dataTools.getTools()[toolName]) {
        if (toolName === 'codon_usage_analysis') {
          return await this.dataTools.analyzeCodonUsage(parameters);
        } else {
          return await this.dataTools.executeClientTool(toolName, parameters, clientId);
        }
      }

      // File tools - delegate all to client (ChatManager has file loading implementations)
      if (this.fileTools.getTools()[toolName]) {
        return await this.fileTools.executeClientTool(toolName, parameters, clientId);
      }

      // Pathway tools
      if (this.pathwayTools.getTools()[toolName]) {
        switch (toolName) {
          case 'show_metabolic_pathway':
            return this.pathwayTools.generatePathwayVisualization(
              parameters.pathwayName,
              parameters.highlightGenes || []
            );
          case 'find_pathway_genes':
            return this.pathwayTools.findGenesInPathway(parameters.pathwayName, parameters.includeRegulation || false);
          case 'blast_search':
            return await this.pathwayTools.performBLASTSearch(
              parameters.sequence,
              parameters.blastType,
              parameters.database,
              parameters.evalue,
              parameters.maxTargets
            );
          default:
            return await this.pathwayTools.executeClientTool(toolName, parameters, clientId);
        }
      }

      // Action tools
      if (this.actionTools.getTools()[toolName]) {
        switch (toolName) {
          case 'copy_sequence':
            return await this.actionTools.copy_sequence(parameters, clientId);
          case 'cut_sequence':
            return await this.actionTools.cut_sequence(parameters, clientId);
          case 'paste_sequence':
            return await this.actionTools.paste_sequence(parameters, clientId);
          case 'delete_sequence':
            return await this.actionTools.delete_sequence(parameters, clientId);
          case 'insert_sequence':
            return await this.actionTools.insert_sequence(parameters, clientId);
          case 'replace_sequence':
            return await this.actionTools.replace_sequence(parameters, clientId);
          case 'get_action_list':
            return await this.actionTools.get_action_list(parameters, clientId);
          case 'execute_actions':
            return await this.actionTools.execute_actions(parameters, clientId);
          case 'clear_actions':
            return await this.actionTools.clear_actions(parameters, clientId);
          case 'get_clipboard_content':
            return await this.actionTools.get_clipboard_content(parameters, clientId);
          default:
            return await this.actionTools.executeClientTool(toolName, parameters, clientId);
        }
      }

      // Utility tools
      if (this.utilityTools.getTools()[toolName]) {
        switch (toolName) {
          case 'download_internet_file':
            return await this.utilityTools.download_internet_file(parameters, clientId);
          case 'view_markdown_file':
            return await this.utilityTools.view_markdown_file(parameters, clientId);
          default:
            return await this.utilityTools.executeClientTool(toolName, parameters, clientId);
        }
      }

      // Track settings tools
      if (this.trackSettingsTools.getTools()[toolName]) {
        switch (toolName) {
          case 'get_track_settings':
            return await this.trackSettingsTools.executeClientTool('getTrackSettings', parameters, clientId);
          case 'set_track_settings':
            return await this.trackSettingsTools.executeClientTool('setTrackSettings', parameters, clientId);
          case 'get_all_track_settings':
            return await this.trackSettingsTools.executeClientTool('getAllTrackSettings', parameters, clientId);
          case 'reset_track_settings':
            return await this.trackSettingsTools.executeClientTool('resetTrackSettings', parameters, clientId);
          case 'get_track_settings_schema':
            return {
              schema: this.trackSettingsTools.getDefaultSettingsSchema(),
              description: 'Complete schema of available track settings',
            };
          case 'batch_set_track_settings':
            return await this.trackSettingsTools.executeClientTool('batchSetTrackSettings', parameters, clientId);
          default:
            return await this.trackSettingsTools.executeClientTool(toolName, parameters, clientId);
        }
      }

      // Primer tools
      if (this.primerTools.getTools()[toolName]) {
        switch (toolName) {
          case 'calculate_primer_properties':
            return this.primerTools.calculateProperties(parameters.sequence);
          case 'design_primers':
            return this.primerTools.designPrimers(parameters.targetSequence, {
              targetTm: parameters.targetTm,
              minProductSize: parameters.minProductSize,
            });
          case 'find_primer_binding_sites':
            return this.primerTools.findBindingSites(
              parameters.primerSequence,
              parameters.templateSequence,
              parameters.maxMismatches
            );
          default:
            // add_primer_annotation and any future UI tools go to client
            return await this.primerTools.executeClientTool(toolName, parameters, clientId);
        }
      }

      // Annotation tools - delegate all to client
      if (this.annotationTools.getTools()[toolName]) {
        return await this.annotationTools.executeClientTool(toolName, parameters, clientId);
      }

      // Multi-window management tools (server-side, no client delegation needed)
      if (toolName === 'list_genome_windows') {
        return await this.executeListGenomeWindows();
      }
      if (toolName === 'switch_active_window') {
        return this.executeSwitchActiveWindow(parameters);
      }

      throw new Error(`Tool execution handler not found for '${toolName}'`);
    } catch (error) {
      console.error(`Error executing tool '${toolName}':`, error);
      throw error;
    }
  }

  // Tool categorization for better organization
  getToolsByCategory() {
    return {
      navigation: {
        name: 'Navigation & State Management',
        description: 'Tools for genome navigation and browser state management',
        tools: Object.keys(this.navigationTools.getTools()),
      },
      sequence: {
        name: 'Sequence Analysis',
        description: 'Tools for DNA/RNA sequence analysis and manipulation',
        tools: Object.keys(this.sequenceTools.getTools()),
      },
      protein: {
        name: 'Protein Structure',
        description: 'Tools for protein structure analysis and visualization',
        tools: Object.keys(this.proteinTools.getTools()),
      },
      database: {
        name: 'Database Integration',
        description: 'Tools for accessing biological databases',
        tools: Object.keys(this.databaseTools.getTools()),
      },
      // Note: Evo2Tools category removed - NVIDIA EVO2 integration not yet implemented
      // To add back, import Evo2Tools module and initialize in constructor
      data: {
        name: 'Data Management',
        description: 'Tools for data annotation, export, and analysis',
        tools: Object.keys(this.dataTools.getTools()),
      },
      pathway: {
        name: 'Pathway & Search',
        description: 'Tools for metabolic pathway analysis and sequence search',
        tools: Object.keys(this.pathwayTools.getTools()),
      },
      utility: {
        name: 'Utility Tools',
        description: 'Utility tools for file download and viewing operations',
        tools: Object.keys(this.utilityTools.getTools()),
      },
      annotation: {
        name: 'Annotation Management',
        description: 'Tools for reading, updating, searching, and tracking changes to genome annotations',
        tools: Object.keys(this.annotationTools.getTools()),
      },
    };
  }

  // Statistics about available tools
  getToolStatistics() {
    const categories = this.getToolsByCategory();
    const totalTools = Object.keys(this.allTools).length;

    return {
      totalTools: totalTools,
      categories: Object.keys(categories).length,
      toolsByCategory: Object.fromEntries(
        Object.entries(categories).map(([key, category]) => [
          key,
          { name: category.name, count: category.tools.length },
        ])
      ),
      serverSideTools: [
        'fetch_protein_structure',
        'search_pdb_structures', // Protein tools
        'fetch_alphafold_structure',
        'search_alphafold_by_sequence',
        'search_uniprot_database',
        'advanced_uniprot_search',
        'get_uniprot_entry',
        'analyze_interpro_domains',
        'search_interpro_entry',
        'get_interpro_entry_details',
        'evo2_generate_sequence',
        'evo2_predict_function',
        'evo2_design_crispr',
        'evo2_optimize_sequence',
        'evo2_analyze_essentiality',
      ].length,
      clientSideTools:
        totalTools -
        [
          'fetch_protein_structure',
          'search_pdb_structures',
          'fetch_alphafold_structure',
          'search_alphafold_by_sequence',
          'search_uniprot_database',
          'advanced_uniprot_search',
          'get_uniprot_entry',
          'analyze_interpro_domains',
          'search_interpro_entry',
          'get_interpro_entry_details',
          'evo2_generate_sequence',
          'evo2_predict_function',
          'evo2_design_crispr',
          'evo2_optimize_sequence',
          'evo2_analyze_essentiality',
        ].length,
    };
  }

  // Validate tool parameters
  validateToolParameters(toolName, parameters) {
    const tool = this.allTools[toolName];
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    const required = tool.parameters.required || [];
    const properties = tool.parameters.properties || {};

    // Check required parameters
    for (const param of required) {
      if (!(param in parameters)) {
        throw new Error(`Required parameter '${param}' missing for tool '${toolName}'`);
      }
    }

    // Basic type validation
    for (const [param, value] of Object.entries(parameters)) {
      if (properties[param]) {
        const expectedType = properties[param].type;
        const actualType = typeof value;

        if (expectedType === 'number' && actualType !== 'number') {
          throw new Error(`Parameter '${param}' should be a number, got ${actualType}`);
        }
        if (expectedType === 'string' && actualType !== 'string') {
          throw new Error(`Parameter '${param}' should be a string, got ${actualType}`);
        }
        if (expectedType === 'boolean' && actualType !== 'boolean') {
          throw new Error(`Parameter '${param}' should be a boolean, got ${actualType}`);
        }
        if (expectedType === 'array' && !Array.isArray(value)) {
          throw new Error(`Parameter '${param}' should be an array, got ${actualType}`);
        }
      }
    }

    return true;
  }

  // Get tool documentation
  getToolDocumentation(toolName) {
    const tool = this.allTools[toolName];
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    const categories = this.getToolsByCategory();
    let category = 'unknown';

    for (const [catKey, catData] of Object.entries(categories)) {
      if (catData.tools.includes(toolName)) {
        category = catData.name;
        break;
      }
    }

    return {
      name: tool.name,
      description: tool.description,
      category: category,
      parameters: tool.parameters,
      examples: this.getToolExamples(toolName),
    };
  }

  // Get example usage for tools
  getToolExamples(toolName) {
    const examples = {
      navigate_to_position: {
        description: 'Navigate to a specific genomic region',
        example: {
          chromosome: 'chr1',
          start: 1000,
          end: 2000,
        },
      },
      compute_gc: {
        description: 'Calculate GC content of a DNA sequence',
        example: {
          sequence: 'ATCGATCGATCG',
        },
      },
      translate_dna: {
        description: 'Translate DNA to protein sequence',
        example: {
          dna: 'ATGAAATAA',
          frame: 0,
        },
      },
      search_uniprot_database: {
        description: 'Search UniProt database for proteins',
        example: {
          query: 'insulin',
          searchType: 'protein_name',
          limit: 10,
        },
      },
      evo2_generate_sequence: {
        description: 'Generate DNA sequence using EVO2 AI',
        example: {
          prompt: 'ATCG',
          maxTokens: 100,
          temperature: 1.0,
        },
      },
      zoom_in: {
        description: 'Zoom in the current view',
        example: {
          factor: 2,
        },
      },
      zoom_out: {
        description: 'Zoom out the current view',
        example: {
          factor: 2,
        },
      },
    };

    return examples[toolName] || { description: 'No examples available', example: {} };
  }

  // Execute client-side tools by delegating to the browser
  async executeClientSideTool(toolName, parameters, clientId) {
    // This method delegates tool execution to the browser client
    // It's used for tools that need to run in the browser context (like UI updates)

    if (!this.server) {
      throw new Error('Server instance not available for client-side tool execution');
    }

    // Use the server's client tool execution method
    return await this.server.executeToolOnClient(toolName, parameters, clientId);
  }

  /**
   * List all open genome browser windows and fetch their current loaded status
   */
  async executeListGenomeWindows() {
    console.log(`[ToolsIntegrator] executeListGenomeWindows called`);

    if (!this.server || !this.server.listWindows) {
      console.log(`[ToolsIntegrator] Window registry not available`);
      return {
        success: false,
        error: 'Window registry not available. MCP server may not support multi-window mode.',
      };
    }

    const baseWindows = this.server.listWindows();
    const enrichedWindows = [];

    // Asynchronously ping each connected window to ask what genome is loaded
    for (const win of baseWindows) {
      const enrichedWin = { ...win };

      if (win.hasWsClient) {
        try {
          console.log(`[ToolsIntegrator] Fetching current state for window ${win.windowId}...`);

          // Use a short 2000ms timeout so we don't hang the whole list if one window is extremely slow/frozen
          const statePromise = this.server.executeToolOnClient('get_current_state', { windowId: win.windowId }, null);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));

          const rawState = await Promise.race([statePromise, timeoutPromise]);

          // InternalMCPServer wraps ChatManager results in { success: true, result: { ... } }
          const state = (rawState && rawState.result) ? rawState.result : rawState;

          if (state && state.currentChromosome) {
            enrichedWin.genomeName = state.currentChromosome;
            enrichedWin.isGenomeLoaded = true;
          } else if (state && state.loadedFiles && state.loadedFiles.length > 0) {
            // Fallback if chromosome is null but files are loaded
            enrichedWin.genomeName = state.loadedFiles[0];
            enrichedWin.isGenomeLoaded = true;
          } else {
            enrichedWin.genomeName = 'No genome loaded';
            enrichedWin.isGenomeLoaded = false;
          }

        } catch (error) {
          console.log(`[ToolsIntegrator] Could not fetch state for window ${win.windowId}:`, error.message);
          enrichedWin.genomeName = 'Unknown status (error fetching)';
          enrichedWin.isGenomeLoaded = false;
        }
      } else {
        enrichedWin.genomeName = 'No active connection';
        enrichedWin.isGenomeLoaded = false;
      }
      enrichedWindows.push(enrichedWin);
    }

    console.log(`[ToolsIntegrator] listWindows returned: ${enrichedWindows.length} enriched windows`);
    return {
      success: true,
      windowCount: enrichedWindows.length,
      windows: enrichedWindows,
    };
  }

  /**
   * Switch focus to a specific genome window (server-side, no client delegation)
   */
  executeSwitchActiveWindow(parameters) {
    const { windowId } = parameters;
    if (!windowId) {
      return { success: false, error: 'windowId parameter is required' };
    }

    const registry = this.server?.mainWindowRegistry || this.server?.windowRegistry;
    if (!registry) {
      return { success: false, error: 'Window registry not available' };
    }

    const entry = registry.get(windowId);
    if (!entry) {
      // Check if it's connected as internalClient standalone
      if (this.server?.internalClients?.has(windowId)) {
        // Set as default fallback client
        this.server.internalClient = this.server.internalClients.get(windowId);
        return {
          success: true,
          message: `Activated window '${windowId}' (Standalone mode)`,
          windowId,
          genomeName: 'Connected via CodeXomics',
        };
      }

      const available = Array.from(registry.keys());
      if (this.server?.internalClients) {
        for (const key of this.server.internalClients.keys()) {
          if (!available.includes(key)) available.push(key);
        }
      }
      return {
        success: false,
        error: `Window '${windowId}' not found. Available: [${available.join(', ')}]`,
      };
    }

    const win = entry.window || entry;
    if (!win || win.isDestroyed()) {
      return { success: false, error: `Window '${windowId}' is destroyed` };
    }

    win.focus();
    return {
      success: true,
      message: `Focused window '${windowId}'`,
      windowId,
      genomeName: entry.genomeName || null,
    };
  }
}

module.exports = ToolsIntegrator;
