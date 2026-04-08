/**
 * Internal MCP Server for CodeXomics
 *
 * This runs inside the renderer process and has direct access to all Genome Studio modules.
 * It communicates with the main process MCP server via IPC.
 */

// Access ipcRenderer without redeclaring
let mcpServerIpc;
try {
  if (typeof ipcRenderer !== 'undefined') {
    mcpServerIpc = ipcRenderer;
  } else {
    mcpServerIpc = require('electron').ipcRenderer;
  }
} catch (e) {
  mcpServerIpc = require('electron').ipcRenderer;
}

class InternalMCPServer {
  constructor() {
    this.genomeStudio = null;
    this.isRunning = false;
    this.setupIPCHandlers();
  }

  // Initialize with Genome Studio instance
  initialize(genomeStudioInstance) {
    this.genomeStudio = genomeStudioInstance;
    console.log('🔧 Internal MCP Server initialized with Genome Studio instance');
  }

  // Setup IPC handlers for communication with main process MCP server
  setupIPCHandlers() {
    mcpServerIpc.on('mcp-tool-call', async (event, request) => {
      const { requestId, method, parameters } = request;

      try {
        const result = await this.executeMethod(method, parameters);

        // Send success response back to main process
        mcpServerIpc.send('mcp-tool-response', {
          requestId,
          success: true,
          result,
        });
      } catch (error) {
        console.error(`🚨 MCP Tool Error for method ${method}:`, error);

        // Send error response back to main process
        mcpServerIpc.send('mcp-tool-response', {
          requestId,
          success: false,
          error: error.message,
        });
      }
    });
  }

  // Execute the requested method
  // Uses dynamic routing to support all 40+ tools via ChatManager delegation
  async executeMethod(method, parameters) {
    if (!this.genomeStudio) {
      throw new Error('Genome Studio instance not available');
    }

    console.log(`🔧 [InternalMCPServer] Executing method: ${method}`);

    // Convert camelCase method name back to snake_case tool name for ChatManager
    const toolName = method.replace(/([A-Z])/g, '_$1').toLowerCase();

    // First, try to delegate to ChatManager for comprehensive tool support
    // ChatManager.executeToolWithPriority() handles 70+ tools with priority routing
    if (this.genomeStudio.chatManager) {
      try {
        console.log(`📡 [InternalMCPServer] Delegating '${toolName}' to ChatManager`);
        const result = await this.genomeStudio.chatManager.executeToolWithPriority(toolName, parameters);
        if (result !== undefined) {
          console.log(`✅ [InternalMCPServer] Tool '${toolName}' executed via ChatManager`);
          return {
            success: true,
            result,
            executedVia: 'ChatManager',
          };
        }
      } catch (error) {
        console.warn(`⚠️ [InternalMCPServer] ChatManager execution failed for '${toolName}':`, error.message);
        // Rethrow the original error instead of falling through
        throw error;
      }
    }

    // Fallback: Direct handlers for core methods that may not be in ChatManager
    // These are kept for backward compatibility and as fallback
    switch (method) {
      // Navigation methods
      case 'navigateToPosition':
        return await this.navigateToPosition(parameters);

      case 'searchFeatures':
        return await this.searchFeatures(parameters);

      case 'jumpToGene':
        return await this.jumpToGene(parameters);

      case 'searchGeneByName':
        return await this.searchGeneByName(parameters);

      // State management
      case 'getCurrentState':
        return await this.getCurrentState(parameters);

      case 'getGenomeInfo':
        return await this.getGenomeInfo(parameters);

      // Track management
      case 'toggleTrack':
        return await this.toggleTrack(parameters);

      // Sequence analysis
      case 'getCodingSequence':
        return await this.getCodingSequence(parameters);

      case 'getSequenceRegion':
        return await this.getSequenceRegion(parameters);

      // Protein structure analysis
      case 'searchAlphafoldStructures':
      case 'searchAlphafoldByGene':
        return await this.searchAlphaFoldByGene(parameters);

      // Utility methods
      case 'ping':
        return this.ping();

      // New navigation methods
      case 'openNewTab':
        return await this.openNewTab(parameters);

      case 'switchToTab':
        return await this.switchToTab(parameters);

      case 'closeTab':
        return await this.closeTab(parameters);

      case 'zoomIn':
        return await this.zoom(parameters, 'in');

      case 'zoomOut':
        return await this.zoom(parameters, 'out');

      // Codon usage analysis tools
      case 'codonUsageAnalysis':
        return await this.codonUsageAnalysis(parameters);

      case 'genomeCodonUsageAnalysis':
        return await this.genomeCodonUsageAnalysis(parameters);

      // Multi-window management (IPC-based)
      case 'listGenomeWindows':
        return await this.listGenomeWindowsViaIPC();

      case 'focusGenomeWindow':
      case 'switchActiveWindow':
        return await this.focusGenomeWindowViaIPC(parameters);

      default:
        // If method is not found in fallback handlers, try snake_case version
        // This handles cases where the method name format doesn't match
        console.warn(`⚠️ [InternalMCPServer] Method '${method}' not found in fallback handlers`);
        throw new Error(
          `Unknown method: ${method}. Tool '${toolName}' was not found in ChatManager or fallback handlers.`
        );
    }
  }

