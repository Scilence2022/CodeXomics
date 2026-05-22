/**
 * NavigationAgent - Handles browser navigation and state management functions
 * High priority agent for immediate user interface responses
 */
class NavigationAgent extends AgentBase {
  constructor(multiAgentSystem) {
    const capabilities = [
      {
        functionName: 'navigate_to_position',
        description: 'Navigate to genomic coordinates',
        priority: 'high',
        estimatedTime: 100,
        validateParameters: (params) => {
          if (!params.chromosome) throw new Error('chromosome parameter required');
          if (!params.start && !params.position) throw new Error('start or position parameter required');
        },
      },
      {
        functionName: 'get_current_state',
        description: 'Get current browser state',
        priority: 'high',
        estimatedTime: 50,
        validateParameters: () => {}, // No parameters required
      },
      {
        functionName: 'get_current_region',
        description: 'Get current viewing region',
        priority: 'high',
        estimatedTime: 50,
        validateParameters: () => {},
      },
      {
        functionName: 'jump_to_gene',
        description: 'Navigate to specific gene',
        priority: 'high',
        estimatedTime: 200,
        validateParameters: (params) => {
          if (!params.geneName) throw new Error('geneName parameter required');
        },
      },
      {
        functionName: 'scroll_left',
        description: 'Scroll view left',
        priority: 'high',
        estimatedTime: 50,
        validateParameters: (params) => {
          if (!params.bp) throw new Error('bp parameter required');
        },
      },
      {
        functionName: 'scroll_right',
        description: 'Scroll view right',
        priority: 'high',
        estimatedTime: 50,
        validateParameters: (params) => {
          if (!params.bp) throw new Error('bp parameter required');
        },
      },
      {
        functionName: 'zoom_in',
        description: 'Zoom in view (default 2x, max 10x)',
        priority: 'high',
        estimatedTime: 50,
        validateParameters: (params) => {
          // factor is optional, defaults to 2
        },
      },
      {
        functionName: 'zoom_out',
        description: 'Zoom out view (default 2x, max 10x)',
        priority: 'high',
        estimatedTime: 50,
        validateParameters: (params) => {
          // factor is optional, defaults to 2
        },
      },
      {
        functionName: 'zoom_to_gene',
        description: 'Zoom to gene region',
        priority: 'high',
        estimatedTime: 150,
        validateParameters: (params) => {
          if (!params.geneName) throw new Error('geneName parameter required');
        },
      },
      {
        functionName: 'toggle_track',
        description: 'Toggle track visibility',
        priority: 'high',
        estimatedTime: 100,
        validateParameters: (params) => {
          const track = params.trackName !== undefined ? params.trackName : params.track_name;
          if (track === undefined) throw new Error('trackName or track_name parameter required');
          if (params.visible !== undefined) {
            if (typeof params.visible === 'string') {
              const normalized = params.visible.trim().toLowerCase();
              const validVisibles = [
                'true', 'show', 'shown', 'visible', 'on', 'enable', 'enabled', 'display',
                'false', 'hide', 'hidden', 'off', 'disable', 'disabled',
              ];
              if (!validVisibles.includes(normalized)) {
                throw new Error('visible parameter must be boolean');
              }
            } else if (typeof params.visible !== 'boolean') {
              throw new Error('visible parameter must be boolean');
            }
          }
          const action = params.action || params.actionType || params.action_type || params.state || params.visibility;
          if (action !== undefined) {
            const normalizedAction = String(action).trim().toLowerCase();
            const validActions = [
              'show', 'shown', 'display', 'visible', 'on', 'enable', 'enabled', 'true',
              'hide', 'hidden', 'off', 'disable', 'disabled', 'false',
              'toggle', 'switch',
            ];
            if (!validActions.includes(normalizedAction)) {
              throw new Error('action parameter must be "show", "hide" or "toggle"');
            }
          }
        },
      },
      {
        functionName: 'get_track_status',
        description: 'Get track status information',
        priority: 'high',
        estimatedTime: 50,
        validateParameters: () => {},
      },
      {
        functionName: 'bookmark_position',
        description: 'Save current position as bookmark',
        priority: 'medium',
        estimatedTime: 100,
        validateParameters: (params) => {
          if (!params.name) throw new Error('name parameter required');
        },
      },
      {
        functionName: 'get_bookmarks',
        description: 'Get saved bookmarks',
        priority: 'medium',
        estimatedTime: 50,
        validateParameters: () => {},
      },
      {
        functionName: 'save_view_state',
        description: 'Save current view configuration',
        priority: 'medium',
        estimatedTime: 100,
        validateParameters: (params) => {
          if (!params.name) throw new Error('name parameter required');
        },
      },
      {
        functionName: 'navigate_to',
        description: 'Navigate to specified location',
        priority: 'high',
        estimatedTime: 100,
        validateParameters: (params) => {
          if (!params.location) throw new Error('location parameter required');
        },
      },
      // Additional builtInToolsMap-aligned navigation tools
      {
        functionName: 'search_features',
        description: 'Search for features in the genome',
        priority: 'high',
        estimatedTime: 200,
        validateParameters: (params) => {
          if (!params.query) throw new Error('query parameter required');
        },
      },
      {
        functionName: 'find_gene_by_name',
        description: 'Search for a gene by name',
        priority: 'high',
        estimatedTime: 200,
        validateParameters: (params) => {
          if (!params.geneName) throw new Error('geneName parameter required');
        },
      },
      {
        functionName: 'find_gene',
        description: 'Search for a gene by name (legacy alias for find_gene_by_name)',
        priority: 'high',
        estimatedTime: 200,
        validateParameters: (params) => {
          if (!params.geneName) throw new Error('geneName parameter required');
        },
      },
      {
        functionName: 'pan_left',
        description: 'Pan the view left',
        priority: 'high',
        estimatedTime: 50,
        validateParameters: (params) => {
          // bp is optional
        },
      },
      {
        functionName: 'pan_right',
        description: 'Pan the view right',
        priority: 'high',
        estimatedTime: 50,
        validateParameters: (params) => {
          // bp is optional
        },
      },
      {
        functionName: 'switch_to_tab',
        description: 'Switch to a specific tab',
        priority: 'high',
        estimatedTime: 50,
        validateParameters: (params) => {
          if (!params.tabName) throw new Error('tabName parameter required');
        },
      },
      {
        functionName: 'open_new_tab',
        description: 'Open a new browser tab',
        priority: 'medium',
        estimatedTime: 100,
        validateParameters: () => {},
      },
      {
        functionName: 'close_tab',
        description: 'Close a browser tab',
        priority: 'medium',
        estimatedTime: 50,
        validateParameters: () => {},
      },
      {
        functionName: 'get_chromosome_list',
        description: 'Get list of chromosomes',
        priority: 'high',
        estimatedTime: 50,
        validateParameters: () => {},
      },
      {
        functionName: 'select_gene',
        description: 'Select a gene in the visual browser',
        priority: 'high',
        estimatedTime: 100,
        validateParameters: (params) => {
          if (!params.geneName && !params.gene_name) throw new Error('geneName or gene_name parameter required');
        },
      },
      {
        functionName: 'select_sequence_region',
        description: 'Select a sequence region in the visual browser',
        priority: 'high',
        estimatedTime: 100,
        validateParameters: (params) => {
          if (!params.chromosome) throw new Error('chromosome parameter required');
          if (params.start === undefined) throw new Error('start parameter required');
          if (params.end === undefined) throw new Error('end parameter required');
        },
      },
    ];

    super(multiAgentSystem, 'NavigationAgent', capabilities);

    // Navigation-specific state
    this.navigationHistory = [];
    this.currentPosition = null;
    this.viewState = null;

    // Performance optimization
    this.positionCache = new Map();
    this.stateCache = new Map();

    console.log('🧭 NavigationAgent created');
  }

