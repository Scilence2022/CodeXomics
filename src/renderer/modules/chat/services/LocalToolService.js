// @ts-check
/**
 * LocalToolService - Local tool execution and navigation extracted from ChatManager
 */
class LocalToolService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  // ====================================
  // NAVIGATION TOOLS
  // ====================================

  async navigateToPosition(params) {
    let { chromosome, start, end, position } = params;

    console.log('navigateToPosition called with params:', params);

    if (!this.app) {
      throw new Error('Genome browser not initialized');
    }

    // Auto-detect chromosome if not provided
    if (!chromosome) {
      // Try to get current chromosome from the chromosome selector
      const chromosomeSelect = document.getElementById('chromosomeSelect');
      if (chromosomeSelect && chromosomeSelect.value) {
        chromosome = chromosomeSelect.value;
        console.log(`Auto-detected chromosome: ${chromosome}`);
      } else if (this.app.currentSequence) {
        // If no chromosome is selected, use the first available chromosome
        const availableChromosomes = Object.keys(this.app.currentSequence);
        if (availableChromosomes.length > 0) {
          chromosome = availableChromosomes[0];
          console.log(`Using first available chromosome: ${chromosome}`);
        }
      }

      if (!chromosome) {
        throw new Error(
          'No chromosome specified and unable to auto-detect current chromosome. Please load genome data first.'
        );
      }
    }

    // Check if the target chromosome exists in loaded data
    if (!this.app.currentSequence || !this.app.currentSequence[chromosome]) {
      // List available chromosomes for better error message
      const availableChromosomes = this.app.currentSequence ? Object.keys(this.app.currentSequence) : [];
      throw new Error(
        `Chromosome ${chromosome} not found in loaded genome data. Available chromosomes: ${availableChromosomes.join(', ')}`
      );
    }

    // Handle position parameter with default 2000bp range
    if (position !== undefined && (start === undefined || end === undefined)) {
      const defaultRange = 2000;
      start = Math.max(1, position - Math.floor(defaultRange / 2));
      end = position + Math.floor(defaultRange / 2);
      console.log(`Using position ${position} with default ${defaultRange}bp range: ${start}-${end}`);
    }

    // Handle start=end or start-only: center on position with ~2kb window
    if (start !== undefined && (end === undefined || start === end)) {
      const center = start;
      const halfRange = 1000;
      start = Math.max(1, center - halfRange);
      end = center + halfRange;
      console.log(`Centering on position ${center} with halfRange: ${start}-${end}`);
    }

    // Validate required parameters
    if (!chromosome || start === undefined || end === undefined) {
      throw new Error('Missing required parameters: chromosome and either (start, end) or position');
    }

    // First, switch to the target chromosome if it's not currently selected
    const currentChr = document.getElementById('chromosomeSelect')?.value;
    if (currentChr !== chromosome) {
      console.log(`Switching from chromosome ${currentChr} to ${chromosome}`);

      // Use the selectChromosome method to properly switch
      this.app.selectChromosome(chromosome);

      // Wait a bit for the UI to update
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Now navigate to the specific position within that chromosome
    const sequence = this.app.currentSequence[chromosome];

    // Validate and adjust bounds
    const validatedStart = Math.max(0, start - 1); // Convert to 0-based
    const validatedEnd = Math.min(sequence.length, end);

    if (validatedStart >= validatedEnd) {
      throw new Error(`Invalid position range: ${start}-${end}`);
    }

    // Set the position directly
    this.app.currentPosition = { start: validatedStart, end: validatedEnd };
    this.app.currentChromosome = chromosome;

    // Update the genome view
    this.app.updateStatistics(chromosome, sequence);
    this.app.displayGenomeView(chromosome, sequence);

    // Update navigation bar if it exists
    if (this.app.genomeNavigationBar) {
      this.app.genomeNavigationBar.update();
    }

    console.log(`Successfully navigated to ${chromosome}:${start}-${end}`);

    return {
      success: true,
      chromosome: chromosome,
      start: start,
      end: end,
      message: `Navigated to ${chromosome}:${start}-${end}`,
      usedDefaultRange: position !== undefined && (params.start === undefined || params.end === undefined),
    };
  }

  // ====================================
  // TAB MANAGEMENT TOOLS
  // ====================================

  async openNewTab(params) {
    const { chromosome, start, end, position, title, geneName } = params;

    console.log('openNewTab called with params:', params);

    try {
      // Use window.genomeBrowser instead of this.app for access
      const genomeBrowser = window.genomeBrowser;
      if (!genomeBrowser) {
        throw new Error('Genome browser not available via window.genomeBrowser');
      }

      // Wait for TabManager to be initialized with retry mechanism
      if (!genomeBrowser.tabManager) {
        console.log('TabManager not ready, waiting...');
        // Wait for TabManager with retry logic
        let retries = 0;
        const maxRetries = 10;
        while (!genomeBrowser.tabManager && retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200));
          retries++;
          console.log(`Waiting for TabManager... attempt ${retries}/${maxRetries}`);
        }

        if (!genomeBrowser.tabManager) {
          throw new Error('Tab manager not available after waiting - check TabManager initialization');
        }
      }

      let tabId;
      let finalTitle = title;
      let usedDefaultRange = false;

      // Handle different ways to create a new tab
      if (geneName) {
        // Open tab for specific gene
        const geneResults = await this.searchFeatures({ query: geneName, caseSensitive: false });
        if (geneResults.count > 0 && geneResults.results.length > 0) {
          const gene = geneResults.results[0];
          // Use the UI response function instead of direct manager access
          tabId = genomeBrowser.tabManager.createTabForGene(gene, 500);
          finalTitle = finalTitle || `Gene: ${gene.name || gene.id || geneName}`;
        } else {
          throw new Error(`Gene '${geneName}' not found`);
        }
      } else if (chromosome) {
        // Open tab for specific position
        let finalStart = start;
        let finalEnd = end;

        // Handle position parameter with default 2000bp range
        if (position !== undefined && (start === undefined || end === undefined)) {
          const defaultRange = 2000;
          finalStart = Math.max(1, position - Math.floor(defaultRange / 2));
          finalEnd = position + Math.floor(defaultRange / 2);
          usedDefaultRange = true;
          console.log(`Using position ${position} with default ${defaultRange}bp range: ${finalStart}-${finalEnd}`);
        }

        // Handle start=end or start-only: center on position with ~2kb window
        if (start !== undefined && (end === undefined || start === end)) {
          const center = start;
          const halfRange = 1000;
          finalStart = Math.max(1, center - halfRange);
          finalEnd = center + halfRange;
          usedDefaultRange = true;
          console.log(`Centering on position ${center} with halfRange: ${finalStart}-${finalEnd}`);
        }

        if (finalStart && finalEnd) {
          // Check if chromosome exists
          if (!genomeBrowser.currentSequence || !genomeBrowser.currentSequence[chromosome]) {
            throw new Error(`Chromosome ${chromosome} not found in loaded genome data`);
          }

          // Use the UI response function instead of direct manager access
          tabId = genomeBrowser.tabManager.createTabForPosition(chromosome, finalStart, finalEnd, finalTitle);
          finalTitle = finalTitle || `${chromosome}:${finalStart.toLocaleString()}-${finalEnd.toLocaleString()}`;
        } else {
          throw new Error('Missing required parameters: start and end positions, or position parameter');
        }
      } else {
        // Create new tab with current position - use the same method as the + button
        // This is the key change: use the actual UI response function
        const newTabButton = document.getElementById('newTabButton');
        if (newTabButton) {
          // Simulate the + button click to use the actual UI response function
          newTabButton.click();
          // Get the newly created tab ID from the tab manager
          const tabIds = Array.from(genomeBrowser.tabManager.tabs.keys());
          tabId = tabIds[tabIds.length - 1]; // Get the most recently created tab
          finalTitle = finalTitle || 'New Tab';
        } else {
          // Fallback to direct manager access if button not found
          tabId = genomeBrowser.tabManager.createNewTab(finalTitle);
          finalTitle = finalTitle || 'New Tab';
        }
      }

      console.log(`Successfully created new tab: ${tabId} - ${finalTitle}`);

      return {
        success: true,
        tabId: tabId,
        title: finalTitle,
        message: `Opened new tab: ${finalTitle}`,
        usedDefaultRange: usedDefaultRange,
      };
    } catch (error) {
      console.error('Error opening new tab:', error);
      throw error;
    }
  }

  /**
   * Switch to a specific tab by ID, name, or index - Built-in function tool
   * @param {Object} params - Tool parameters
   * @param {string} params.tab_id - Specific tab ID to switch to
   * @param {string} params.tab_name - Tab name/title to search for (partial matching)
   * @param {number} params.tab_index - Zero-based index of tab to switch to
   * @param {string} params.clientId - Optional client identifier
   * @returns {Object} Switch result
   */
  async switchToTab(params) {
    const { tab_id, tab_name, tab_index, clientId } = params;

    console.log('switchToTab called with params:', params);

    try {
      // Use window.genomeBrowser for access
      const genomeBrowser = window.genomeBrowser;
      if (!genomeBrowser) {
        throw new Error('Genome browser not available via window.genomeBrowser');
      }

      // Wait for TabManager to be initialized
      if (!genomeBrowser.tabManager) {
        console.log('TabManager not ready, waiting...');
        let retries = 0;
        const maxRetries = 10;
        while (!genomeBrowser.tabManager && retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200));
          retries++;
          console.log(`Waiting for TabManager... attempt ${retries}/${maxRetries}`);
        }

        if (!genomeBrowser.tabManager) {
          throw new Error('Tab manager not available after waiting - check TabManager initialization');
        }
      }

      let targetTabId = null;
      let targetTabTitle = null;
      const tabEntries = Array.from(genomeBrowser.tabManager.tabs.entries());

      // Strategy 1: Switch by specific tab ID
      if (tab_id) {
        if (genomeBrowser.tabManager.tabs.has(tab_id)) {
          targetTabId = tab_id;
          const tabState = genomeBrowser.tabManager.tabs.get(tab_id);
          targetTabTitle = tabState.title || `Tab ${tab_id}`;
          console.log(`Found tab by ID: ${tab_id}`);
        } else {
          throw new Error(`Tab with ID '${tab_id}' not found`);
        }
      }
      // Strategy 2: Switch by tab name/title (case-insensitive partial matching)
      else if (tab_name) {
        const foundTab = tabEntries.find(([tabId, tabState]) => {
          if (tabState.title) {
            return tabState.title.toLowerCase().includes(tab_name.toLowerCase());
          }
          return false;
        });

        if (foundTab) {
          targetTabId = foundTab[0];
          targetTabTitle = foundTab[1].title;
          console.log(`Found tab by name '${tab_name}': ${targetTabId} - ${targetTabTitle}`);
        } else {
          throw new Error(`No tab found matching name '${tab_name}'`);
        }
      }
      // Strategy 3: Switch by tab index (zero-based)
      else if (tab_index !== undefined) {
        const tabIds = Array.from(genomeBrowser.tabManager.tabs.keys());
        if (tab_index >= 0 && tab_index < tabIds.length) {
          targetTabId = tabIds[tab_index];
          const tabState = genomeBrowser.tabManager.tabs.get(targetTabId);
          targetTabTitle = tabState.title || `Tab ${targetTabId}`;
          console.log(`Found tab by index ${tab_index}: ${targetTabId} - ${targetTabTitle}`);
        } else {
          throw new Error(`Tab index ${tab_index} is out of range (0-${tabIds.length - 1})`);
        }
      } else {
        throw new Error('At least one parameter (tab_id, tab_name, or tab_index) must be provided');
      }

      // Perform the tab switch
      if (targetTabId) {
        // Use the TabManager's switchTab method
        genomeBrowser.tabManager.switchTab(targetTabId);

        console.log(`Successfully switched to tab: ${targetTabId} - ${targetTabTitle}`);

        return {
          success: true,
          tab_id: targetTabId,
          tab_title: targetTabTitle,
          message: `Successfully switched to tab: ${targetTabTitle}`,
          clientId: clientId,
        };
      } else {
        throw new Error('Failed to identify target tab');
      }
    } catch (error) {
      console.error('Error switching tab:', error);
      return {
        success: false,
        error: error.message,
        clientId: clientId,
      };
    }
  }

  /**
   * Close a specific tab by ID, name, or index - Built-in function tool
   * @param {Object} params - Tool parameters
   * @param {string} params.tab_id - Specific tab ID to close
   * @param {string} params.tab_name - Tab name/title to search for (partial matching)
   * @param {number} params.tab_index - Zero-based index of tab to close
   * @param {string} params.clientId - Optional client identifier
   * @returns {Object} Close result
   */
  async closeTab(params) {
    const { tab_id, tab_name, tab_index, clientId } = params;

    console.log('closeTab called with params:', params);

    try {
      const genomeBrowser = this.app;

      // Wait for tabManager to be available
      if (!genomeBrowser.tabManager) {
        throw new Error('TabManager not available');
      }

      const tabManager = genomeBrowser.tabManager;

      // Prevent closing the last tab
      if (tabManager.tabs.size <= 1) {
        throw new Error('Cannot close the last remaining tab');
      }

      let targetTabId = null;
      let targetTabTitle = null;
      const tabEntries = Array.from(tabManager.tabs.entries());

      // Strategy 1: Close by specific tab ID
      if (tab_id) {
        if (tabManager.tabs.has(tab_id)) {
          targetTabId = tab_id;
          const tabState = tabManager.tabStates?.get(tab_id);
          targetTabTitle = tabState?.title || `Tab ${tab_id}`;
        } else {
          throw new Error(`Tab with ID '${tab_id}' not found`);
        }
      }
      // Strategy 2: Close by tab name/title (case-insensitive partial matching)
      else if (tab_name) {
        const foundTab = tabEntries.find(([tabId, tabElement]) => {
          const tabState = tabManager.tabStates?.get(tabId);
          if (tabState?.title) {
            return tabState.title.toLowerCase().includes(tab_name.toLowerCase());
          }
          return false;
        });

        if (foundTab) {
          targetTabId = foundTab[0];
          targetTabTitle = tabManager.tabStates?.get(targetTabId)?.title;
        } else {
          throw new Error(`No tab found matching name '${tab_name}'`);
        }
      }
      // Strategy 3: Close by tab index (zero-based)
      else if (tab_index !== undefined) {
        const tabIds = Array.from(tabManager.tabs.keys());
        if (tab_index >= 0 && tab_index < tabIds.length) {
          targetTabId = tabIds[tab_index];
          const tabState = tabManager.tabStates?.get(targetTabId);
          targetTabTitle = tabState?.title || `Tab ${targetTabId}`;
        } else {
          throw new Error(`Tab index ${tab_index} is out of range (0-${tabIds.length - 1})`);
        }
      } else {
        throw new Error('At least one parameter (tab_id, tab_name, or tab_index) must be provided');
      }

      // Perform the tab close
      if (targetTabId) {
        tabManager.closeTab(targetTabId);

        console.log(`Successfully closed tab: ${targetTabId} - ${targetTabTitle}`);

        return {
          success: true,
          closed_tab_id: targetTabId,
          closed_tab_title: targetTabTitle,
          remaining_tabs: tabManager.tabs.size,
          message: `Closed tab: ${targetTabTitle}`,
          clientId: clientId,
        };
      } else {
        throw new Error('Failed to identify target tab');
      }
    } catch (error) {
      console.error('Error closing tab:', error);
      return {
        success: false,
        error: error.message,
        clientId: clientId,
      };
    }
  }

  // ====================================
  // SEARCH TOOLS
  // ====================================

  async searchFeatures(params) {
    const { query, caseSensitive } = params;

    // Log tool detection as requested by Song
    console.log('[Tool Detection] search_features tool called with params:', params);
    console.log(
      '[Tool Detection] Detected tool: search_features, parameters: query="' +
      query +
      '", caseSensitive=' +
      (caseSensitive || false)
    );

    console.log('searchFeatures called with params:', params);

    // Use existing search functionality from NavigationManager
    if (this.app && this.app.navigationManager) {
      console.log('Using navigationManager.performSearch');

      // Store original settings
      const originalCaseSensitive = document.getElementById('caseSensitive')?.checked;

      // Set case sensitivity for this search
      const caseSensitiveCheckbox = document.getElementById('caseSensitive');
      if (caseSensitiveCheckbox) {
        caseSensitiveCheckbox.checked = caseSensitive || false;
      }

      // Perform the search
      this.app.navigationManager.performSearch(query);

      // Get the results from NavigationManager
      const searchResults = this.app.navigationManager.searchResults || [];

      // Auto-scroll sidebar to search results panel (similar to Gene Details)
      if (searchResults.length > 0 && this.app.scrollSidebarToSection) {
        const searchResultsSection = document.getElementById('searchResultsSection');
        if (searchResultsSection) {
          this.app.scrollSidebarToSection(searchResultsSection);
          console.log('Auto-scrolled sidebar to search results panel');
        }
      }

      // Restore original setting
      if (caseSensitiveCheckbox && originalCaseSensitive !== undefined) {
        caseSensitiveCheckbox.checked = originalCaseSensitive;
      }

      console.log('Search completed, results:', searchResults);

      // CRITICAL FIX: Filter results to remove verbose data and prevent token overflow
      const optimizedResults = searchResults.map(result => {
        if (result.annotation) {
          // Return only essential annotation data, excluding verbose note field
          return {
            ...result,
            annotation: {
              start: result.annotation.start,
              end: result.annotation.end,
              type: result.annotation.type,
              strand: result.annotation.strand,
              qualifiers: {
                gene: result.annotation.qualifiers?.gene,
                locus_tag: result.annotation.qualifiers?.locus_tag,
                product: result.annotation.qualifiers?.product,
                // NOTE: Intentionally excluding 'note' field to prevent token overflow
              },
            },
          };
        }
        return result;
      });

      console.log(
        '[Tool Detection] search_features completed, returning',
        optimizedResults.length,
        'optimized results (note fields excluded)'
      );

      return {
        query: query,
        caseSensitive: caseSensitive || false,
        results: optimizedResults, // Return optimized results instead of raw results
        count: optimizedResults.length,
        optimization_note: 'Results optimized to exclude verbose note fields for token efficiency',
      };
    }

    throw new Error('Navigation manager not available');
  }

  // ====================================
  // TOOL EXECUTION SYSTEM
  // ====================================

  /**
   * Execute tool with priority-based selection
   */
  async executeToolWithPriority(toolName, parameters) {
    // Get tool priority from settings
    const toolPriority = this.chatManager.configManager.get('chatboxSettings.toolPriority', [
      'local',
      'genomics',
      'plugins',
      'mcp',
    ]);

    console.log(`Executing tool '${toolName}' with priority order:`, toolPriority);

    // Try to execute tool based on priority order
    for (const category of toolPriority) {
      const result = await this.tryExecuteToolInCategory(toolName, parameters, category);
      if (result !== undefined) {
        console.log(`Tool '${toolName}' executed in category '${category}'`);
        return result;
      }
    }

    console.log(`Tool '${toolName}' not found in any priority category`);
    return undefined; // Tool not found
  }

  /**
   * Try to execute tool in specific category
   */
  async tryExecuteToolInCategory(toolName, parameters, category) {
    console.log(`Trying to execute '${toolName}' in category '${category}'`);

    switch (category) {
      case 'local':
        return await this.executeLocalTool(toolName, parameters);

      case 'genomics':
        return await this.chatManager.executeGenomicsTool(toolName, parameters);

      case 'plugins':
        return await this.chatManager.executePluginTool(toolName, parameters);

      case 'mcp':
        return await this.chatManager.executeMCPTool(toolName, parameters);

      default:
        console.warn(`Unknown tool category: ${category}`);
        return undefined;
    }
  }

  /**
   * Execute local tools (built-in browser functions)
   */
  async executeLocalTool(toolName, parameters) {
    const localTools = {
      // File Loading tools
      load_genome_file: () => this.chatManager.loadGenomeFile(parameters),
      load_annotation_file: () => this.chatManager.loadAnnotationFile(parameters),
      load_variant_file: () => this.chatManager.loadVariantFile(parameters),
      load_reads_file: () => this.chatManager.loadReadsFile(parameters),
      load_wig_tracks: () => this.chatManager.loadWigTracks(parameters),
      load_operon_file: () => this.chatManager.loadOperonFile(parameters),

      // Navigation and state tools
      navigate_to_position: () => this.navigateToPosition(parameters),
      open_new_tab: () => this.openNewTab(parameters),
      search_features: () => this.searchFeatures(parameters),
      get_current_state: () => this.chatManager.getCurrentState(),
      find_gene_by_name: () => this.chatManager.executeMicrobeFunction('searchGeneByName', parameters),

      // Sequence tools
      get_sequence: () => this.chatManager.getSequence(parameters),
      translate_sequence: () => this.chatManager.translateSequence(parameters),
      calculate_gc_content: () => this.chatManager.calculateGCContent(parameters),

      // Track and display tools
      toggle_track: () => this.chatManager.services.trackBridge.toggleTrack(parameters),
      toggle_annotation_track: () => this.chatManager.services.trackBridge.toggleAnnotationTrack(parameters),
      get_track_status: () => this.chatManager.services.trackBridge.getTrackStatus(),

      // Annotation tools
      create_annotation: () => this.chatManager.createAnnotation(parameters),
      analyze_region: () => this.chatManager.analyzeRegion(parameters),
      get_gene_details: () => this.chatManager.getGeneDetails(parameters),
      get_operons: () => this.chatManager.getOperons(parameters),
      zoom_to_gene: () => this.chatManager.zoomToGene(parameters),
      select_gene: () => this.chatManager.selectGene(parameters),
      select_sequence_region: () => this.chatManager.selectSequenceRegion(parameters),
      get_nearby_features: () => this.chatManager.getNearbyFeatures(parameters),
      find_intergenic_regions: () => this.chatManager.findIntergenicRegions(parameters),

      // Analysis and external tools
      compute_gc: () => this.chatManager.executeMicrobeFunction('computeGC', parameters),
      translate_dna: () => this.chatManager.executeMicrobeFunction('translateDNA', parameters),
      reverse_complement: () => this.chatManager.reverseComplement(parameters),
      codon_usage_analysis: () => this.chatManager.codonUsageAnalysis(parameters),

      // Database tools
      analyze_interpro_domains: () => this.chatManager.analyzeInterProDomains(parameters),
      search_uniprot_database: () => this.chatManager.services.protein.searchUniProtDatabase(parameters),
      advanced_uniprot_search: () => this.chatManager.services.protein.advancedUniprotSearch(parameters),
      get_uniprot_entry: () => this.chatManager.getUniProtEntry(parameters),
      search_interpro_entry: () => this.chatManager.services.protein.searchInterproEntry(parameters),
      get_interpro_entry_details: () => this.chatManager.services.protein.getInterproEntryDetails(parameters),
      search_pattern: () => this.chatManager.searchPattern(parameters),
      find_restriction_sites: () => this.chatManager.findRestrictionSites(parameters),
      virtual_digest: () => this.chatManager.virtualDigest(parameters),
      search_sequence_motif: () => this.chatManager.searchMotif(parameters),

      // AlphaFold and protein structure tools
      search_alphafold_structures: () => this.chatManager.services.protein.searchAlphaFoldStructures(parameters),
      search_alphafold_by_gene: () => this.chatManager.services.protein.searchAlphaFoldStructures(parameters), // Legacy alias
      alphafold_search: () => this.chatManager.services.protein.searchAlphaFoldStructures(parameters), // Legacy alias
      alphafold_get_structure: () => this.chatManager.fetchAlphaFoldStructure(parameters), // Legacy alias
      fetch_alphafold_structure: () => this.chatManager.fetchAlphaFoldStructure(parameters),
      search_pdb_structures: () => this.chatManager.services.protein.searchPdbStructures(parameters),
      fetch_protein_structure: () => this.chatManager.fetchProteinStructure(parameters),
      search_alphafold_by_sequence: () => this.chatManager.searchAlphaFoldBySequence(parameters),

      // Genome-wide analysis tools
      genome_codon_usage_analysis: () => this.chatManager.genomeCodonUsageAnalysis(parameters),
      // Annotation CRUD tools (Phase 1 - OpenClaw integration)
      list_annotations: () => this.chatManager.listAnnotations(parameters),
      get_annotation: () => this.chatManager.getAnnotation(parameters),
      update_annotation: () => this.chatManager.updateAnnotation(parameters),
      delete_annotation: () => this.chatManager.deleteAnnotation(parameters),
      search_annotations: () => this.chatManager.searchAnnotations(parameters),
      bulk_update_annotations: () => this.chatManager.bulkUpdateAnnotations(parameters),
      get_annotation_history: () => this.chatManager.getAnnotationHistory(parameters),


      // Export tools - built-in equivalents for Export As dropdown menu
      export_fasta_sequence: () => this.chatManager.exportFastaSequence(parameters),
      export_genbank_format: () => this.chatManager.exportGenBankFormat(parameters),
      export_cds_fasta: () => this.chatManager.exportCDSFasta(parameters),
      export_protein_fasta: () => this.chatManager.exportProteinFasta(parameters),
      export_gff_annotations: () => this.chatManager.exportGFFAnnotations(parameters),
      export_bed_format: () => this.chatManager.exportBEDFormat(parameters),
      export_current_view_fasta: () => this.chatManager.exportCurrentViewFasta(parameters),

      // System tools
      get_chromosome_list: () => this.chatManager.getChromosomeList(),
      get_genome_info: () => this.chatManager.getGenomeInfo(parameters),
      export_data: () => this.chatManager.exportData(parameters),
      set_working_directory: () => this.chatManager.setWorkingDirectory(parameters),
      list_available_tools: () => this.chatManager.listAvailableTools(parameters),
      download_internet_file: () => this.chatManager.downloadInternetFile(parameters),
      utility_download_internet_file: () => this.chatManager.downloadInternetFile(parameters),
      utility_toggle_settings_modal: () => this.chatManager.services.settings.toggleSettingsModal(parameters),

      // Action system tools (if available)
      copy_sequence: () => this.chatManager.executeActionTool('copy_sequence', parameters),
      action_copy_sequence: () => this.chatManager.executeActionTool('copy_sequence', parameters),
      cut_sequence: () => this.chatManager.executeActionTool('cut_sequence', parameters),
      action_cut_sequence: () => this.chatManager.executeActionTool('cut_sequence', parameters),
      paste_sequence: () => this.chatManager.executeActionTool('paste_sequence', parameters),
      action_paste_sequence: () => this.chatManager.executeActionTool('paste_sequence', parameters),
      delete_sequence: () => this.chatManager.executeActionTool('delete_sequence', parameters),
      action_delete_sequence: () => this.chatManager.executeActionTool('delete_sequence', parameters),
      insert_sequence: () => this.chatManager.executeActionTool('insert_sequence', parameters),
      action_insert_sequence: () => this.chatManager.executeActionTool('insert_sequence', parameters),
      replace_sequence: () => this.chatManager.executeActionTool('replace_sequence', parameters),
      action_replace_sequence: () => this.chatManager.executeActionTool('replace_sequence', parameters),
      execute_actions: () => this.chatManager.executeActionTool('execute_actions', parameters),
      action_execute_actions: () => this.chatManager.executeActionTool('execute_actions', parameters),
      get_action_list: () => this.chatManager.executeActionTool('get_action_list', parameters),
      show_action_list: () => this.chatManager.executeActionTool('get_action_list', parameters),
      action_get_action_list: () => this.chatManager.executeActionTool('get_action_list', parameters),
      action_show_action_list: () => this.chatManager.executeActionTool('get_action_list', parameters),
      clear_actions: () => this.chatManager.executeActionTool('clear_actions', parameters),
      action_clear_actions: () => this.chatManager.executeActionTool('clear_actions', parameters),
      get_clipboard_content: () => this.chatManager.executeActionTool('get_clipboard_content', parameters),
      action_get_clipboard_content: () => this.chatManager.executeActionTool('get_clipboard_content', parameters),

      // Track settings tools
      get_track_settings: () => this.chatManager.services.trackBridge.getTrackSettings(parameters),
      set_track_settings: () => this.chatManager.services.trackBridge.setTrackSettings(parameters),
      get_all_track_settings: () => this.chatManager.services.trackBridge.getAllTrackSettings(parameters),
      reset_track_settings: () => this.chatManager.services.trackBridge.resetTrackSettings(parameters),
      get_track_settings_schema: () => this.chatManager.services.trackBridge.getTrackSettingsSchema(parameters),
      batch_set_track_settings: () => this.chatManager.services.trackBridge.batchSetTrackSettings(parameters),

      // Primer Design Tools
      calculate_primer_properties: () => this.chatManager.primerCalculateProperties(parameters),
      design_primers: () => this.chatManager.primerDesign(parameters),
      find_primer_binding_sites: () => this.chatManager.primerFindBindingSites(parameters),
      add_primer_annotation: async () => {
        // Fallback implementation if Primer integration hasn't loaded
        if (typeof this.chatManager.primerAddAnnotation === 'function') {
          return await this.chatManager.primerAddAnnotation(parameters);
        }
        // Direct implementation using createAnnotation
        if (!parameters.chromosome || !parameters.start || !parameters.end || !parameters.name) {
          throw new Error('Missing required fields for annotation: chromosome, start, end, name');
        }
        const strand = parameters.strand === '-' ? -1 : 1;
        return await this.chatManager.createAnnotation({
          type: 'primer',
          name: parameters.name,
          chromosome: parameters.chromosome,
          start: parseInt(parameters.start),
          end: parseInt(parameters.end),
          strand: strand,
          description: parameters.description || `Tm: ${parameters.tm || '?'}, GC: ${parameters.gcContent || '?'}%`
        });
      },

      // View control tools
      zoom_in: () => this.zoomIn(parameters),
      zoom_out: () => this.zoomOut(parameters),
      pan_left: () => this.panLeft(parameters),
      pan_right: () => this.panRight(parameters),

      // Multi-window management tools (IPC-based, no MCP server required)
      list_genome_windows: () => this.listGenomeWindows(parameters),
      switch_active_window: () => this.switchActiveWindow(parameters),

      // Settings modal tools
      toggle_settings_modal: () => this.chatManager.services.settings.toggleSettingsModal(parameters),

      // Benchmark tools
      open_benchmark: () => this.chatManager.openBenchmark(parameters),
      start_benchmark: () => this.chatManager.startBenchmark(parameters),
      stop_benchmark: () => this.chatManager.stopBenchmark(parameters),
      pause_benchmark: () => this.chatManager.pauseBenchmark(parameters),
      resume_benchmark: () => this.chatManager.resumeBenchmark(parameters),
      get_benchmark_results: () => this.chatManager.getBenchmarkResults(parameters),
      get_benchmark_status: () => this.chatManager.getBenchmarkStatus(parameters),
      export_benchmark_results: () => this.chatManager.exportBenchmarkResults(parameters),
    };

    if (localTools[toolName]) {
      try {
        const result = await localTools[toolName]();
        console.log(`Local tool '${toolName}' executed successfully`);
        return result;
      } catch (error) {
        console.error(`Local tool '${toolName}' execution failed:`, error);
        throw error;
      }
    }

    return undefined; // Tool not found in local tools
  }

  // ====================================
  // VIEW CONTROL TOOLS
  // ====================================

  /**
   * Zoom in the current genome view
   */
  async zoomIn(parameters = {}) {
    const factor = parameters.factor || 2;
    if (!this.app.navigationManager) throw new Error('NavigationManager not available');
    for (let i = 0; i < Math.log2(factor); i++) {
      this.app.navigationManager.zoomIn();
    }
    const state = this.chatManager.getCurrentState();
    return {
      success: true,
      factor,
      message: `Zoomed in by ${factor}x`,
      newRange: state.viewingRegion,
    };
  }

  /**
   * Zoom out the current genome view
   */
  async zoomOut(parameters = {}) {
    const factor = parameters.factor || 2;
    if (!this.app.navigationManager) throw new Error('NavigationManager not available');
    for (let i = 0; i < Math.log2(factor); i++) {
      this.app.navigationManager.zoomOut();
    }
    const state = this.chatManager.getCurrentState();
    return {
      success: true,
      factor,
      message: `Zoomed out by ${factor}x`,
      newRange: state.viewingRegion,
    };
  }

  /**
   * Pan the view left
   */
  async panLeft(parameters = {}) {
    if (!this.app.navigationManager) throw new Error('NavigationManager not available');
    const amount = parameters.amount || null; // NavigationManager handles default
    this.app.navigationManager.navigatePrevious(amount);
    const state = this.chatManager.getCurrentState();
    return { success: true, message: 'Panned left', newRange: state.viewingRegion };
  }

  /**
   * Pan the view right
   */
  async panRight(parameters = {}) {
    if (!this.app.navigationManager) throw new Error('NavigationManager not available');
    const amount = parameters.amount || null;
    this.app.navigationManager.navigateNext(amount);
    const state = this.chatManager.getCurrentState();
    return { success: true, message: 'Panned right', newRange: state.viewingRegion };
  }

  // ====================================
  // MULTI-WINDOW TOOLS
  // ====================================

  /**
   * List all open genome browser windows via IPC to main process
   * Works without MCP server - directly queries the window registry
   */
  async listGenomeWindows(parameters = {}) {
    console.log(`[LocalToolService] listGenomeWindows called`);
    console.log(`[LocalToolService] this.app.windowId: ${this.app.windowId}`);
    try {
      // Use Electron IPC to query the main process window registry
      let ipc;
      try {
        ipc = typeof ipcRenderer !== 'undefined' ? ipcRenderer : require('electron').ipcRenderer;
      } catch (e) {
        ipc = require('electron').ipcRenderer;
      }

      console.log(`[LocalToolService] Calling ipc.invoke('list-genome-windows')`);
      const windows = await ipc.invoke('list-genome-windows');
      console.log(`[LocalToolService] IPC returned ${windows.length} windows:`, windows);

      return {
        success: true,
        windowCount: windows.length,
        windows: windows,
        currentWindowId: this.app.windowId || null,
      };
    } catch (error) {
      console.error('[LocalToolService] listGenomeWindows error:', error);
      return {
        success: false,
        error: error.message,
        windowCount: 0,
        windows: [],
      };
    }
  }

  /**
   * Switch focus to a specific genome browser window via IPC
   * Works without MCP server - directly sends focus command to main process
   */
  async switchActiveWindow(parameters = {}) {
    const { windowId } = parameters;
    if (!windowId) {
      return { success: false, error: 'windowId parameter is required. Use list_genome_windows to see available IDs.' };
    }

    try {
      let ipc;
      try {
        ipc = typeof ipcRenderer !== 'undefined' ? ipcRenderer : require('electron').ipcRenderer;
      } catch (e) {
        ipc = require('electron').ipcRenderer;
      }

      const result = await ipc.invoke('focus-genome-window', windowId);
      return result;
    } catch (error) {
      console.error('[LocalToolService] switchActiveWindow error:', error);
      return { success: false, error: error.message };
    }
  }

  // ====================================
  // DELEGATED TOOL EXECUTION
  // ====================================

  async executeToolByName(toolName, parameters) {
    if (!this.chatManager.services || !this.chatManager.services.execution) {
       console.error('[LocalToolService] ToolExecutionService not initialized!');
       throw new Error('ChatManager services not fully initialized');
    }
    return await this.chatManager.services.execution.execute(toolName, parameters);
  }

  // ====================================
  // SEQUENCE MANIPULATION TOOLS
  // ====================================

  /**
   * Execute delete sequence function directly
   */
  async executeDeleteSequence(parameters) {
    try {
      const { chromosome, start, end, strand = '+' } = parameters;

      // Validate parameters
      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Missing required parameters: chromosome, start, end');
      }

      if (start > end) {
        throw new Error('Start position must be less than or equal to end position');
      }

      // Use MicrobeGenomicsFunctions if available
      if (window.MicrobeFns && window.MicrobeFns.delete_sequence) {
        const result = window.MicrobeFns.delete_sequence(chromosome, start, end);
        return result;
      }

      // Fallback to ActionManager if MicrobeFns not available
      const genomeBrowser = window.genomeBrowser;
      if (!genomeBrowser || !genomeBrowser.actionManager) {
        throw new Error('Neither MicrobeFns nor ActionManager available');
      }

      const target = `${chromosome}:${start}-${end}`;
      const length = end - start + 1;
      const metadata = { chromosome, start, end, strand, selectionSource: 'function_call' };

      const actionId = genomeBrowser.actionManager.addAction(
        genomeBrowser.actionManager.ACTION_TYPES.DELETE_SEQUENCE,
        target,
        `Delete ${length.toLocaleString()} bp from ${chromosome}:${start}-${end}`,
        metadata
      );

      const result = {
        success: true,
        actionId: actionId,
        action: 'delete',
        target: target,
        length: length,
        message: `Delete action queued for ${chromosome}:${start}-${end} (${length} bp)`,
      };

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute delete gene function by name
   */
  async executeDeleteGene(parameters) {
    try {
      const { geneName, chromosome } = parameters;

      // Validate parameters
      if (!geneName) {
        throw new Error('Missing required parameter: geneName (can be gene name or locus tag)');
      }

      // First, find the gene using existing search functionality
      const searchResult = await this.chatManager.searchGeneByName({ name: geneName, chromosome });

      if (!searchResult.found || !searchResult.genes || searchResult.genes.length === 0) {
        throw new Error(
          `Gene/locus tag "${geneName}" not found${chromosome ? ` in chromosome ${chromosome}` : ''}. Make sure the gene name or locus tag is correct.`
        );
      }

      // Get the first matching gene (prefer CDS over other features)
      let targetGene = searchResult.genes.find(gene => gene.type === 'CDS') || searchResult.genes[0];

      if (!targetGene || !targetGene.start || !targetGene.end) {
        throw new Error(`Invalid gene data for "${geneName}": missing coordinates`);
      }

      const geneChromosome = targetGene.chromosome || searchResult.chromosome;
      const geneStart = targetGene.start;
      const geneEnd = targetGene.end;
      const geneStrand = targetGene.strand || '+';

      // Use the delete_sequence functionality with gene coordinates
      const deleteResult = await this.executeDeleteSequence({
        chromosome: geneChromosome,
        start: geneStart,
        end: geneEnd,
        strand: geneStrand,
      });

      // Enhance the result with gene-specific information
      const result = {
        ...deleteResult,
        deletedGene: {
          name: geneName,
          chromosome: geneChromosome,
          start: geneStart,
          end: geneEnd,
          strand: geneStrand,
          length: geneEnd - geneStart + 1,
          type: targetGene.type,
          product: targetGene.qualifiers?.product || 'Unknown protein',
        },
        message: `Gene/locus tag "${geneName}" deletion queued: ${geneChromosome}:${geneStart}-${geneEnd} (${geneEnd - geneStart + 1} bp)`,
      };

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute action function through UI response functions
   */
  async executeActionFunction(functionName, parameters) {
    try {
      // Use window.genomeBrowser for access
      const genomeBrowser = window.genomeBrowser;

      if (!genomeBrowser) {
        throw new Error('Genome browser not available via window.genomeBrowser');
      }

      if (!genomeBrowser.actionManager) {
        throw new Error('ActionManager not available in genome browser');
      }

      // Use ActionManager's executeActionFunction method which delegates to function* methods
      // This ensures parameters are used instead of showing UI dialogs
      const result = await genomeBrowser.actionManager.executeActionFunction(functionName, parameters);

      return result;
    } catch (error) {
      throw error;
    }
  }

  // ====================================
  // TEST METHODS
  // ====================================

  /**
   * Test MicrobeGenomicsFunctions integration
   */
  testMicrobeGenomicsIntegration() {
    console.log('=== Testing MicrobeGenomicsFunctions Integration ===');

    if (!this.chatManager.MicrobeFns) {
      console.error('MicrobeGenomicsFunctions not available');
      return {
        success: false,
        error: 'MicrobeGenomicsFunctions not loaded',
      };
    }

    const testResults = {
      functionsAvailable: {},
      categoriesAvailable: false,
      examplesAvailable: false,
      totalFunctions: 0,
    };

    try {
      // Test if categories method works
      const categories = this.chatManager.MicrobeFns.getFunctionCategories();
      testResults.categoriesAvailable = !!categories;
      console.log('Categories available:', Object.keys(categories));

      // Test if examples method works
      const examples = this.chatManager.MicrobeFns.getUsageExamples();
      testResults.examplesAvailable = !!examples;
      console.log('Examples available:', examples.length);

      // Test individual function availability
      const testFunctions = [
        'navigateTo',
        'jumpToGene',
        'getCurrentRegion',
        'scrollLeft',
        'scrollRight',
        'zoomIn',
        'zoomOut',
        'computeGC',
        'reverseComplement',
        'translateDNA',
        'findORFs',
        'calculateEntropy',
        'calcRegionGC',
        'calculateMeltingTemp',
        'calculateMolecularWeight',
        'analyzeCodonUsage',
        'predictPromoter',
        'predictRBS',
        'predictTerminator',
        'searchGeneByName',
        'searchSequenceMotif',
        'searchByPosition',
        'searchIntergenicRegions',
        'editAnnotation',
        'deleteAnnotation',
        'mergeAnnotations',
        'addAnnotation',
        'getUpstreamRegion',
        'getDownstreamRegion',
        'addTrack',
        'addVariant',
      ];

      testFunctions.forEach(funcName => {
        const isAvailable = typeof this.chatManager.MicrobeFns[funcName] === 'function';
        testResults.functionsAvailable[funcName] = isAvailable;
        if (isAvailable) {
          testResults.totalFunctions++;
          console.log(`${funcName} available`);
        } else {
          console.log(`${funcName} NOT available`);
        }
      });

      // Test a simple function call
      try {
        const testSequence = 'ATGCGCTATCG';
        const gcResult = this.chatManager.MicrobeFns.computeGC(testSequence);
        console.log(`Function call test: computeGC("${testSequence}") = ${gcResult}%`);
        testResults.functionCallTest = { success: true, result: gcResult };
      } catch (error) {
        console.log(`Function call test failed: ${error.message}`);
        testResults.functionCallTest = { success: false, error: error.message };
      }

      console.log('=== Integration Test Summary ===');
      console.log(`Total functions available: ${testResults.totalFunctions}/${testFunctions.length}`);
      console.log(`Categories available: ${testResults.categoriesAvailable}`);
      console.log(`Examples available: ${testResults.examplesAvailable}`);
      console.log('===================================');

      return {
        success: true,
        ...testResults,
      };
    } catch (error) {
      console.error('Integration test failed:', error);
      return {
        success: false,
        error: error.message,
        ...testResults,
      };
    }
  }

  /**
   * Test tool execution through ChatManager
   */
  async testToolExecution() {
    try {
      const testResult = await this.chatManager.openProteinViewer({
        pdbId: '1TUP',
        title: 'Test Protein Structure',
      });

      console.log('Tool execution test result:', testResult);
      this.chatManager.services.messaging.addMessageToChat('Tool execution test completed. Check console for details.', 'assistant');
    } catch (error) {
      console.error('Tool execution test failed:', error);
      this.chatManager.services.messaging.addMessageToChat(`Tool execution test failed: ${error.message}`, 'assistant', true);
    }
  }
}

window.LocalToolService = LocalToolService;