  // New helper methods for additional navigation tools
  async openNewTab(parameters) {
    if (!this.genomeStudio.navigationManager) {
      throw new Error('NavigationManager not available');
    }

    // Delegate to TabManager if available
    if (this.genomeStudio.tabManager && this.genomeStudio.tabManager.openNewTab) {
      const result = await this.genomeStudio.tabManager.openNewTab(parameters);
      return {
        success: true,
        tabId: result?.tabId,
        message: `Opened new tab${parameters.geneName ? ` for gene ${parameters.geneName}` : ''}`,
      };
    }

    throw new Error('Tab management not available');
  }

  async switchToTab(parameters) {
    if (!this.genomeStudio.tabManager) {
      throw new Error('TabManager not available');
    }

    const { tab_id, tab_name, tab_index } = parameters;
    const tabManager = this.genomeStudio.tabManager;
    let targetTabId = null;
    let targetTabTitle = null;

    // Strategy 1: Switch by specific tab ID
    if (tab_id) {
      if (tabManager.tabs.has(tab_id)) {
        targetTabId = tab_id;
        const tabState = tabManager.tabs.get(tab_id);
        targetTabTitle = tabState.title || `Tab ${tab_id}`;
      } else {
        throw new Error(`Tab with ID '${tab_id}' not found`);
      }
    }
    // Strategy 2: Switch by tab name/title (case-insensitive partial matching)
    else if (tab_name) {
      const tabEntries = Array.from(tabManager.tabs.entries());
      const foundTab = tabEntries.find(([id, state]) => {
        return state.title && state.title.toLowerCase().includes(tab_name.toLowerCase());
      });
      if (foundTab) {
        targetTabId = foundTab[0];
        targetTabTitle = foundTab[1].title;
      } else {
        throw new Error(`No tab found matching name '${tab_name}'`);
      }
    }
    // Strategy 3: Switch by tab index (zero-based)
    else if (tab_index !== undefined) {
      const tabIds = Array.from(tabManager.tabs.keys());
      if (tab_index >= 0 && tab_index < tabIds.length) {
        targetTabId = tabIds[tab_index];
        const tabState = tabManager.tabs.get(targetTabId);
        targetTabTitle = tabState.title || `Tab ${targetTabId}`;
      } else {
        throw new Error(`Tab index ${tab_index} is out of range (0-${tabIds.length - 1})`);
      }
    } else {
      throw new Error('Must provide tab_id, tab_name, or tab_index');
    }

    // Perform the tab switch using the correct method
    tabManager.switchToTab(targetTabId);

    return {
      success: true,
      tab_id: targetTabId,
      tab_title: targetTabTitle,
      message: `Switched to tab: ${targetTabTitle}`,
    };
  }

  async closeTab(parameters) {
    if (!this.genomeStudio.tabManager) {
      throw new Error('TabManager not available');
    }

    const { tab_id, tab_name, tab_index } = parameters;
    const tabManager = this.genomeStudio.tabManager;
    let targetTabId = null;
    let targetTabTitle = null;

    // Prevent closing the last tab
    if (tabManager.tabs.size <= 1) {
      throw new Error('Cannot close the last remaining tab');
    }

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
      const tabEntries = Array.from(tabManager.tabStates?.entries() || []);
      const foundTab = tabEntries.find(([id, state]) => {
        return state.title && state.title.toLowerCase().includes(tab_name.toLowerCase());
      });
      if (foundTab) {
        targetTabId = foundTab[0];
        targetTabTitle = foundTab[1].title;
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
      throw new Error('Must provide tab_id, tab_name, or tab_index');
    }

    // Perform the tab close using the correct method
    tabManager.closeTab(targetTabId);

    return {
      success: true,
      closed_tab_id: targetTabId,
      closed_tab_title: targetTabTitle,
      remaining_tabs: tabManager.tabs.size,
      message: `Closed tab: ${targetTabTitle}`,
    };
  }