  /**
   * Perform function execution with ChatManager delegation
   */
  async performExecution(functionName, parameters, context) {
    const chatManager = this.multiAgentSystem.chatManager;

    // Try ChatManager first (authoritative execution path)
    if (chatManager && typeof chatManager.executeToolByName === 'function') {
      try {
        const result = await chatManager.executeToolByName(functionName, parameters, {bypassAgent: true});
        return result;
      } catch (error) {
        console.warn(`NavigationAgent: ChatManager execution failed for ${functionName}, falling back to local implementation`);
      }
    }

    // Fall back to local implementation
    return await this._performLocalExecution(functionName, parameters, context);
  }

  /**
   * Local execution fallback
   */
  async _performLocalExecution(functionName, parameters, context) {
    const app = this.multiAgentSystem.app;

    try {
      switch (functionName) {
        case 'navigate_to_position':
          return await this.executeNavigateToPosition(parameters, app);

        case 'get_current_state':
          return await this.executeGetCurrentState(app);

        case 'get_current_region':
          return await this.executeGetCurrentRegion(app);

        case 'jump_to_gene':
        case 'find_gene_by_name':
        case 'find_gene': // legacy alias
          return await this.executeJumpToGene(parameters, app);

        case 'scroll_left':
          return await this.executeScrollLeft(parameters, app);

        case 'scroll_right':
          return await this.executeScrollRight(parameters, app);

        case 'pan_left':
          return await this.executeScrollLeft(parameters, app);

        case 'pan_right':
          return await this.executeScrollRight(parameters, app);

        case 'zoom_in':
          return await this.executeZoomIn(parameters, app);

        case 'zoom_out':
          return await this.executeZoomOut(parameters, app);

        case 'zoom_to_gene':
          return await this.executeZoomToGene(parameters, app);

        case 'toggle_track':
          return await this.executeToggleTrack(parameters, app);

        case 'get_track_status':
          return await this.executeGetTrackStatus(app);

        case 'bookmark_position':
          return await this.executeBookmarkPosition(parameters, app);

        case 'get_bookmarks':
          return await this.executeGetBookmarks(app);

        case 'save_view_state':
          return await this.executeSaveViewState(parameters, app);

        case 'navigate_to':
          return await this.executeNavigateTo(parameters, app);

        case 'search_features':
          return await this.executeSearchFeatures(parameters, app);

        case 'switch_to_tab':
        case 'open_new_tab':
        case 'close_tab':
        case 'get_chromosome_list':
        case 'select_gene':
        case 'select_sequence_region':
          // These tools are authoritatively implemented on ChatManager.
          // Delegate directly to ChatManager methods.
          try {
            const chatMgr = this.multiAgentSystem.chatManager;
            const camelCaseName = functionName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            if (chatMgr && typeof chatMgr[camelCaseName] === 'function') {
              return await chatMgr[camelCaseName](parameters);
            }
          } catch (err) {
            console.warn(`NavigationAgent: ChatManager delegation failed for ${functionName}:`, err.message);
          }
          return {success: false, error: `Function ${functionName} requires ChatManager execution`};

        default:
          throw new Error(`Navigation function not implemented: ${functionName}`);
      }
    } catch (error) {
      console.error(`❌ NavigationAgent execution failed for ${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Execute navigate to position
   */
  async executeNavigateToPosition(parameters, app) {
    const {chromosome, start, end, position} = parameters;

    const cacheKey = `nav_${chromosome}_${start || position}_${end || ''}`;
    const cached = this.positionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 30000) {
      console.log(' Navigation cache hit');
      return cached.result;
    }

    let result;
    try {
      const nm = app.navigationManager || (app.genomeBrowser && app.genomeBrowser.navigationManager);
      if (!nm) throw new Error('NavigationManager not available');

      if (position !== undefined && (start === undefined || end === undefined)) {
        const defaultRange = 2000;
        const s = Math.max(1, position - Math.floor(defaultRange / 2));
        const e = position + Math.floor(defaultRange / 2);
        result = nm.navigateToPosition(chromosome, s, e);
      } else {
        result = nm.navigateToPosition(chromosome, start, end);
      }
    } catch (error) {
      console.warn(`NavigationAgent: navigation failed`, error);
      result = {success: true, chromosome, start: start || position, end, position};
    }

    this.navigationHistory.push({
      timestamp: Date.now(),
      chromosome,
      start: start || position,
      end,
      type: 'position',
    });

    if (this.navigationHistory.length > 100) {
      this.navigationHistory = this.navigationHistory.slice(-100);
    }

    this.positionCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    this.currentPosition = {chromosome, start: start || position, end};

    return result;
  }

  /**
   * Execute get current state
   */
  async executeGetCurrentState(app) {
    // Check cache first
    const cached = this.stateCache.get('current_state');
    if (cached && Date.now() - cached.timestamp < 5000) {
      // 5 second cache
      return cached.result;
    }

    let result;
    try {
      result = await app.genomeBrowser.getCurrentState();
    } catch (error) {
      console.warn(`NavigationAgent: genomeBrowser.getCurrentState failed`, error);
      result = {chromosome: 'unknown', start: 0, end: 0};
    }

    // Cache result
    this.stateCache.set('current_state', {
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Execute get current region
   */
  async executeGetCurrentRegion(app) {
    const state = await this.executeGetCurrentState(app);
    return {
      chromosome: state.chromosome,
      start: state.start,
      end: state.end,
      length: state.end - state.start,
    };
  }

  /**
   * Execute jump to gene
   */
  async executeJumpToGene(parameters, app) {
    const {geneName} = parameters;

    const cacheKey = `gene_${geneName}`;
    const cached = this.positionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.result;
    }

    let result;
    try {
      const nm = app.navigationManager || (app.genomeBrowser && app.genomeBrowser.navigationManager);
      if (!nm) throw new Error('NavigationManager not available');
      result = nm.jumpToGene(geneName);
    } catch (error) {
      console.warn(`NavigationAgent: jumpToGene failed`, error);
      result = {success: false, error: error.message, geneName};
    }

    this.positionCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    this.navigationHistory.push({
      timestamp: Date.now(),
      geneName,
      type: 'gene',
    });

    return result;
  }

  /**
   * Execute scroll left
   */
  async executeScrollLeft(parameters, app) {
    const {bp} = parameters;
    try {
      const nm = app.navigationManager || (app.genomeBrowser && app.genomeBrowser.navigationManager);
      if (!nm) throw new Error('NavigationManager not available');
      return nm.scrollLeft(bp);
    } catch (error) {
      console.warn(`NavigationAgent: scrollLeft failed`, error);
      return {success: false, error: error.message};
    }
  }

  /**
   * Execute scroll right
   */
  async executeScrollRight(parameters, app) {
    const {bp} = parameters;
    try {
      const nm = app.navigationManager || (app.genomeBrowser && app.genomeBrowser.navigationManager);
      if (!nm) throw new Error('NavigationManager not available');
      return nm.scrollRight(bp);
    } catch (error) {
      console.warn(`NavigationAgent: scrollRight failed`, error);
      return {success: false, error: error.message};
    }
  }

  /**
   * Execute zoom in
   */
  async executeZoomIn(parameters, app) {
    let {factor} = parameters;
    if (typeof factor === 'string') {
      const normalized = factor.trim().toLowerCase().replace(/×/g, 'x');
      const stripped = normalized.endsWith('x') ? normalized.slice(0, -1) : normalized;
      const numeric = parseFloat(stripped);
      factor = isFinite(numeric) && numeric > 0 ? numeric : 2;
    }
    try {
      const nm = app.navigationManager || (app.genomeBrowser && app.genomeBrowser.navigationManager);
      if (!nm) throw new Error('NavigationManager not available');
      return nm.zoomIn(factor);
    } catch (error) {
      console.warn(`NavigationAgent: zoomIn failed`, error);
      return {success: false, error: error.message};
    }
  }

  /**
   * Execute zoom out
   */
  async executeZoomOut(parameters, app) {
    let {factor} = parameters;
    if (typeof factor === 'string') {
      const normalized = factor.trim().toLowerCase().replace(/×/g, 'x');
      const stripped = normalized.endsWith('x') ? normalized.slice(0, -1) : normalized;
      const numeric = parseFloat(stripped);
      factor = isFinite(numeric) && numeric > 0 ? numeric : 2;
    }
    try {
      const nm = app.navigationManager || (app.genomeBrowser && app.genomeBrowser.navigationManager);
      if (!nm) throw new Error('NavigationManager not available');
      return nm.zoomOut(factor);
    } catch (error) {
      console.warn(`NavigationAgent: zoomOut failed`, error);
      return {success: false, error: error.message};
    }
  }

  /**
   * Execute zoom to gene
   */
  async executeZoomToGene(parameters, app) {
    const {geneName} = parameters;

    // First jump to gene, then zoom
    const jumpResult = await this.executeJumpToGene(parameters, app);
    let zoomResult;
    try {
      zoomResult = await app.genomeBrowser.zoomToGene(geneName);
    } catch (error) {
      console.warn(`NavigationAgent: genomeBrowser.zoomToGene failed`, error);
      zoomResult = {success: false, error: error.message};
    }

    return {
      jump: jumpResult,
      zoom: zoomResult,
    };
  }

  /**
   * Execute toggle track
   */
  async executeToggleTrack(parameters, app) {
    const trackName = parameters.trackName || parameters.track_name;
    let visible = parameters.visible;
    const action = parameters.action || parameters.actionType || parameters.action_type || parameters.state || parameters.visibility;

    if (typeof visible === 'string') {
      const normalizedVisible = visible.trim().toLowerCase();
      if (['true', 'show', 'shown', 'visible', 'on', 'enable', 'enabled', 'display'].includes(normalizedVisible)) {
        visible = true;
      } else if (['false', 'hide', 'hidden', 'off', 'disable', 'disabled'].includes(normalizedVisible)) {
        visible = false;
      }
    }

    if (visible === undefined && action) {
      const normalizedAction = String(action).trim().toLowerCase();
      if (['show', 'shown', 'display', 'visible', 'on', 'enable', 'enabled', 'true'].includes(normalizedAction)) {
        visible = true;
      } else if (['hide', 'hidden', 'off', 'disable', 'disabled', 'false'].includes(normalizedAction)) {
        visible = false;
      } else if (['toggle', 'switch'].includes(normalizedAction)) {
        visible = undefined;
      }
    }

    try {
      return await app.genomeBrowser.toggleTrack(trackName, visible);
    } catch (error) {
      console.warn(`NavigationAgent: genomeBrowser.toggleTrack failed`, error);
      return {success: false, error: error.message};
    }
  }

  /**
   * Execute get track status
   */
  async executeGetTrackStatus(app) {
    try {
      return await app.genomeBrowser.getTrackStatus();
    } catch (error) {
      console.warn(`NavigationAgent: genomeBrowser.getTrackStatus failed`, error);
      return {success: false, error: error.message};
    }
  }

  /**
   * Execute bookmark position
   */
  async executeBookmarkPosition(parameters, app) {
    const {name} = parameters;
    const currentState = await this.executeGetCurrentState(app);

    const bookmark = {
      name,
      timestamp: Date.now(),
      position: {
        chromosome: currentState.chromosome,
        start: currentState.start,
        end: currentState.end,
      },
    };

    // Store bookmark (could be in localStorage or app state)
    const bookmarks = this.getStoredBookmarks();
    bookmarks.push(bookmark);
    this.setStoredBookmarks(bookmarks);

    return {
      success: true,
      bookmark,
    };
  }

  /**
   * Execute get bookmarks
   */
  async executeGetBookmarks(app) {
    return this.getStoredBookmarks();
  }

  /**
   * Execute save view state
   */
  async executeSaveViewState(parameters, app) {
    const chatManager = this.multiAgentSystem?.chatManager;
    if (chatManager && typeof chatManager.saveViewState === 'function') {
      try {
        return await chatManager.saveViewState(parameters);
      } catch (error) {
        console.warn('NavigationAgent: ChatManager.saveViewState failed, falling back to local implementation', error);
      }
    }

    const {name, description = ''} = parameters;
    const currentState = await this.executeGetCurrentState(app);

    const viewState = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      name,
      description,
      chromosome: currentState.chromosome,
      position: {start: currentState.start, end: currentState.end},
      visibleTracks: [],
      created: new Date().toISOString(),
    };

    const viewStates = this.getStoredViewStates();
    viewStates.push(viewState);
    this.setStoredViewStates(viewStates);

    return {
      success: true,
      viewState,
      message: `Saved view state "${name}"`,
    };
  }

  /**
   * Execute navigate to
   */
  async executeNavigateTo(parameters, app) {
    const {location} = parameters;

    // Parse location format
    if (location.includes(':')) {
      const [chromosome, position] = location.split(':');
      return await this.executeNavigateToPosition(
          {
            chromosome,
            position: parseInt(position),
          },
          app,
      );
    } else {
      // Assume it's a gene name
      return await this.executeJumpToGene(
          {
            geneName: location,
          },
          app,
      );
    }
  }

  /**
   * Execute search features
   */
  async executeSearchFeatures(parameters, app) {
    const {query} = parameters;
    try {
      if (app.genomeBrowser && typeof app.genomeBrowser.searchFeatures === 'function') {
        return await app.genomeBrowser.searchFeatures(query);
      }
    } catch (error) {
      console.warn(`NavigationAgent: genomeBrowser.searchFeatures failed`, error);
    }
    return {success: false, error: 'search_features requires ChatManager or genomeBrowser implementation'};
  }

  /**
   * Get stored bookmarks from localStorage
   */
  getStoredBookmarks() {
    try {
      const stored = localStorage.getItem('genome_browser_bookmarks');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load bookmarks:', error);
      return [];
    }
  }

  /**
   * Set stored bookmarks to localStorage
   */
  setStoredBookmarks(bookmarks) {
    try {
      localStorage.setItem('genome_browser_bookmarks', JSON.stringify(bookmarks));
    } catch (error) {
      console.warn('Failed to save bookmarks:', error);
    }
  }

  /**
   * Get stored view states from localStorage
   */
  getStoredViewStates() {
    try {
      const stored = localStorage.getItem('genome_browser_view_states');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load view states:', error);
      return [];
    }
  }

  /**
   * Set stored view states to localStorage
   */
  setStoredViewStates(viewStates) {
    try {
      localStorage.setItem('genome_browser_view_states', JSON.stringify(viewStates));
    } catch (error) {
      console.warn('Failed to save view states:', error);
    }
  }

  /**
   * Get navigation history
   */
  getNavigationHistory() {
    return this.navigationHistory;
  }

  /**
   * Get current position
   */
  getCurrentPosition() {
    return this.currentPosition;
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.positionCache.clear();
    this.stateCache.clear();
    console.log('🧹 NavigationAgent caches cleared');
  }

  /**
   * Override resource requirements for navigation functions
   */
  checkResourceAvailability(functionName, parameters) {
    // Navigation functions are lightweight
    const requirements = {
      cpu: 5,
      memory: 20,
      network: 0,
      cache: 5,
    };

    // Check against current usage
    const available = this.multiAgentSystem.resourceManager;
    const currentUsage = this.resourceUsage;

    // Add null checks for resource manager properties
    if (!available || !available.cpu || !available.memory || !available.network || !available.cache) {
      console.warn('ResourceManager not properly initialized, allowing execution');
      return {available: true, reason: 'Resource checking disabled'};
    }

    if (currentUsage.cpu + requirements.cpu > available.cpu.available) {
      return {available: false, reason: 'Insufficient CPU'};
    }

    if (currentUsage.memory + requirements.memory > available.memory.available) {
      return {available: false, reason: 'Insufficient memory'};
    }

    return {available: true, requirements};
  }

  /**
   * Override resource release for navigation functions
   */
  releaseResources(functionName) {
    // Navigation functions use minimal resources
    const release = {
      cpu: 5,
      memory: 20,
      network: 0,
      cache: 5,
    };

    // Release resources
    for (const [resourceType, amount] of Object.entries(release)) {
      this.resourceUsage[resourceType] = Math.max(0, this.resourceUsage[resourceType] - amount);
    }

    // Notify system of resource availability
    this.multiAgentSystem.eventBus.dispatchEvent(
        new CustomEvent('resource-available', {
          detail: {resourceType: 'mixed', amount: release},
        }),
    );
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NavigationAgent;
}
