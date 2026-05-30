// @ts-check
/**
 * ToolExecutionService - Tool routing logic extracted from ChatManager
 */
class ToolExecutionService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
    this.activeAgentExecutions = new Set();
  }

  async execute(toolName, parameters, options = {}) {
    try {
      // --- LEGACY ALIAS RESOLUTION ---
      const legacyAliases = {
        find_gene: 'find_gene_by_name',
        search_gene_by_name: 'find_gene_by_name',
      };
      if (legacyAliases[toolName]) {
        console.log(`[ToolExecutionService] Legacy alias: '${toolName}' → '${legacyAliases[toolName]}'`);
        toolName = legacyAliases[toolName];
      }

      console.log(`[ToolExecutionService] Executing: ${toolName}`, parameters);

      // --- PRIORITY 1: MULTI-AGENT SETTINGS (if handled exclusively) ---
      if (
        ['update_agent_setting', 'get_agent_settings', 'toggle_agent_mode'].includes(toolName) &&
        this.chatManager.agentSettingsManager
      ) {
        const handlerName = toolName.replace(/([-_][a-z])/gi, $1 => $1.toUpperCase().replace('-', '').replace('_', ''));
        if (typeof this.chatManager.agentSettingsManager[handlerName] === 'function') {
          return await this.chatManager.agentSettingsManager[handlerName](parameters);
        }
      }

      // --- PRIORITY 2: NEW EXTRACTED SERVICES ---
      // 1. File Operation Services
      const fileService =
        this.chatManager.services?.file || new window.FileOperationService(this.app, this.chatManager);
      if (typeof fileService[this._toCamelCase(toolName)] === 'function') {
        return await fileService[this._toCamelCase(toolName)](parameters);
      }

      // 2. Annotation Services
      const annotationService =
        this.chatManager.services?.annotation || new window.AnnotationService(this.app, this.chatManager);
      if (typeof annotationService[this._toCamelCase(toolName)] === 'function') {
        return await annotationService[this._toCamelCase(toolName)](parameters);
      }

      // 3. BLAST Services
      const blastService = this.chatManager.services?.blast || new window.BlastService(this.app, this.chatManager);
      if (typeof blastService[this._toCamelCase(toolName)] === 'function') {
        return await blastService[this._toCamelCase(toolName)](parameters);
      }

      // 4. Protein Services
      const proteinService =
        this.chatManager.services?.protein || new window.ProteinService(this.app, this.chatManager);
      if (typeof proteinService[this._toCamelCase(toolName)] === 'function') {
        return await proteinService[this._toCamelCase(toolName)](parameters);
      }

      // 5. Genome Analysis Services
      const analysisService =
        this.chatManager.services?.analysis || new window.GenomeAnalysisService(this.app, this.chatManager);
      if (typeof analysisService[this._toCamelCase(toolName)] === 'function') {
        return await analysisService[this._toCamelCase(toolName)](parameters);
      }

      // 6. Primer Services (bypasses multi-agent re-entry, 7-layer direct path)
      if (this._isPrimerTool(toolName)) {
        await this._ensurePrimerServiceLoaded();
      }
      if (typeof window.PrimerService === 'function') {
        if (this.chatManager.services && !this.chatManager.services.primer) {
          this.chatManager.services.primer = new window.PrimerService(this.app, this.chatManager);
        }
        const primerService = this.chatManager.services?.primer || new window.PrimerService(this.app, this.chatManager);
        if (typeof primerService[this._toCamelCase(toolName)] === 'function') {
          return await primerService[this._toCamelCase(toolName)](parameters);
        }
      }

      // 7. Task Services
      const taskService = this.chatManager.services?.task;
      if (taskService && typeof taskService[this._toCamelCase(toolName)] === 'function') {
        return await taskService[this._toCamelCase(toolName)](parameters);
      }

      // --- PRIORITY 3: MULTI-AGENT ROUTING (when enabled) ---
      if (
        this.chatManager.agentSystemEnabled &&
        this.chatManager.multiAgentSystem &&
        !options.bypassAgent &&
        !this.activeAgentExecutions.has(toolName)
      ) {
        try {
          this.activeAgentExecutions.add(toolName);
          const agentResult = await this.chatManager.multiAgentSystem.executeTool(toolName, parameters);
          // Only accept the result if it's clearly successful with a defined result
          if (agentResult && agentResult.success === true && agentResult.result !== undefined) {
            return agentResult.result;
          }
          // If the agent couldn't handle it (success=false or no result), fall through
        } catch (agentError) {
          console.log(
            `[ToolExecutionService] Multi-agent routing failed for ${toolName}: ${agentError.message}, falling through`
          );
          // Fall through to other priorities
        } finally {
          this.activeAgentExecutions.delete(toolName);
        }
      }

      // Special handling for known MCP tools that match their server IDs
      const knownMcpToolServerMapping = {
        'deep-gene-research': 'deep-gene-research',
      };

      if (knownMcpToolServerMapping[toolName] && this.chatManager.mcpServerManager) {
        const serverId = knownMcpToolServerMapping[toolName];
        if (
          this.chatManager.mcpServerManager.activeServers &&
          this.chatManager.mcpServerManager.activeServers.has(serverId)
        ) {
          try {
            return await this.chatManager.mcpServerManager.executeToolOnServer(serverId, toolName, parameters);
          } catch (directError) {
            console.warn(`[ToolExecutionService] Direct MCP Routing Failed for ${toolName}:`, directError.message);
          }
        }
      }
      if (this.chatManager.mcpServerManager) {
        const mcpTool = this.chatManager.mcpServerManager.getAllAvailableTools().find(t => t.name === toolName);
        if (mcpTool) {
          return await this.chatManager.mcpServerManager.executeToolOnServer(mcpTool.serverId, toolName, parameters);
        }
      }

      // --- PRIORITY 4: DYNAMIC REGISTRY TOOLS (Plugin Integrator) ---
      if (window.toolsRegistry && window.toolsRegistry[toolName]) {
        console.log(`[ToolExecutionService] Executing dynamic tool: ${toolName}`);

        if (this.app.toolsIntegrator) {
          return await this.app.toolsIntegrator.executeTool(toolName, parameters);
        } else if (typeof window.executeDynamicTool === 'function') {
          return await window.executeDynamicTool(toolName, parameters);
        }
      }

      // --- PRIORITY 4.5: PLUGIN FUNCTION CALLS (e.g., protein-interaction-network.visualize) ---
      // Plugin tools use dot-notation: "plugin-id.function-name"
      if (toolName.includes('.')) {
        // Try PluginFunctionCallsIntegrator first
        if (this.chatManager && this.chatManager.pluginFunctionCallsIntegrator) {
          if (this.chatManager.pluginFunctionCallsIntegrator.isPluginFunction(toolName)) {
            console.log(`[ToolExecutionService] Routing to PluginFunctionCallsIntegrator: ${toolName}`);
            return await this.chatManager.pluginFunctionCallsIntegrator.executePluginFunction(toolName, parameters);
          } else {
            // Tool has plugin format but isn't in the integrator map - try PluginManager directly
            console.log(
              `[ToolExecutionService] Plugin tool '${toolName}' not in integrator map, trying PluginManager.executeFunctionByName`
            );
            if (
              this.chatManager.pluginManager &&
              typeof this.chatManager.pluginManager.executeFunctionByName === 'function'
            ) {
              try {
                const result = await this.chatManager.pluginManager.executeFunctionByName(toolName, parameters);
                if (result !== undefined) {
                  return result;
                }
              } catch (e) {
                console.warn(
                  `[ToolExecutionService] PluginManager.executeFunctionByName failed for '${toolName}':`,
                  e.message
                );
                return {
                  success: false,
                  error: `Plugin tool execution failed: ${e.message}`,
                  toolName: toolName,
                };
              }
            }
          }
        } else {
          // No integrator but tool name looks like a plugin - try PluginManager directly
          console.log(
            `[ToolExecutionService] No PluginFunctionCallsIntegrator, trying PluginManager for '${toolName}'`
          );
          if (
            this.chatManager &&
            this.chatManager.pluginManager &&
            typeof this.chatManager.pluginManager.executeFunctionByName === 'function'
          ) {
            try {
              const result = await this.chatManager.pluginManager.executeFunctionByName(toolName, parameters);
              if (result !== undefined) {
                return result;
              }
            } catch (e) {
              console.warn(
                `[ToolExecutionService] PluginManager.executeFunctionByName failed for '${toolName}':`,
                e.message
              );
              return {
                success: false,
                error: `Plugin tool execution failed: ${e.message}`,
                toolName: toolName,
              };
            }
          }
        }

        // If we reach here, the plugin tool was advertised but has no executable implementation
        console.warn(
          `[ToolExecutionService] Plugin tool '${toolName}' was not found. The plugin may not be installed or the function is not registered.`
        );
        return {
          success: false,
          error: `Plugin tool '${toolName}' is not available. The required plugin may not be installed or the function is not registered. Please check your installed plugins.`,
          toolName: toolName,
        };
      }

      // --- PRIORITY 5: ACTION MANAGER TOOLS ---
      const actionManagerTools = {
        copy_sequence: true,
        action_copy_sequence: true,
        cut_sequence: true,
        action_cut_sequence: true,
        paste_sequence: true,
        action_paste_sequence: true,
        delete_sequence: true,
        action_delete_sequence: true,
        insert_sequence: true,
        action_insert_sequence: true,
        replace_sequence: true,
        action_replace_sequence: true,
        execute_actions: true,
        action_execute_actions: true,
        get_action_list: true,
        action_get_action_list: true,
        show_action_list: true,
        action_show_action_list: true,
        clear_actions: true,
        action_clear_actions: true,
        get_clipboard_content: true,
        action_get_clipboard_content: true,
      };

      if (actionManagerTools[toolName]) {
        if (typeof this.chatManager.executeActionTool === 'function') {
          // Strip 'action_' prefix if present to get canonical tool name
          const canonicalName = toolName.startsWith('action_') ? toolName.substring(7) : toolName;
          return await this.chatManager.executeActionTool(canonicalName, parameters);
        }
      }

      // --- PRIORITY 6: MICROBE GENOMICS FUNCTIONS ---
      // Navigation tools are handled by NavigationManager (P7/P8), skip here
      const navigationTools = new Set(['navigate_to_position', 'navigate_to', 'zoom_in', 'zoom_out']);
      if (window.MicrobeGenomicsFunctions && !navigationTools.has(toolName)) {
        const mgfMethodName = this._toCamelCase(toolName);
        if (typeof window.MicrobeGenomicsFunctions[mgfMethodName] === 'function') {
          console.log(`[ToolExecutionService] Routing to MicrobeGenomicsFunctions.${mgfMethodName}`);
          return await window.MicrobeGenomicsFunctions[mgfMethodName](...this._extractMGFArgs(toolName, parameters));
        }
      }

      // --- PRIORITY 7: LOCAL NATIVE FALLBACKS ---
      // We will map any remaining ChatManager functions manually
      const camelCaseMethod = this._toCamelCase(toolName);
      if (typeof this.chatManager[camelCaseMethod] === 'function') {
        return await this.chatManager[camelCaseMethod](parameters);
      }

      // Special cases
      switch (toolName) {
        case 'navigate_to_position':
        case 'navigate_to':
          if (this.app.navigationManager) {
            const r = this.app.navigationManager.navigateToPosition(
              parameters.chromosome,
              parameters.start,
              parameters.end
            );
            return { success: r.success, chromosome: r.chromosome, start: r.start, end: r.end };
          }
          break;
        case 'zoom_in':
          if (this.app.navigationManager) {
            const r = this.app.navigationManager.zoomIn(parameters.factor || 2);
            return { success: r.success, factor: r.factor };
          }
          break;
        case 'zoom_out':
          if (this.app.navigationManager) {
            const r = this.app.navigationManager.zoomOut(parameters.factor || 2);
            return { success: r.success, factor: r.factor };
          }
          break;
      }

      // --- PRIORITY 8: CHATMANAGER LEGACY ROUTING FALLBACK ---
      if (typeof this.chatManager.executeLocalTool === 'function') {
        const localResult = await this.chatManager.executeLocalTool(toolName, parameters);
        if (localResult !== undefined) {
          console.log(`[ToolExecutionService] Resolved '${toolName}' via ChatManager.executeLocalTool fallback`);
          return localResult;
        }
      }

      throw new Error(`Unknown tool: ${toolName}`);
    } catch (error) {
      console.error(`[ToolExecutionService] Error executing tool: ${toolName}`, error);
      throw error;
    }
  }

  // Utility to convert snake_case (MCP format) to camelCase (JS method format)
  _toCamelCase(str) {
    return str.replace(/([-_][a-z])/gi, $1 => {
      return $1.toUpperCase().replace('-', '').replace('_', '');
    });
  }

  _isPrimerTool(toolName) {
    return [
      'calculate_primer_properties',
      'design_primers',
      'find_primer_binding_sites',
      'add_primer_annotation',
      'list_primer_annotations',
      'clear_primer_annotations',
    ].includes(toolName);
  }

  async _ensurePrimerServiceLoaded() {
    await this._ensureScriptGlobal('PrimerDesigner', 'modules/PrimerDesigner.js');
    await this._ensureScriptGlobal('PrimerService', 'modules/chat/services/PrimerService.js');
  }

  async _ensureScriptGlobal(globalName, scriptPath) {
    if (typeof window[globalName] !== 'undefined') return;

    if (typeof document === 'undefined') {
      if (!this.chatManager || typeof this.chatManager.loadScript !== 'function') {
        throw new Error(`${globalName} is not loaded and no script loader is available.`);
      }
      await this.chatManager.loadScript(scriptPath);
      if (typeof window[globalName] !== 'undefined') return;
      throw new Error(`${globalName} failed to initialize after loading ${scriptPath}.`);
    }

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptPath;
      script.onload = () => {
        setTimeout(() => {
          if (typeof window[globalName] !== 'undefined') {
            resolve();
          } else {
            reject(new Error(`${globalName} failed to initialize after loading ${scriptPath}.`));
          }
        }, 0);
      };
      script.onerror = () => reject(new Error(`Failed to load ${scriptPath}.`));
      document.head.appendChild(script);
    });
  }

  // Extract positional arguments for MicrobeGenomicsFunctions static methods
  // These methods expect individual args, not a params object
  _extractMGFArgs(toolName, parameters) {
    const argMappings = {
      search_sequence_motif: [], // Pass full params object - searchSequenceMotif handles object deconstruction internally
      find_gene: ['name'], // legacy alias
      find_gene_by_name: ['name'],
      search_gene_by_locus_tag: ['locusTag', 'locus_tag', 'identifier'],
      search_by_position: ['chromosome', 'position'],
      search_intergenic_regions: ['chromosome', 'minLength', 'min_length'],
      compute_gc: ['dna', 'sequence', 'dna_sequence'],
      reverse_complement: ['dna', 'sequence', 'dna_sequence'],
      translate_dna: ['dna', 'sequence', 'dna_sequence'],
      find_orfs: ['dna', 'sequence', 'dna_sequence'],
      calculate_entropy: ['sequence', 'dna', 'dna_sequence'],
      calc_region_gc: ['chromosome', 'start', 'end'],
      calculate_melting_temp: ['dna', 'sequence', 'dna_sequence'],
      calculate_molecular_weight: ['dna', 'sequence', 'dna_sequence', 'type'],
      analyze_codon_usage: ['dna', 'sequence', 'dna_sequence'],
      predict_promoter: ['seq', 'sequence'],
      predict_rbs: ['seq', 'sequence'],
      predict_terminator: ['seq', 'sequence'],
      get_coding_sequence: ['identifier', 'gene_name', 'geneName'],
      jump_to_gene: ['geneName', 'identifier', 'name'],
      get_upstream_region: ['geneObj', 'length'],
      get_downstream_region: ['geneObj', 'length'],
      zoom_in: ['factor'],
      zoom_out: ['factor'],
      scroll_left: ['bp', 'amount'],
      scroll_right: ['bp', 'amount'],
      get_current_region: [],
    };

    const argNames = argMappings[toolName];
    if (!argNames || !parameters) {
      // Fallback: pass the entire parameters object as-is
      return [parameters];
    }

    // For tools that take a single primary argument, find it from parameters
    const args = [];
    for (const name of argNames) {
      if (parameters[name] !== undefined) {
        args.push(parameters[name]);
      }
    }

    // If we found at least one arg, return them; otherwise pass params object
    return args.length > 0 ? args : [parameters];
  }
}

// Make it available globally if needed by plugin system
window.ToolExecutionService = ToolExecutionService;