  async zoom(parameters, direction) {
    if (!this.genomeStudio.navigationManager) {
      throw new Error('NavigationManager not available');
    }

    const factor = parameters.factor || 2;

    if (direction === 'in') {
      await this.genomeStudio.navigationManager.zoomIn(factor);
    } else {
      await this.genomeStudio.navigationManager.zoomOut(factor);
    }

    return {
      success: true,
      direction,
      factor,
      message: `Zoomed ${direction} by factor ${factor}`,
    };
  }

  // Codon usage analysis - delegates to ChatManager
  async codonUsageAnalysis(parameters) {
    if (!this.genomeStudio.chatManager) {
      throw new Error('ChatManager not available');
    }

    console.log('🧬 [InternalMCPServer] Delegating codonUsageAnalysis to ChatManager');
    const result = await this.genomeStudio.chatManager.codonUsageAnalysis(parameters);
    return result;
  }

  // Genome-wide codon usage analysis - delegates to ChatManager
  async genomeCodonUsageAnalysis(parameters) {
    if (!this.genomeStudio.chatManager) {
      throw new Error('ChatManager not available');
    }

    console.log('🧬 [InternalMCPServer] Delegating genomeCodonUsageAnalysis to ChatManager');
    const result = await this.genomeStudio.chatManager.genomeCodonUsageAnalysis(parameters);
    return result;
  }

  // Navigation implementations
  async navigateToPosition({ chromosome, start, end, position }) {
    // Auto-detect chromosome if not provided
    if (!chromosome) {
      const chromosomeSelect = document.getElementById('chromosomeSelect');
      if (chromosomeSelect && chromosomeSelect.value) {
        chromosome = chromosomeSelect.value;
      } else if (this.genomeStudio.currentSequence) {
        const availableChromosomes = Object.keys(this.genomeStudio.currentSequence);
        if (availableChromosomes.length > 0) {
          chromosome = availableChromosomes[0];
        }
      }
    }

    if (!chromosome) {
      throw new Error('No chromosome specified and unable to auto-detect');
    }

    // Handle position parameter with default 2000bp range
    if (position !== undefined && (start === undefined || end === undefined)) {
      const defaultRange = 2000;
      start = Math.max(1, position - Math.floor(defaultRange / 2));
      end = position + Math.floor(defaultRange / 2);
    }

    const sequence = this.genomeStudio.currentSequence[chromosome];
    if (!sequence) {
      throw new Error(`Chromosome ${chromosome} not found in loaded data`);
    }

    // Validate and adjust bounds (convert to 0-based)
    const validatedStart = Math.max(0, start - 1);
    const validatedEnd = Math.min(sequence.length, end);

    // Set position directly
    this.genomeStudio.currentPosition = { start: validatedStart, end: validatedEnd };
    this.genomeStudio.currentChromosome = chromosome;

    // Update view
    this.genomeStudio.updateStatistics(chromosome, sequence);
    this.genomeStudio.displayGenomeView(chromosome, sequence);

    if (this.genomeStudio.genomeNavigationBar) {
      this.genomeStudio.genomeNavigationBar.update();
    }

    return {
      success: true,
      chromosome,
      start,
      end,
      message: `Navigated to ${chromosome}:${start}-${end}`,
    };
  }

  async searchFeatures({ query, featureType }) {
    if (!this.genomeStudio.navigationManager) {
      throw new Error('NavigationManager not available');
    }

    const results = await this.genomeStudio.navigationManager.searchFeatures(query, featureType);

    return {
      success: true,
      query,
      featureType,
      results: results || [],
      count: results ? results.length : 0,
    };
  }

  async jumpToGene({ geneName }) {
    if (!this.genomeStudio.navigationManager) {
      throw new Error('NavigationManager not available');
    }

    const result = await this.genomeStudio.navigationManager.jumpToGene(geneName);

    return {
      success: true,
      geneName,
      result,
    };
  }

  async searchGeneByName({ name }) {
    if (!this.genomeStudio.navigationManager) {
      throw new Error('NavigationManager not available');
    }

    const results = await this.genomeStudio.navigationManager.searchGeneByName(name);

    return {
      success: true,
      geneName: name,
      results: results || [],
      found: results && results.length > 0,
    };
  }

