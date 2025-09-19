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
                }
            },
            {
                functionName: 'get_current_state',
                description: 'Get current browser state',
                priority: 'high',
                estimatedTime: 50,
                validateParameters: () => {} // No parameters required
            },
            {
                functionName: 'get_current_region',
                description: 'Get current viewing region',
                priority: 'high',
                estimatedTime: 50,
                validateParameters: () => {}
            },
            {
                functionName: 'jump_to_gene',
                description: 'Navigate to specific gene',
                priority: 'high',
                estimatedTime: 200,
                validateParameters: (params) => {
                    if (!params.geneName) throw new Error('geneName parameter required');
                }
            },
            {
                functionName: 'scroll_left',
                description: 'Scroll view left',
                priority: 'high',
                estimatedTime: 50,
                validateParameters: (params) => {
                    if (!params.bp) throw new Error('bp parameter required');
                }
            },
            {
                functionName: 'scroll_right',
                description: 'Scroll view right',
                priority: 'high',
                estimatedTime: 50,
                validateParameters: (params) => {
                    if (!params.bp) throw new Error('bp parameter required');
                }
            },
            {
                functionName: 'zoom_in',
                description: 'Zoom in view (default 2x, max 10x)',
                priority: 'high',
                estimatedTime: 50,
                validateParameters: (params) => {
                    // factor is optional, defaults to 2
                }
            },
            {
                functionName: 'zoom_out',
                description: 'Zoom out view (default 2x, max 10x)',
                priority: 'high',
                estimatedTime: 50,
                validateParameters: (params) => {
                    // factor is optional, defaults to 2
                }
            },
            {
                functionName: 'zoom_to_gene',
                description: 'Zoom to gene region',
                priority: 'high',
                estimatedTime: 150,
                validateParameters: (params) => {
                    if (!params.geneName) throw new Error('geneName parameter required');
                }
            },
            {
                functionName: 'toggle_track',
                description: 'Toggle track visibility',
                priority: 'high',
                estimatedTime: 100,
                validateParameters: (params) => {
                    if (!params.trackName) throw new Error('trackName parameter required');
                    if (typeof params.visible !== 'boolean') throw new Error('visible parameter must be boolean');
                }
            },
            {
                functionName: 'get_track_status',
                description: 'Get track status information',
                priority: 'high',
                estimatedTime: 50,
                validateParameters: () => {}
            },
            {
                functionName: 'bookmark_position',
                description: 'Save current position as bookmark',
                priority: 'medium',
                estimatedTime: 100,
                validateParameters: (params) => {
                    if (!params.name) throw new Error('name parameter required');
                }
            },
            {
                functionName: 'get_bookmarks',
                description: 'Get saved bookmarks',
                priority: 'medium',
                estimatedTime: 50,
                validateParameters: () => {}
            },
            {
                functionName: 'save_view_state',
                description: 'Save current view configuration',
                priority: 'medium',
                estimatedTime: 100,
                validateParameters: (params) => {
                    if (!params.name) throw new Error('name parameter required');
                }
            },
            {
                functionName: 'navigate_to',
                description: 'Navigate to specified location',
                priority: 'high',
                estimatedTime: 100,
                validateParameters: (params) => {
                    if (!params.location) throw new Error('location parameter required');
                }
            }
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
     * Perform navigation function execution
     */
    async performExecution(functionName, parameters, context) {
        const chatManager = this.multiAgentSystem.chatManager;
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
                    return await this.executeJumpToGene(parameters, app);
                    
                case 'scroll_left':
                    return await this.executeScrollLeft(parameters, app);
                    
                case 'scroll_right':
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
        const { chromosome, start, end, position } = parameters;
        
        // Check cache first
        const cacheKey = `nav_${chromosome}_${start || position}_${end || ''}`;
        const cached = this.positionCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
            console.log('⚡ Navigation cache hit');
            return cached.result;
        }
        
        // Execute navigation
        let result;
        if (position) {
            result = await app.genomeBrowser.navigateToPosition(chromosome, position);
        } else {
            result = await app.genomeBrowser.navigateToRegion(chromosome, start, end);
        }
        
        // Update navigation history
        this.navigationHistory.push({
            timestamp: Date.now(),
            chromosome,
            start: start || position,
            end,
            type: 'position'
        });
        
        // Keep only recent history
        if (this.navigationHistory.length > 100) {
            this.navigationHistory = this.navigationHistory.slice(-100);
        }
        
        // Cache result
        this.positionCache.set(cacheKey, {
            result,
            timestamp: Date.now()
        });
        
        // Update current position
        this.currentPosition = { chromosome, start: start || position, end };
        
        return result;
    }
    
    /**
     * Execute get current state
     */
    async executeGetCurrentState(app) {
        // Check cache first
        const cached = this.stateCache.get('current_state');
        if (cached && Date.now() - cached.timestamp < 5000) { // 5 second cache
            return cached.result;
        }
        
        const result = await app.genomeBrowser.getCurrentState();
        
        // Cache result
        this.stateCache.set('current_state', {
            result,
            timestamp: Date.now()
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
            length: state.end - state.start
        };
    }
    
    /**
     * Execute jump to gene
     */
    async executeJumpToGene(parameters, app) {
        const { geneName } = parameters;
        
        // Check cache first
        const cacheKey = `gene_${geneName}`;
        const cached = this.positionCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
            return cached.result;
        }
        
        const result = await app.genomeBrowser.jumpToGene(geneName);
        
        // Cache result
        this.positionCache.set(cacheKey, {
            result,
            timestamp: Date.now()
        });
        
        // Update navigation history
        this.navigationHistory.push({
            timestamp: Date.now(),
            geneName,
            type: 'gene'
        });
        
        return result;
    }
    
    /**
     * Execute scroll left
     */
    async executeScrollLeft(parameters, app) {
        const { bp } = parameters;
        return await app.genomeBrowser.scrollLeft(bp);
    }
    
    /**
     * Execute scroll right
     */
    async executeScrollRight(parameters, app) {
        const { bp } = parameters;
        return await app.genomeBrowser.scrollRight(bp);
    }
    
    /**
     * Execute zoom in
     */
    async executeZoomIn(parameters, app) {
        // Support magnification strings like "1.5X", "2x", or numeric values
        let { factor } = parameters;
        if (typeof factor === 'string') {
            const normalized = factor.trim().toLowerCase().replace(/×/g, 'x');
            const stripped = normalized.endsWith('x') ? normalized.slice(0, -1) : normalized;
            const numeric = parseFloat(stripped);
            factor = (isFinite(numeric) && numeric > 0) ? numeric : 2;
        }
        return await app.genomeBrowser.zoomIn(factor);
    }
    
    /**
     * Execute zoom out
     */
    async executeZoomOut(parameters, app) {
        // Support magnification strings like "1.5X", "2x", or numeric values
        let { factor } = parameters;
        if (typeof factor === 'string') {
            const normalized = factor.trim().toLowerCase().replace(/×/g, 'x');
            const stripped = normalized.endsWith('x') ? normalized.slice(0, -1) : normalized;
            const numeric = parseFloat(stripped);
            factor = (isFinite(numeric) && numeric > 0) ? numeric : 2;
        }
        return await app.genomeBrowser.zoomOut(factor);
    }
    
    /**
     * Execute zoom to gene
     */
    async executeZoomToGene(parameters, app) {
        const { geneName } = parameters;
        
        // First jump to gene, then zoom
        const jumpResult = await this.executeJumpToGene(parameters, app);
        const zoomResult = await app.genomeBrowser.zoomToGene(geneName);
        
        return {
            jump: jumpResult,
            zoom: zoomResult
        };
    }
    
    /**
     * Execute toggle track
     */
    async executeToggleTrack(parameters, app) {
        const { trackName, visible } = parameters;
        return await app.genomeBrowser.toggleTrack(trackName, visible);
    }
    
    /**
     * Execute get track status
     */
    async executeGetTrackStatus(app) {
        return await app.genomeBrowser.getTrackStatus();
    }
    
    /**
     * Execute bookmark position
     */
    async executeBookmarkPosition(parameters, app) {
        const { name } = parameters;
        const currentState = await this.executeGetCurrentState(app);
        
        const bookmark = {
            name,
            timestamp: Date.now(),
            position: {
                chromosome: currentState.chromosome,
                start: currentState.start,
                end: currentState.end
            }
        };
        
        // Store bookmark (could be in localStorage or app state)
        const bookmarks = this.getStoredBookmarks();
        bookmarks.push(bookmark);
        this.setStoredBookmarks(bookmarks);
        
        return {
            success: true,
            bookmark
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
        const { name } = parameters;
        const currentState = await this.executeGetCurrentState(app);
        
        const viewState = {
            name,
            timestamp: Date.now(),
            state: currentState
        };
        
        // Store view state
        const viewStates = this.getStoredViewStates();
        viewStates.push(viewState);
        this.setStoredViewStates(viewStates);
        
        return {
            success: true,
            viewState
        };
    }
    
    /**
     * Execute navigate to
     */
    async executeNavigateTo(parameters, app) {
        const { location } = parameters;
        
        // Parse location format
        if (location.includes(':')) {
            const [chromosome, position] = location.split(':');
            return await this.executeNavigateToPosition({
                chromosome,
                position: parseInt(position)
            }, app);
        } else {
            // Assume it's a gene name
            return await this.executeJumpToGene({
                geneName: location
            }, app);
        }
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
            cache: 5
        };
        
        // Check against current usage
        const available = this.multiAgentSystem.resourceManager;
        const currentUsage = this.resourceUsage;
        
        // Add null checks for resource manager properties
        if (!available || !available.cpu || !available.memory || !available.network || !available.cache) {
            console.warn('ResourceManager not properly initialized, allowing execution');
            return { available: true, reason: 'Resource checking disabled' };
        }
        
        if (currentUsage.cpu + requirements.cpu > available.cpu.available) {
            return { available: false, reason: 'Insufficient CPU' };
        }
        
        if (currentUsage.memory + requirements.memory > available.memory.available) {
            return { available: false, reason: 'Insufficient memory' };
        }
        
        return { available: true, requirements };
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
            cache: 5
        };
        
        // Release resources
        for (const [resourceType, amount] of Object.entries(release)) {
            this.resourceUsage[resourceType] = Math.max(0, this.resourceUsage[resourceType] - amount);
        }
        
        // Notify system of resource availability
        this.multiAgentSystem.eventBus.dispatchEvent(new CustomEvent('resource-available', {
            detail: { resourceType: 'mixed', amount: release }
        }));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationAgent;
} 