  // State management implementations
  async getCurrentState() {
    const state = {
      timestamp: Date.now(),
    };

    if (this.genomeStudio.navigationManager) {
      state.navigation = {
        currentChromosome: this.genomeStudio.currentChromosome,
        currentPosition: this.genomeStudio.currentPosition,
        zoomLevel: this.genomeStudio.navigationManager.zoomLevel,
      };
    }

    if (this.genomeStudio.fileManager) {
      state.files = {
        loadedFiles: this.genomeStudio.loadedFiles || [],
        currentGenome: this.genomeStudio.fileManager.currentGenome,
      };
    }

    if (this.genomeStudio.trackRenderer) {
      state.tracks = {
        visibleTracks: Object.keys(this.genomeStudio.trackVisibility || {}),
        trackVisibility: this.genomeStudio.trackVisibility,
      };
    }

    return state;
  }

  async getGenomeInfo() {
    if (!this.genomeStudio.fileManager) {
      throw new Error('FileManager not available');
    }

    const genomeInfo = {
      name: this.genomeStudio.fileManager.currentGenome?.name || 'Unknown',
      length: this.genomeStudio.sequenceLength || 0,
      chromosomes: this.genomeStudio.currentSequence ? Object.keys(this.genomeStudio.currentSequence) : [],
      loadedFiles: this.genomeStudio.loadedFiles || [],
    };

    return {
      success: true,
      genomeInfo,
    };
  }

  // Track management implementation
  async toggleTrack({ trackName, visible }) {
    if (!this.genomeStudio.trackRenderer) {
      throw new Error('TrackRenderer not available');
    }

    // Normalize track name (handle snake_case and variations)
    const trackMapping = {
      genes: 'genes',
      gc: 'gc',
      variants: 'variants',
      reads: 'reads',
      proteins: 'proteins',
      wigTracks: 'wigTracks',
      wig: 'wigTracks',
      sequence: 'sequence',
      sequenceLine: 'sequenceLine',
      actions: 'actions',
      action: 'actions',
      blast: 'blast',
      blast_results: 'blast',
    };

    const normalizedTrackName = trackMapping[trackName] || trackName;

    // Update track visibility
    this.genomeStudio.trackVisibility = this.genomeStudio.trackVisibility || {};
    this.genomeStudio.trackVisibility[normalizedTrackName] = visible;

    // Also update the UI checkboxes to reflect the state change
    // This ensures UI stays in sync with internal state
    const checkboxMapping = {
      genes: 'trackGenes',
      gc: 'trackGC',
      variants: 'trackVariants',
      reads: 'trackReads',
      proteins: 'trackProteins',
      wigTracks: 'trackWIG',
      sequence: 'trackSequence',
      sequenceLine: 'trackSequenceLine',
      actions: 'trackActions',
      blast: 'trackBlast',
    };

    const checkboxId = checkboxMapping[normalizedTrackName];
    if (checkboxId) {
      const checkbox = document.getElementById(checkboxId);
      if (checkbox) {
        checkbox.checked = visible;
        // Trigger change event to ensure any listeners are notified
        checkbox.dispatchEvent(new Event('change'));
      }

      // Also sync sidebar checkbox if it exists
      const sidebarCheckboxId = 'sidebar' + checkboxId.charAt(0).toUpperCase() + checkboxId.slice(1);
      const sidebarCheckbox = document.getElementById(sidebarCheckboxId);
      if (sidebarCheckbox) {
        sidebarCheckbox.checked = visible;
      }
    }

    // Trigger track re-rendering
    if (this.genomeStudio.trackRenderer.render) {
      await this.genomeStudio.trackRenderer.render();
    }

    return {
      success: true,
      trackName: normalizedTrackName,
      originalTrackName: trackName,
      visible,
      message: `Track ${normalizedTrackName} ${visible ? 'shown' : 'hidden'}`,
    };
  }

  // Sequence analysis implementations
  async getCodingSequence({ identifier, geneName, gene_name, includeUtrs = false }) {
    // Support multiple parameter names for compatibility
    const geneId = identifier || geneName || gene_name;

    if (!geneId) {
      throw new Error('Gene identifier is required (identifier, geneName, or gene_name)');
    }

    // Use MicrobeGenomicsFunctions if available (preferred - has full implementation)
    if (window.MicrobeGenomicsFunctions) {
      const result = window.MicrobeGenomicsFunctions.getCodingSequence(geneId);
      if (result && result.success) {
        return {
          success: true,
          identifier: geneId,
          geneName: result.geneName,
          locusTag: result.locusTag,
          chromosome: result.chromosome,
          position: `${result.start}-${result.end}`,
          strand: result.strand,
          length: result.length,
          gcContent: result.gcContent,
          codingSequence: result.codingSequence,
          proteinSequence: result.proteinSequence,
          proteinLength: result.proteinLength,
        };
      } else {
        return {
          success: false,
          identifier: geneId,
          error: result?.error || `Gene '${geneId}' not found`,
          suggestions: result?.suggestions || [],
        };
      }
    }

    // Fallback to sequenceUtils if available
    if (this.genomeStudio.sequenceUtils?.getCodingSequence) {
      const sequence = await this.genomeStudio.sequenceUtils.getCodingSequence(geneId, includeUtrs);
      return {
        success: true,
        identifier: geneId,
        includeUtrs,
        sequence: sequence || '',
        length: sequence ? sequence.length : 0,
      };
    }

    throw new Error('No sequence extraction method available');
  }

  async getSequenceRegion({ chromosome, start, end }) {
    if (!this.genomeStudio.currentSequence || !this.genomeStudio.currentSequence[chromosome]) {
      throw new Error(`Sequence for chromosome ${chromosome} not available`);
    }

    const fullSequence = this.genomeStudio.currentSequence[chromosome];
    const sequence = fullSequence.substring(start - 1, end); // Convert to 0-based indexing

    return {
      success: true,
      chromosome,
      start,
      end,
      sequence: sequence || '',
      length: sequence ? sequence.length : 0,
    };
  }

  // Protein structure analysis implementations
  async searchAlphaFoldByGene(parameters) {
    // Delegate to ChatManager's AlphaFold search implementation
    if (!this.genomeStudio.chatManager) {
      throw new Error('ChatManager not available');
    }

    try {
      const result = await this.genomeStudio.chatManager.searchAlphaFoldByGene(parameters);
      return result;
    } catch (error) {
      console.error('InternalMCPServer AlphaFold search error:', error);
      return {
        success: false,
        error: error.message,
        tool: 'search_alphafold_structures',
        parameters: parameters,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Multi-window management via IPC
  async listGenomeWindowsViaIPC() {
    try {
      const windows = await mcpServerIpc.invoke('list-genome-windows');
      return {
        success: true,
        windowCount: windows.length,
        windows: windows,
      };
    } catch (error) {
      console.error('[InternalMCPServer] listGenomeWindowsViaIPC error:', error);
      return { success: false, error: error.message, windowCount: 0, windows: [] };
    }
  }

  async focusGenomeWindowViaIPC(parameters) {
    const { windowId } = parameters;
    if (!windowId) {
      return { success: false, error: 'windowId parameter is required' };
    }
    try {
      const result = await mcpServerIpc.invoke('focus-genome-window', windowId);
      return result;
    } catch (error) {
      console.error('[InternalMCPServer] focusGenomeWindowViaIPC error:', error);
      return { success: false, error: error.message };
    }
  }

  // Utility implementations
  ping() {
    return {
      success: true,
      timestamp: Date.now(),
      message: 'Internal MCP Server is ready',
      genomeStudioReady: !!this.genomeStudio,
      modules: {
        navigationManager: !!this.genomeStudio?.navigationManager,
        fileManager: !!this.genomeStudio?.fileManager,
        trackRenderer: !!this.genomeStudio?.trackRenderer,
        sequenceUtils: !!this.genomeStudio?.sequenceUtils,
      },
    };
  }

  // Start the internal server
  start() {
    this.isRunning = true;
    console.log('✅ Internal MCP Server started');

    // Notify main process that internal server is ready
    mcpServerIpc.send('internal-mcp-server-ready');
  }

  // Stop the internal server
  stop() {
    this.isRunning = false;
    console.log('🛑 Internal MCP Server stopped');

    // Notify main process that internal server is stopped
    mcpServerIpc.send('internal-mcp-server-stopped');
  }

  // Get server status
  getStatus() {
    return {
      running: this.isRunning,
      genomeStudioReady: !!this.genomeStudio,
      modules: this.genomeStudio
        ? {
          navigationManager: !!this.genomeStudio.navigationManager,
          fileManager: !!this.genomeStudio.fileManager,
          trackRenderer: !!this.genomeStudio.trackRenderer,
          sequenceUtils: !!this.genomeStudio.sequenceUtils,
        }
        : {},
    };
  }
}

module.exports = InternalMCPServer;
