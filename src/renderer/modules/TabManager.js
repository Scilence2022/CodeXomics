/**
 * TabManager - Chrome-style tab management for multi-genome analysis
 * Provides tab creation, switching, closing, and state isolation
 */
class TabManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.tabs = new Map(); // Store tab instances
        this.activeTabId = null;
        this.nextTabId = 1;
        
        // Initialize UI elements
        this.tabContainer = document.getElementById('tabContainer');
        this.newTabButton = document.getElementById('newTabButton');
        this.tabSettingsButton = document.getElementById('tabSettingsButton');
        
        // Tab state isolation
        this.tabStates = new Map(); // Store individual tab states
        
        // Tab rendering cache system
        this.tabCache = new Map(); // Store cached DOM content for each tab
        this.cacheSettings = {
            enabled: true, // Default to enabled
            maxCacheSize: 10, // Maximum number of cached tabs
            cacheTimeout: 30 * 60 * 1000 // 30 minutes cache timeout
        };
        
        // Configuration manager integration for persistent storage
        this.configManager = this.genomeBrowser.configManager;
        this.isPersistenceEnabled = false;
        
        this.initializeEventListeners();
        this.initializeTabSettings();
        this.initializePersistence();
        
        // Force visibility of position indicators after a short delay
        setTimeout(() => {
            this.forcePositionIndicatorVisibility();
        }, 1000);
    }
    
    /**
     * Initialize event listeners for tab management
     */
    initializeEventListeners() {
        // New tab button
        this.newTabButton.addEventListener('click', () => {
            this.createNewTab();
        });
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 't':
                        e.preventDefault();
                        this.createNewTab();
                        break;
                    case 'w':
                        if (this.tabs.size > 1) {
                            e.preventDefault();
                            this.closeTab(this.activeTabId);
                        }
                        break;
                    case 'Tab':
                        e.preventDefault();
                        this.switchToNextTab(e.shiftKey);
                        break;
                }
            }
            
            // Number keys for direct tab switching
            if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const tabIndex = parseInt(e.key) - 1;
                const tabIds = Array.from(this.tabs.keys());
                if (tabIds[tabIndex]) {
                    this.switchToTab(tabIds[tabIndex]);
                }
            }
        });
    }
    
    /**
     * Initialize persistence system with ConfigManager
     */
    async initializePersistence() {
        if (!this.configManager) {
            console.warn('ConfigManager not available, tab persistence disabled');
            return;
        }
        
        try {
            // Wait for ConfigManager to be ready
            await this.configManager.waitForInitialization();
            
            // Check if persistence is enabled
            const tabSettings = await this.configManager.getTabSettings();
            this.isPersistenceEnabled = tabSettings.persistTabStates !== false;
            
            if (this.isPersistenceEnabled) {
                console.log('Tab persistence enabled');
                
                // Try to restore tabs from last session
                if (tabSettings.restoreTabsOnStartup) {
                    await this.restoreSessionTabs();
                } else {
                    this.createInitialTab();
                }
            } else {
                console.log('Tab persistence disabled');
                this.createInitialTab();
            }
        } catch (error) {
            console.error('Failed to initialize tab persistence:', error);
            this.createInitialTab();
        }
    }
    
    /**
     * Restore tabs from last session
     */
    async restoreSessionTabs() {
        try {
            const lastSessionTabs = await this.configManager.getLastSessionTabs();
            const tabStates = await this.configManager.getTabStates();
            
            if (lastSessionTabs.length > 0) {
                let restoredCount = 0;
                
                for (const tabId of lastSessionTabs) {
                    const savedState = tabStates[tabId];
                    if (savedState) {
                        await this.restoreTabFromState(tabId, savedState);
                        restoredCount++;
                    }
                }
                
                if (restoredCount > 0) {
                    // Restore active tab
                    const activeTabId = await this.configManager.getActiveTab();
                    if (activeTabId && this.tabs.has(activeTabId)) {
                        this.switchToTab(activeTabId);
                    } else {
                        // Switch to first tab if active tab not found
                        const firstTab = Array.from(this.tabs.keys())[0];
                        if (firstTab) {
                            this.switchToTab(firstTab);
                        }
                    }
                    
                    console.log(`Restored ${restoredCount} tabs from last session`);
                    return;
                }
            }
            
            // If no tabs were restored, create initial tab
            this.createInitialTab();
        } catch (error) {
            console.error('Error restoring session tabs:', error);
            this.createInitialTab();
        }
    }
    
    /**
     * Restore a specific tab from saved state
     */
    async restoreTabFromState(tabId, savedState) {
        try {
            // Create tab element without navigating to it
            const tabElement = this.createTabElement(tabId, savedState.title || 'Restored Tab');
            this.tabs.set(tabId, tabElement);
            
            // Store the saved state
            this.tabStates.set(tabId, savedState);
            
            // Update nextTabId to avoid conflicts
            const tabNumber = parseInt(tabId.replace('tab-', ''));
            if (tabNumber >= this.nextTabId) {
                this.nextTabId = tabNumber + 1;
            }
            
            console.log(`Tab ${tabId} restored: ${savedState.title}`);
        } catch (error) {
            console.error(`Error restoring tab ${tabId}:`, error);
        }
    }
    
    /**
     * Create initial tab on startup
     */
    createInitialTab() {
        this.createNewTab('Welcome');
    }
    
    /**
     * Create a new tab for the same genome at current or specified position
     */
    createNewTab(title = null, specificPosition = null) {
        const tabId = `tab-${this.nextTabId++}`;
        
        // Auto-generate title based on current position if not provided
        if (!title) {
            if (this.genomeBrowser.currentChromosome && this.genomeBrowser.currentPosition) {
                const chr = this.genomeBrowser.currentChromosome;
                const start = this.genomeBrowser.currentPosition.start;
                const end = this.genomeBrowser.currentPosition.end;
                title = `${chr}:${start.toLocaleString()}-${end.toLocaleString()}`;
            } else {
                title = 'New Position';
            }
        }
        
        // Create tab element
        const tabElement = this.createTabElement(tabId, title);
        this.tabContainer.appendChild(tabElement);
        
        // Create tab state inheriting current genome data
        const tabState = this.createTabState(tabId, title, specificPosition);
        this.tabs.set(tabId, tabElement);
        this.tabStates.set(tabId, tabState);
        
        // Apply position visualization immediately if we have position data
        if (specificPosition) {
            this.updateTabPositionVisualization(tabId, specificPosition.chromosome, specificPosition.start, specificPosition.end);
        } else if (this.genomeBrowser.currentChromosome && this.genomeBrowser.currentPosition) {
            // Use current browser position if no specific position provided
            this.updateTabPositionVisualization(
                tabId, 
                this.genomeBrowser.currentChromosome, 
                this.genomeBrowser.currentPosition.start + 1, 
                this.genomeBrowser.currentPosition.end
            );
        }
        
        // Switch to new tab
        this.switchToTab(tabId);
        
        console.log(`Created new tab: ${tabId} - ${title} (same genome, different position)`);
        return tabId;
    }
    
    /**
     * Create tab DOM element
     */
    createTabElement(tabId, title) {
        const tab = document.createElement('div');
        tab.className = 'genome-tab';
        tab.dataset.tabId = tabId;
        
        tab.innerHTML = `
            <i class="tab-icon fas fa-dna"></i>
            <span class="tab-title">${title}</span>
            <div class="tab-position-visualization">
                <div class="chromosome-track" title="Chromosome position indicator">
                    <div class="position-indicator"></div>
                </div>
            </div>
            <button class="tab-close-button" title="Close tab">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add event listeners
        tab.addEventListener('click', (e) => {
            if (!e.target.closest('.tab-close-button')) {
                this.switchToTab(tabId);
            }
        });
        
        const closeButton = tab.querySelector('.tab-close-button');
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tabId);
        });
        
        // Initialize position indicator with default visibility
        this.initializeTabPositionVisualization(tab);
        
        return tab;
    }
    
    /**
     * Create tab state inheriting current genome data for position-based browsing
     */
    createTabState(tabId, title, specificPosition = null) {
        // Inherit current genome data from the browser
        const currentGenome = this.genomeBrowser.currentSequence || null;
        const currentAnnotations = this.genomeBrowser.currentAnnotations || null;
        const currentVariants = this.genomeBrowser.currentVariants || null;
        const currentChromosome = this.genomeBrowser.currentChromosome || null;
        
        // Use specific position if provided, otherwise use current position
        let position;
        if (specificPosition) {
            position = { ...specificPosition };
        } else if (this.genomeBrowser.currentPosition) {
            position = { ...this.genomeBrowser.currentPosition };
        } else {
            position = { start: 0, end: 1000 };
        }
        
        // Copy current UI state
        const currentSidebarVisible = !document.getElementById('sidebar')?.classList.contains('hidden');
        const currentTrackTypes = new Set(this.genomeBrowser.trackVisibility ? 
            Object.entries(this.genomeBrowser.trackVisibility)
                .filter(([_, visible]) => visible)
                .map(([type, _]) => type) : 
            ['genes', 'sequence']);
        
        // Copy current track visibility and feature visibility
        const currentTrackVisibility = this.genomeBrowser.trackVisibility ? 
            { ...this.genomeBrowser.trackVisibility } : 
            { genes: true, gc: true, variants: false, reads: false, proteins: false, sequence: true, actions: false };
        const currentFeatureVisibility = this.genomeBrowser.geneFilters ? 
            { ...this.genomeBrowser.geneFilters } : 
            (this.genomeBrowser.featureVisibility ? 
                { ...this.genomeBrowser.featureVisibility } : 
                { genes: false, CDS: true, mRNA: true, tRNA: true, rRNA: true, promoter: true, terminator: true, regulatory: true, other: true });
        
        return {
            id: tabId,
            title: title,
            isActive: false,
            isLoading: false,
            
            // Inherit genome data state from current browser (shared across all tabs)
            genomeData: currentGenome,
            currentChromosome: currentChromosome,
            currentSequence: currentGenome,
            currentAnnotations: currentAnnotations,
            currentVariants: currentVariants,
            currentPosition: position,
            
            // Reference shared managers (these are shared across all tabs)
            readsManager: this.genomeBrowser.readsManager,
            currentWIGTracks: this.genomeBrowser.currentWIGTracks || {},
            
            // File management state (shared references to loaded files)
            loadedFiles: this.genomeBrowser.loadedFiles || [],
            
            // UI state (inherit current state but keep independent)
            sidebarVisible: currentSidebarVisible,
            activeTrackTypes: currentTrackTypes,
            
            // Track management state (independent per tab)
            trackVisibility: currentTrackVisibility,
            featureVisibility: currentFeatureVisibility,
            trackSettings: this.genomeBrowser.trackRenderer ? { ...this.genomeBrowser.trackRenderer.trackSettings } : {},
            headerStates: this.genomeBrowser.trackRenderer ? new Map(this.genomeBrowser.trackRenderer.headerStates) : new Map(),
            trackOrder: this.getTrackOrder(), // Store track display order
            
            // History for navigation (start fresh for each tab)
            navigationHistory: [],
            historyIndex: -1,
            
            // Chat and AI state (start fresh for each tab)
            chatHistory: [],
            selectedGene: null,
            selectedRead: null,
            
            // Created timestamp
            createdAt: new Date(),
            lastAccessedAt: new Date()
        };
    }
    
    /**
     * Switch to a specific tab
     */
    switchToTab(tabId) {
        if (!this.tabs.has(tabId)) return;
        
        // Save current tab state if there's an active tab
        if (this.activeTabId) {
            this.saveCurrentTabState();
            
            // Cache current tab content if caching is enabled
            if (this.cacheSettings.enabled) {
                this.cacheTabContent(this.activeTabId);
            }
            
            this.setTabActive(this.activeTabId, false);
        }
        
        // Switch to new tab
        this.activeTabId = tabId;
        this.setTabActive(tabId, true);
        
        // Try to restore from cache first, then fallback to full restore
        if (this.cacheSettings.enabled && this.restoreFromCache(tabId)) {
            console.log(`Restored tab ${tabId} from cache`);
        } else {
            // Restore tab state with full rendering
            this.restoreTabState(tabId);
        }
        
        // Update last accessed time and position visualization
        const tabState = this.tabStates.get(tabId);
        if (tabState) {
            tabState.lastAccessedAt = new Date();
            
            // Update position visualization for the current tab
            if (tabState.currentChromosome && tabState.currentPosition) {
                this.updateTabPositionVisualization(
                    tabId,
                    tabState.currentChromosome,
                    tabState.currentPosition.start + 1,
                    tabState.currentPosition.end
                );
            }
        }
        
        // Persist active tab change if enabled
        if (this.isPersistenceEnabled && this.configManager) {
            this.configManager.setActiveTab(tabId);
        }
        
        console.log(`Switched to tab: ${tabId}`);
    }
    
    /**
     * Set tab active state in UI
     */
    setTabActive(tabId, isActive) {
        const tabElement = this.tabs.get(tabId);
        if (tabElement) {
            if (isActive) {
                tabElement.classList.add('active');
                // Scroll tab into view if needed
                this.scrollTabIntoView(tabElement);
            } else {
                tabElement.classList.remove('active');
            }
        }
        
        // Update tab state
        const tabState = this.tabStates.get(tabId);
        if (tabState) {
            tabState.isActive = isActive;
        }
    }
    
    /**
     * Close a tab
     */
    closeTab(tabId) {
        if (!this.tabs.has(tabId)) return;
        
        // Prevent closing the last tab
        if (this.tabs.size <= 1) {
            console.log('Cannot close last tab');
            return;
        }
        
        // Remove tab element
        const tabElement = this.tabs.get(tabId);
        if (tabElement) {
            tabElement.remove();
        }
        
        // Clean up state and cache
        this.tabs.delete(tabId);
        this.tabStates.delete(tabId);
        this.clearTabCache(tabId);
        
        // Remove from persistent storage if enabled
        if (this.isPersistenceEnabled && this.configManager) {
            this.configManager.removeTabState(tabId);
        }
        
        // If closing active tab, switch to another tab
        if (this.activeTabId === tabId) {
            const remainingTabIds = Array.from(this.tabs.keys());
            if (remainingTabIds.length > 0) {
                this.switchToTab(remainingTabIds[0]);
            }
        }
        
        console.log(`Closed tab: ${tabId}`);
    }
    
    /**
     * Switch to next/previous tab
     */
    switchToNextTab(reverse = false) {
        const tabIds = Array.from(this.tabs.keys());
        const currentIndex = tabIds.indexOf(this.activeTabId);
        
        if (currentIndex === -1) return;
        
        let nextIndex;
        if (reverse) {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : tabIds.length - 1;
        } else {
            nextIndex = currentIndex < tabIds.length - 1 ? currentIndex + 1 : 0;
        }
        
        this.switchToTab(tabIds[nextIndex]);
    }
    
    /**
     * Save current genome browser state to active tab
     */
    saveCurrentTabState() {
        if (!this.activeTabId) return;
        
        const tabState = this.tabStates.get(this.activeTabId);
        if (!tabState) return;
        
        try {
            // Save position-specific state (unique per tab)
            tabState.currentChromosome = this.genomeBrowser.currentChromosome;
            tabState.currentPosition = { ...this.genomeBrowser.currentPosition };
            
            // Update shared data references (same across all tabs)
            tabState.currentSequence = this.genomeBrowser.currentSequence;
            tabState.currentAnnotations = this.genomeBrowser.currentAnnotations;
            tabState.currentVariants = this.genomeBrowser.currentVariants;
            tabState.currentWIGTracks = this.genomeBrowser.currentWIGTracks;
            tabState.loadedFiles = this.genomeBrowser.loadedFiles;
            
            // Save UI state (independent per tab)
            tabState.sidebarVisible = !document.getElementById('sidebar').classList.contains('hidden');
            
            // Save track management state (independent per tab)
            tabState.trackVisibility = { ...this.genomeBrowser.trackVisibility };
            tabState.featureVisibility = this.genomeBrowser.geneFilters ? 
                { ...this.genomeBrowser.geneFilters } : 
                { ...this.genomeBrowser.featureVisibility };
            tabState.trackOrder = this.getTrackOrder();
            
            // Save track renderer states (independent per tab)
            if (this.genomeBrowser.trackRenderer) {
                tabState.trackSettings = { ...this.genomeBrowser.trackRenderer.trackSettings };
                tabState.headerStates = new Map(this.genomeBrowser.trackRenderer.headerStates);
            }
            
            // Save selected items (unique per tab)
            tabState.selectedGene = this.genomeBrowser.selectedGene;
            tabState.selectedRead = this.genomeBrowser.selectedRead;
            
            console.log(`Saved state for tab: ${this.activeTabId} at position ${tabState.currentChromosome}:${tabState.currentPosition.start}-${tabState.currentPosition.end}`);
            
            // Persist to ConfigManager if enabled
            this.persistTabState();
        } catch (error) {
            console.error('Error saving tab state:', error);
        }
    }
    
    /**
     * Restore genome browser state from tab
     */
    restoreTabState(tabId) {
        const tabState = this.tabStates.get(tabId);
        if (!tabState) return;
        
        try {
            // Restore position-specific state (unique per tab)
            this.genomeBrowser.currentChromosome = tabState.currentChromosome;
            this.genomeBrowser.currentPosition = { ...tabState.currentPosition };
            
            // Restore shared data (same across all tabs - ensure all tabs see latest data)
            this.genomeBrowser.currentSequence = tabState.currentSequence;
            this.genomeBrowser.currentAnnotations = tabState.currentAnnotations;
            this.genomeBrowser.currentVariants = tabState.currentVariants;
            this.genomeBrowser.currentWIGTracks = tabState.currentWIGTracks;
            this.genomeBrowser.loadedFiles = tabState.loadedFiles;
            
            // Restore UI state
            const sidebar = document.getElementById('sidebar');
            if (tabState.sidebarVisible) {
                sidebar.classList.remove('hidden');
            } else {
                sidebar.classList.add('hidden');
            }
            
            // Restore track management state (independent per tab)
            if (tabState.trackVisibility) {
                this.genomeBrowser.trackVisibility = { ...tabState.trackVisibility };
                // Also sync with visibleTracks
                this.genomeBrowser.visibleTracks = new Set();
                Object.entries(tabState.trackVisibility).forEach(([trackType, isVisible]) => {
                    if (isVisible) {
                        // Map track names to match visibleTracks naming convention
                        const trackName = trackType === 'wig' ? 'wigTracks' : trackType;
                        this.genomeBrowser.visibleTracks.add(trackName);
                    }
                });
            }
            if (tabState.featureVisibility) {
                this.genomeBrowser.featureVisibility = { ...tabState.featureVisibility };
                this.genomeBrowser.geneFilters = { ...tabState.featureVisibility }; // Keep in sync
            }
            
            // Restore track renderer states (independent per tab)
            if (this.genomeBrowser.trackRenderer && tabState.trackSettings) {
                this.genomeBrowser.trackRenderer.trackSettings = { ...tabState.trackSettings };
                if (tabState.headerStates) {
                    // Handle both Map and Object formats for backward compatibility
                    if (tabState.headerStates instanceof Map) {
                        this.genomeBrowser.trackRenderer.headerStates = new Map(tabState.headerStates);
                    } else if (typeof tabState.headerStates === 'object') {
                        // Convert from persisted object format back to Map
                        this.genomeBrowser.trackRenderer.headerStates = new Map(Object.entries(tabState.headerStates));
                    }
                }
            }
            
            // Restore selected items (unique per tab)
            this.genomeBrowser.selectedGene = tabState.selectedGene;
            this.genomeBrowser.selectedRead = tabState.selectedRead;
            
            // Update chromosome selector to match tab state
            const chromosomeSelect = document.getElementById('chromosomeSelect');
            if (chromosomeSelect && tabState.currentChromosome) {
                chromosomeSelect.value = tabState.currentChromosome;
            }
            
            // Update track visibility controls in UI
            this.updateTrackVisibilityControls();
            
            // Restore track order if saved
            if (tabState.trackOrder && Array.isArray(tabState.trackOrder)) {
                // Apply track order after a short delay to ensure tracks are rendered
                setTimeout(() => {
                    this.applyTrackOrder(tabState.trackOrder);
                }, 100);
            }
            
            // Refresh the display if there's genome data
            if (tabState.currentSequence && tabState.currentChromosome) {
                this.genomeBrowser.refreshCurrentView();
            }
            
            console.log(`Restored state for tab: ${tabId} at position ${tabState.currentChromosome}:${tabState.currentPosition.start}-${tabState.currentPosition.end}`);
        } catch (error) {
            console.error('Error restoring tab state:', error);
        }
    }
    
    /**
     * Update tab title
     */
    updateTabTitle(tabId, newTitle) {
        const tabElement = this.tabs.get(tabId);
        if (tabElement) {
            const titleElement = tabElement.querySelector('.tab-title');
            if (titleElement) {
                titleElement.textContent = newTitle;
            }
        }
        
        const tabState = this.tabStates.get(tabId);
        if (tabState) {
            tabState.title = newTitle;
        }
    }
    
    /**
     * Update current tab title based on position (called when user navigates)
     */
    updateCurrentTabPosition(chromosome, start, end) {
        if (!this.activeTabId) return;
        
        // Generate position-based title
        const positionTitle = `${chromosome}:${start.toLocaleString()}-${end.toLocaleString()}`;
        
        // Update current tab title
        this.updateTabTitle(this.activeTabId, positionTitle);
        
        // Update tab state position
        const tabState = this.tabStates.get(this.activeTabId);
        if (tabState) {
            tabState.currentChromosome = chromosome;
            tabState.currentPosition = { start, end };
            tabState.lastAccessedAt = new Date();
        }
        
        // Update position visualization
        this.updateTabPositionVisualization(this.activeTabId, chromosome, start, end);
        
        // Clear cache for this tab since position changed
        if (this.cacheSettings.enabled) {
            this.clearTabCache(this.activeTabId);
        }
        
        // Also update track visibility and settings in tab state
        this.updateCurrentTabTrackState();
        
        console.log(`Updated tab ${this.activeTabId} position to: ${positionTitle}`);
    }
    
    /**
     * Update current tab's track state when changes occur
     */
    updateCurrentTabTrackState() {
        if (!this.activeTabId) return;
        
        const tabState = this.tabStates.get(this.activeTabId);
        if (!tabState) return;
        
        try {
            // Update track visibility
            if (this.genomeBrowser.trackVisibility) {
                tabState.trackVisibility = { ...this.genomeBrowser.trackVisibility };
            }
            
            // Update feature visibility
            if (this.genomeBrowser.geneFilters) {
                tabState.featureVisibility = { ...this.genomeBrowser.geneFilters };
            } else if (this.genomeBrowser.featureVisibility) {
                tabState.featureVisibility = { ...this.genomeBrowser.featureVisibility };
            }
            
            // Update track settings
            if (this.genomeBrowser.trackRenderer && this.genomeBrowser.trackRenderer.trackSettings) {
                tabState.trackSettings = { ...this.genomeBrowser.trackRenderer.trackSettings };
            }
            
            // Update track order - ensure we get the most current order
            const currentTrackOrder = this.getTrackOrder();
            // Only update if we actually got a valid order from DOM
            if (currentTrackOrder && currentTrackOrder.length > 0) {
                tabState.trackOrder = currentTrackOrder;
                console.log(`Updated track order for tab ${this.activeTabId}:`, currentTrackOrder);
            } else {
                console.log(`No tracks found in DOM for tab ${this.activeTabId}, keeping existing order:`, tabState.trackOrder);
            }
            
            // Update header states
            if (this.genomeBrowser.trackRenderer && this.genomeBrowser.trackRenderer.headerStates) {
                tabState.headerStates = new Map(this.genomeBrowser.trackRenderer.headerStates);
            }
            
            tabState.lastAccessedAt = new Date();
            
            console.log(`Updated track state for tab: ${this.activeTabId}`);
        } catch (error) {
            console.error('Error updating tab track state:', error);
        }
    }

    /**
     * Create a new tab for a specific gene or position
     */
    createTabForPosition(chromosome, start, end, title = null) {
        if (!title) {
            title = `${chromosome}:${start.toLocaleString()}-${end.toLocaleString()}`;
        }
        
        const specificPosition = { start: start - 1, end }; // Convert to 0-based internally
        return this.createNewTab(title, specificPosition);
    }
    
    /**
     * Create a new tab focused on a specific gene
     */
    createTabForGene(gene, padding = 500) {
        const newStart = Math.max(0, gene.start - padding);
        const newEnd = gene.end + padding;
        const title = `Gene: ${gene.name || gene.id || 'Unknown'}`;
        
        return this.createTabForPosition(gene.chromosome || this.genomeBrowser.currentChromosome, newStart + 1, newEnd, title);
    }
    
    /**
     * Set tab loading state
     */
    setTabLoading(tabId, isLoading) {
        const tabElement = this.tabs.get(tabId);
        if (tabElement) {
            if (isLoading) {
                tabElement.classList.add('loading');
            } else {
                tabElement.classList.remove('loading');
            }
        }
        
        const tabState = this.tabStates.get(tabId);
        if (tabState) {
            tabState.isLoading = isLoading;
        }
    }
    
    /**
     * Scroll tab into view
     */
    scrollTabIntoView(tabElement) {
        if (!tabElement) return;
        
        const container = this.tabContainer;
        const containerRect = container.getBoundingClientRect();
        const tabRect = tabElement.getBoundingClientRect();
        
        if (tabRect.left < containerRect.left) {
            container.scrollLeft -= (containerRect.left - tabRect.left + 20);
        } else if (tabRect.right > containerRect.right) {
            container.scrollLeft += (tabRect.right - containerRect.right + 20);
        }
    }
    
    /**
     * Get current active tab state
     */
    getCurrentTabState() {
        return this.tabStates.get(this.activeTabId);
    }
    
    /**
     * Handle track visibility change (called from UI)
     */
    onTrackVisibilityChanged() {
        this.updateCurrentTabTrackState();
        // Clear cache since track state changed
        if (this.cacheSettings.enabled && this.activeTabId) {
            this.clearTabCache(this.activeTabId);
        }
    }
    
    /**
     * Handle track settings change (called from settings modals)
     */
    onTrackSettingsChanged() {
        this.updateCurrentTabTrackState();
        // Clear cache since track settings changed
        if (this.cacheSettings.enabled && this.activeTabId) {
            this.clearTabCache(this.activeTabId);
        }
    }

    /**
     * Handle track order change specifically (called after drag & drop)
     */
    onTrackOrderChanged(newOrder) {
        if (!this.activeTabId) return;
        
        const tabState = this.tabStates.get(this.activeTabId);
        if (!tabState) return;
        
        try {
            // Update track order immediately with the provided order
            tabState.trackOrder = [...newOrder];
            tabState.lastAccessedAt = new Date();
            
            console.log(`Track order updated for tab ${this.activeTabId}:`, newOrder);
            
            // Clear cache since track order changed
            if (this.cacheSettings.enabled) {
                this.clearTabCache(this.activeTabId);
            }
        } catch (error) {
            console.error('Error updating track order for tab:', error);
        }
    }

    /**
     * Get all tab information
     */
    getAllTabs() {
        return Array.from(this.tabs.keys()).map(tabId => {
            const tabState = this.tabStates.get(tabId);
            return {
                id: tabId,
                title: tabState?.title || 'Unknown',
                isActive: tabId === this.activeTabId,
                isLoading: tabState?.isLoading || false,
                hasGenomeData: !!tabState?.currentSequence
            };
        });
    }
    
    /**
     * Handle initial genome loading (updates all existing tabs with genome data)
     */
    onGenomeLoaded(genomeData, filename) {
        // Update all existing tabs with the new genome data
        this.tabStates.forEach((tabState, tabId) => {
            // Update genome data in all tabs
            tabState.genomeData = genomeData;
            tabState.currentSequence = genomeData;
            tabState.lastAccessedAt = new Date();
        });
        
        // If this is the first genome being loaded and current tab is "Welcome", 
        // update it with an appropriate initial position
        if (this.activeTabId) {
            const activeState = this.tabStates.get(this.activeTabId);
            if (activeState && activeState.title === 'Welcome') {
                // Set initial position for the welcome tab
                const firstChr = Object.keys(genomeData)[0];
                if (firstChr) {
                    const chrLength = genomeData[firstChr].length;
                    const initialEnd = Math.min(1000, chrLength);
                    this.updateCurrentTabPosition(firstChr, 1, initialEnd);
                }
            }
        }
        
        console.log(`Updated all tabs with new genome data from: ${filename}`);
        
        // Update position visualizations for all tabs
        this.updateAllTabVisualizations();
    }
    
    /**
     * Handle loading of additional files (VCF, BAM, WIG) - share across all tabs
     */
    onAdditionalFileLoaded(fileType, fileData, filename) {
        // Update all existing tabs with the new file data
        this.tabStates.forEach((tabState, tabId) => {
            switch(fileType) {
                case 'variant':
                case 'vcf':
                    tabState.currentVariants = this.genomeBrowser.currentVariants;
                    break;
                case 'reads':
                case 'bam':
                case 'sam':
                    // ReadsManager is shared, so just update the reference
                    tabState.readsManager = this.genomeBrowser.readsManager;
                    break;
                case 'wig':
                    tabState.currentWIGTracks = this.genomeBrowser.currentWIGTracks;
                    break;
            }
            
            // Update loadedFiles list
            tabState.loadedFiles = this.genomeBrowser.loadedFiles;
            tabState.lastAccessedAt = new Date();
        });
        
        console.log(`Updated all tabs with new ${fileType} data from: ${filename}`);
    }
    
    /**
     * Cache current tab content
     */
    cacheTabContent(tabId) {
        if (!this.cacheSettings.enabled) return;
        
        const genomeViewer = document.getElementById('genomeViewer');
        if (!genomeViewer) return;
        
        // Clone the current content
        const cachedContent = {
            html: genomeViewer.innerHTML,
            timestamp: Date.now(),
            tabId: tabId,
            position: this.tabStates.get(tabId)?.currentPosition ? 
                      {...this.tabStates.get(tabId).currentPosition} : null
        };
        
        // Store in cache
        this.tabCache.set(tabId, cachedContent);
        
        // Enforce cache size limit
        this.enforeCacheLimit();
        
        console.log(`Cached content for tab: ${tabId}`);
    }
    
    /**
     * Restore tab content from cache
     */
    restoreFromCache(tabId) {
        if (!this.cacheSettings.enabled) return false;
        
        const cached = this.tabCache.get(tabId);
        if (!cached) return false;
        
        // Check if cache is still valid (not expired)
        if (Date.now() - cached.timestamp > this.cacheSettings.cacheTimeout) {
            this.tabCache.delete(tabId);
            return false;
        }
        
        // Verify the cached position matches current tab state
        const tabState = this.tabStates.get(tabId);
        if (!tabState || !cached.position) return false;
        
        if (cached.position.start !== tabState.currentPosition?.start ||
            cached.position.end !== tabState.currentPosition?.end) {
            // Position changed, cache is invalid
            this.tabCache.delete(tabId);
            return false;
        }
        
        // Restore cached content
        const genomeViewer = document.getElementById('genomeViewer');
        if (genomeViewer) {
            genomeViewer.innerHTML = cached.html;
            
            // Update cached timestamp
            cached.timestamp = Date.now();
            
            // Restore UI state from tab state
            this.restoreUIStateOnly(tabId);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Restore only UI state without full rendering
     */
    restoreUIStateOnly(tabId) {
        const tabState = this.tabStates.get(tabId);
        if (!tabState) return;
        
        try {
            // Restore basic genome browser state
            this.genomeBrowser.currentChromosome = tabState.currentChromosome;
            this.genomeBrowser.currentPosition = { ...tabState.currentPosition };
            this.genomeBrowser.currentSequence = tabState.currentSequence;
            this.genomeBrowser.currentAnnotations = tabState.currentAnnotations;
            this.genomeBrowser.currentVariants = tabState.currentVariants;
            this.genomeBrowser.currentWIGTracks = tabState.currentWIGTracks;
            
            // Restore sidebar state
            const sidebar = document.getElementById('sidebar');
            if (tabState.sidebarVisible) {
                sidebar.classList.remove('hidden');
            } else {
                sidebar.classList.add('hidden');
            }
            
            // Restore track management state
            if (tabState.trackVisibility) {
                this.genomeBrowser.trackVisibility = { ...tabState.trackVisibility };
                // Also sync with visibleTracks
                this.genomeBrowser.visibleTracks = new Set();
                Object.entries(tabState.trackVisibility).forEach(([trackType, isVisible]) => {
                    if (isVisible) {
                        // Map track names to match visibleTracks naming convention
                        const trackName = trackType === 'wig' ? 'wigTracks' : trackType;
                        this.genomeBrowser.visibleTracks.add(trackName);
                    }
                });
            }
            if (tabState.featureVisibility) {
                this.genomeBrowser.featureVisibility = { ...tabState.featureVisibility };
                this.genomeBrowser.geneFilters = { ...tabState.featureVisibility }; // Keep in sync
            }
            
            // Restore track renderer states
            if (this.genomeBrowser.trackRenderer && tabState.trackSettings) {
                this.genomeBrowser.trackRenderer.trackSettings = { ...tabState.trackSettings };
                if (tabState.headerStates) {
                    this.genomeBrowser.trackRenderer.headerStates = new Map(tabState.headerStates);
                }
            }
            
            // Update chromosome selector
            const chromosomeSelect = document.getElementById('chromosomeSelect');
            if (chromosomeSelect && tabState.currentChromosome) {
                chromosomeSelect.value = tabState.currentChromosome;
            }
            
            // Restore selected items
            this.genomeBrowser.selectedGene = tabState.selectedGene;
            this.genomeBrowser.selectedRead = tabState.selectedRead;
            
            // Update track visibility controls in UI
            this.updateTrackVisibilityControls();
            
            // Force update rulers with correct position
            this.updateRulersForPosition(tabState.currentChromosome, tabState.currentPosition);
            
            console.log(`Restored UI state for tab: ${tabId}`);
        } catch (error) {
            console.error('Error restoring UI state from cache:', error);
        }
    }
    
    /**
     * Get current track display order
     */
    getTrackOrder() {
        // Get track order from current DOM structure
        const genomeViewer = document.getElementById('genomeViewer');
        if (!genomeViewer) return ['genes', 'gc', 'variants', 'reads', 'proteins', 'sequence'];
        
        const tracks = genomeViewer.querySelectorAll('[class*="-track"]');
        const trackOrder = [];
        
        tracks.forEach(track => {
            // Extract track type from class name
            for (const className of track.classList) {
                if (className.endsWith('-track') && !className.startsWith('track-')) {
                    const trackType = className.replace('-track', '');
                    if (!trackOrder.includes(trackType)) {
                        trackOrder.push(trackType);
                    }
                    break;
                }
            }
        });
        
        // Fallback to default order if no tracks found
        return trackOrder.length > 0 ? trackOrder : ['genes', 'gc', 'variants', 'reads', 'proteins', 'sequence'];
    }

    /**
     * Apply track order to the displayed tracks
     */
    applyTrackOrder(trackOrder) {
        try {
            const genomeViewer = document.getElementById('genomeViewer');
            if (!genomeViewer) return;
            
            const tracks = {};
            
            // Collect all current tracks
            genomeViewer.querySelectorAll('[class*="-track"]').forEach(track => {
                for (const className of track.classList) {
                    if (className.endsWith('-track') && !className.startsWith('track-')) {
                        const trackType = className.replace('-track', '');
                        tracks[trackType] = track;
                        break;
                    }
                }
            });
            
            // Reorder tracks according to the stored order
            trackOrder.forEach(trackType => {
                if (tracks[trackType]) {
                    genomeViewer.appendChild(tracks[trackType]);
                }
            });
            
            console.log('Applied track order:', trackOrder);
        } catch (error) {
            console.error('Error applying track order:', error);
        }
    }
    
    /**
     * Persist current tab state to ConfigManager
     */
    async persistTabState() {
        if (!this.isPersistenceEnabled || !this.configManager || !this.activeTabId) {
            return;
        }
        
        try {
            const tabState = this.tabStates.get(this.activeTabId);
            if (tabState) {
                // Create a clean copy for persistence (remove non-serializable data)
                const persistableState = {
                    ...tabState,
                    // Convert Map to regular object for JSON serialization
                    headerStates: tabState.headerStates ? Object.fromEntries(tabState.headerStates) : {}
                };
                
                // Remove function references and other non-serializable data
                delete persistableState.readsManager;
                delete persistableState.loadedFiles;
                
                await this.configManager.setTabState(this.activeTabId, persistableState);
            }
        } catch (error) {
            console.error('Error persisting tab state:', error);
        }
    }
    
    /**
     * Update track visibility controls in the UI
     */
    updateTrackVisibilityControls() {
        try {
            // Update track visibility checkboxes in toolbar if they exist
            const trackTypes = ['genes', 'gc', 'variants', 'reads', 'proteins', 'sequence', 'actions'];
            
            trackTypes.forEach(trackType => {
                const checkbox = document.getElementById(`show${trackType.charAt(0).toUpperCase() + trackType.slice(1)}Track`);
                if (checkbox && this.genomeBrowser.trackVisibility && this.genomeBrowser.trackVisibility.hasOwnProperty(trackType)) {
                    checkbox.checked = this.genomeBrowser.trackVisibility[trackType];
                }
                
                // Also update any toggle buttons
                const toggleBtn = document.getElementById(`toggle${trackType.charAt(0).toUpperCase() + trackType.slice(1)}Track`);
                if (toggleBtn && this.genomeBrowser.trackVisibility) {
                    const isVisible = this.genomeBrowser.trackVisibility[trackType];
                    toggleBtn.classList.toggle('active', isVisible);
                    toggleBtn.classList.toggle('inactive', !isVisible);
                }
            });
            
            // Update feature visibility controls
            if (this.genomeBrowser.featureVisibility) {
                Object.keys(this.genomeBrowser.featureVisibility).forEach(featureType => {
                    const checkbox = document.getElementById(`show${featureType.charAt(0).toUpperCase() + featureType.slice(1)}`);
                    if (checkbox) {
                        checkbox.checked = this.genomeBrowser.featureVisibility[featureType];
                    }
                });
            }
            
            console.log('Updated track visibility controls');
        } catch (error) {
            console.error('Error updating track visibility controls:', error);
        }
    }

    /**
     * Update rulers to show correct position for cached tabs
     */
    updateRulersForPosition(chromosome, position) {
        try {
            // Update main navigation bar ruler
            if (this.genomeBrowser.genomeNavigationBar && this.genomeBrowser.genomeNavigationBar.isVisible) {
                // Force redraw of navigation bar with current position
                this.genomeBrowser.genomeNavigationBar.draw();
            }
            
            // Update detailed rulers in track content
            const detailedRulers = document.querySelectorAll('.detailed-ruler-container');
            detailedRulers.forEach(rulerContainer => {
                // Update the stored position for this ruler
                if (rulerContainer._position) {
                    rulerContainer._position.start = position.start;
                    rulerContainer._position.end = position.end;
                }
                rulerContainer._chromosome = chromosome;
                
                // Trigger redraw with updated position
                if (rulerContainer._setupCanvas) {
                    rulerContainer._setupCanvas();
                }
            });
            
            console.log(`Updated rulers for position: ${chromosome}:${position.start}-${position.end}`);
        } catch (error) {
            console.error('Error updating rulers:', error);
        }
    }
    
    /**
     * Enforce cache size limit by removing oldest entries
     */
    enforeCacheLimit() {
        if (this.tabCache.size <= this.cacheSettings.maxCacheSize) return;
        
        // Sort by timestamp and remove oldest entries
        const sortedEntries = Array.from(this.tabCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const toRemove = this.tabCache.size - this.cacheSettings.maxCacheSize;
        for (let i = 0; i < toRemove; i++) {
            this.tabCache.delete(sortedEntries[i][0]);
        }
        
        console.log(`Removed ${toRemove} entries from tab cache`);
    }
    
    /**
     * Clear cache for a specific tab
     */
    clearTabCache(tabId) {
        this.tabCache.delete(tabId);
        console.log(`Cleared cache for tab: ${tabId}`);
    }
    
    /**
     * Clear all tab cache
     */
    clearAllCache() {
        this.tabCache.clear();
        console.log('Cleared all tab cache');
    }
    
    /**
     * Update cache settings
     */
    updateCacheSettings(newSettings) {
        this.cacheSettings = { ...this.cacheSettings, ...newSettings };
        
        // If caching was disabled, clear all cache
        if (!this.cacheSettings.enabled) {
            this.clearAllCache();
        }
        
        // If cache size was reduced, enforce new limit
        if (newSettings.maxCacheSize) {
            this.enforeCacheLimit();
        }
        
        console.log('Updated cache settings:', this.cacheSettings);
    }
    
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            enabled: this.cacheSettings.enabled,
            size: this.tabCache.size,
            maxSize: this.cacheSettings.maxCacheSize,
            timeout: this.cacheSettings.cacheTimeout,
            entries: Array.from(this.tabCache.entries()).map(([tabId, cache]) => ({
                tabId,
                timestamp: cache.timestamp,
                age: Date.now() - cache.timestamp
            }))
        };
    }
    
    /**
     * Initialize tab settings functionality
     */
    initializeTabSettings() {
        // Tab settings button click
        this.tabSettingsButton.addEventListener('click', () => {
            this.openTabSettingsModal();
        });
        
        // Tab settings modal controls
        const modal = document.getElementById('tabSettingsModal');
        const tabCacheEnabled = document.getElementById('tabCacheEnabled');
        const maxCacheSize = document.getElementById('maxCacheSize');
        const cacheTimeout = document.getElementById('cacheTimeout');
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        const saveTabSettingsBtn = document.getElementById('saveTabSettingsBtn');
        
        // Modal close functionality
        const closeButtons = modal.querySelectorAll('.modal-close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeTabSettingsModal();
            });
        });
        
        // Cache enabled toggle
        tabCacheEnabled.addEventListener('change', () => {
            const isEnabled = tabCacheEnabled.checked;
            this.toggleCacheSettingsVisibility(isEnabled);
        });
        
        // Clear cache button
        clearCacheBtn.addEventListener('click', () => {
            this.clearAllCache();
            this.updateCacheStatsDisplay();
        });
        
        // Save settings button
        saveTabSettingsBtn.addEventListener('click', () => {
            this.saveTabSettings();
        });
        
        // Close modal on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeTabSettingsModal();
            }
        });
    }
    
    /**
     * Open tab settings modal
     */
    openTabSettingsModal() {
        const modal = document.getElementById('tabSettingsModal');
        const tabCacheEnabled = document.getElementById('tabCacheEnabled');
        const maxCacheSize = document.getElementById('maxCacheSize');
        const cacheTimeout = document.getElementById('cacheTimeout');
        
        // Populate current settings
        tabCacheEnabled.checked = this.cacheSettings.enabled;
        maxCacheSize.value = this.cacheSettings.maxCacheSize;
        cacheTimeout.value = Math.round(this.cacheSettings.cacheTimeout / (60 * 1000)); // Convert to minutes
        
        // Update visibility
        this.toggleCacheSettingsVisibility(this.cacheSettings.enabled);
        
        // Update cache stats
        this.updateCacheStatsDisplay();
        
        // Show modal
        modal.style.display = 'flex';
    }
    
    /**
     * Close tab settings modal
     */
    closeTabSettingsModal() {
        const modal = document.getElementById('tabSettingsModal');
        modal.style.display = 'none';
    }
    
    /**
     * Toggle visibility of cache settings based on enabled state
     */
    toggleCacheSettingsVisibility(isEnabled) {
        const cacheSettingsGroup = document.getElementById('cacheSettingsGroup');
        const cacheTimeoutGroup = document.getElementById('cacheTimeoutGroup');
        
        if (isEnabled) {
            cacheSettingsGroup.classList.remove('disabled');
            cacheTimeoutGroup.classList.remove('disabled');
        } else {
            cacheSettingsGroup.classList.add('disabled');
            cacheTimeoutGroup.classList.add('disabled');
        }
    }
    
    /**
     * Update cache statistics display
     */
    updateCacheStatsDisplay() {
        const stats = this.getCacheStats();
        const cachedTabsCount = document.getElementById('cachedTabsCount');
        const cacheSizeInfo = document.getElementById('cacheSizeInfo');
        
        cachedTabsCount.textContent = stats.size;
        cacheSizeInfo.textContent = `${stats.size}/${stats.maxSize}`;
    }
    
    /**
     * Save tab settings
     */
    saveTabSettings() {
        const tabCacheEnabled = document.getElementById('tabCacheEnabled');
        const maxCacheSize = document.getElementById('maxCacheSize');
        const cacheTimeout = document.getElementById('cacheTimeout');
        
        const newSettings = {
            enabled: tabCacheEnabled.checked,
            maxCacheSize: parseInt(maxCacheSize.value),
            cacheTimeout: parseInt(cacheTimeout.value) * 60 * 1000 // Convert to milliseconds
        };
        
        // Validate settings
        if (newSettings.maxCacheSize < 1 || newSettings.maxCacheSize > 20) {
            alert('Maximum cache size must be between 1 and 20');
            return;
        }
        
        if (newSettings.cacheTimeout < 60000 || newSettings.cacheTimeout > 7200000) { // 1 min to 120 min
            alert('Cache timeout must be between 1 and 120 minutes');
            return;
        }
        
        // Update settings
        this.updateCacheSettings(newSettings);
        
        // Close modal
        this.closeTabSettingsModal();
        
        console.log('Tab settings saved successfully');
    }
    
    /**
     * Get chromosome color based on chromosome name
     */
    getChromosomeColor(chromosome) {
        // Define color scheme for different chromosomes
        const colorMap = {
            // Common bacterial chromosome names
            'chromosome': '#3498db',    // Blue
            'chr': '#3498db',          // Blue
            'chr1': '#e74c3c',         // Red
            'chr2': '#2ecc71',         // Green
            'chr3': '#f39c12',         // Orange
            'chr4': '#9b59b6',         // Purple
            'chr5': '#1abc9c',         // Turquoise
            'chr6': '#34495e',         // Dark blue-gray
            'chr7': '#e67e22',         // Carrot
            'chr8': '#8e44ad',         // Wisteria
            'chr9': '#16a085',         // Green sea
            'chr10': '#2c3e50',        // Midnight blue
            'chr11': '#f1c40f',        // Sun flower
            'chr12': '#27ae60',        // Nephritis
            'chr13': '#e74c3c',        // Alizarin
            'chr14': '#8e44ad',        // Amethyst
            'chr15': '#f39c12',        // Orange
            'chr16': '#d35400',        // Pumpkin
            'chr17': '#7f8c8d',        // Asbestos
            'chr18': '#2980b9',        // Belize hole
            'chr19': '#c0392b',        // Pomegranate
            'chr20': '#17a2b8',        // Cyan
            'chr21': '#dc3545',        // Danger red
            'chr22': '#6f42c1',        // Indigo
            'chrX': '#fd7e14',         // Orange
            'chrY': '#6610f2',         // Purple
            'chrM': '#20c997',         // Teal
            'chrMT': '#20c997',        // Teal
            // Plasmids
            'plasmid': '#ffc107',      // Yellow
            'plas': '#ffc107',         // Yellow
            'p1': '#ffc107',           // Yellow
            'p2': '#fd7e14',           // Orange
            'p3': '#dc3545',           // Red
        };
        
        // Convert to lowercase for matching
        const chrLower = chromosome.toLowerCase();
        
        // Try direct match first
        if (colorMap[chrLower]) {
            return colorMap[chrLower];
        }
        
        // Try pattern matching
        for (const [pattern, color] of Object.entries(colorMap)) {
            if (chrLower.includes(pattern)) {
                return color;
            }
        }
        
        // Generate consistent color based on chromosome name hash
        let hash = 0;
        for (let i = 0; i < chromosome.length; i++) {
            const char = chromosome.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        // Use hash to select from a palette of colors
        const palette = [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#34495e', '#e67e22', '#8e44ad', '#16a085',
            '#2c3e50', '#f1c40f', '#27ae60', '#c0392b', '#2980b9'
        ];
        
        return palette[Math.abs(hash) % palette.length];
    }

    /**
     * Initialize tab position visualization with default visible styling
     */
    initializeTabPositionVisualization(tabElement) {
        const chromosomeTrack = tabElement.querySelector('.chromosome-track');
        const positionIndicator = tabElement.querySelector('.position-indicator');
        
        if (!chromosomeTrack || !positionIndicator) return;
        
        try {
            // Set default chromosome color (blue)
            const defaultColor = '#1a73e8';
            
            // Initialize chromosome track with default styling
            chromosomeTrack.style.background = `linear-gradient(to right, ${defaultColor}22, ${defaultColor}44)`;
            chromosomeTrack.style.borderColor = defaultColor;
            chromosomeTrack.style.display = 'block';
            chromosomeTrack.style.visibility = 'visible';
            
            // Initialize position indicator with highly visible default styling
            positionIndicator.style.left = '10%';
            positionIndicator.style.width = '15%';
            positionIndicator.style.backgroundColor = defaultColor;
            positionIndicator.style.border = `2px solid ${defaultColor}`;
            positionIndicator.style.boxShadow = `0 0 6px ${defaultColor}88, inset 0 0 3px rgba(255, 255, 255, 0.4)`;
            positionIndicator.style.minWidth = '4px';
            positionIndicator.style.zIndex = '10';
            positionIndicator.style.display = 'block';
            positionIndicator.style.visibility = 'visible';
            positionIndicator.style.opacity = '1';
            
            // Set default tooltip
            chromosomeTrack.title = 'Position indicator will update when genome data is loaded';
            
            console.log(`Initialized position visualization for tab with default styling`);
        } catch (error) {
            console.error('Error initializing tab position visualization:', error);
        }
    }

    /**
     * Update tab position visualization
     */
    updateTabPositionVisualization(tabId, chromosome, start, end) {
        const tabElement = this.tabs.get(tabId);
        if (!tabElement) return;
        
        const chromosomeTrack = tabElement.querySelector('.chromosome-track');
        const positionIndicator = tabElement.querySelector('.position-indicator');
        
        if (!chromosomeTrack || !positionIndicator) return;
        
        try {
            // Get chromosome length
            const sequence = this.genomeBrowser.currentSequence;
            if (!sequence || !sequence[chromosome]) {
                console.warn(`No sequence data for chromosome ${chromosome}`);
                return;
            }
            
            const chromosomeLength = sequence[chromosome].length;
            
            // Calculate position percentage
            const startPercent = (start / chromosomeLength) * 100;
            const endPercent = (end / chromosomeLength) * 100;
            const widthPercent = endPercent - startPercent;
            
            // Get chromosome color
            const chromosomeColor = this.getChromosomeColor(chromosome);
            
            // Update tab element data attribute for CSS chromosome colors
            tabElement.setAttribute('data-chromosome', chromosome);
            
            // Update chromosome track background color
            chromosomeTrack.style.background = `linear-gradient(to right, ${chromosomeColor}22, ${chromosomeColor}44)`;
            chromosomeTrack.style.borderColor = chromosomeColor;
            chromosomeTrack.style.display = 'block';
            chromosomeTrack.style.visibility = 'visible';
            
            // Update position indicator with enhanced visibility
            positionIndicator.style.left = `${startPercent}%`;
            
            // Calculate width with better minimum visibility
            const calculatedWidth = Math.max(3, widthPercent); // Minimum 3% width for better visibility
            const displayWidth = calculatedWidth > 80 ? 80 : calculatedWidth; // Cap at 80% to avoid overwhelming
            positionIndicator.style.width = `${displayWidth}%`;
            
            // Enhanced styling for better visibility
            positionIndicator.style.backgroundColor = chromosomeColor;
            positionIndicator.style.border = `2px solid ${chromosomeColor}`;
            positionIndicator.style.boxShadow = `0 0 6px ${chromosomeColor}88, inset 0 0 3px rgba(255, 255, 255, 0.4)`;
            positionIndicator.style.minWidth = '4px'; // Absolute minimum width in pixels
            positionIndicator.style.zIndex = '10'; // Ensure it's above the track
            positionIndicator.style.display = 'block';
            positionIndicator.style.visibility = 'visible';
            positionIndicator.style.opacity = '1';
            
            // Update tooltip
            const range = end - start;
            const tooltipText = `${chromosome}: ${start.toLocaleString()}-${end.toLocaleString()} (${range.toLocaleString()} bp)`;
            chromosomeTrack.title = tooltipText;
            
            console.log(`Updated position visualization for tab ${tabId}: ${chromosome} ${startPercent.toFixed(1)}%-${endPercent.toFixed(1)}% (width: ${displayWidth.toFixed(1)}%)`);
        } catch (error) {
            console.error('Error updating tab position visualization:', error);
        }
    }

    /**
     * Update all tab position visualizations
     */
    updateAllTabVisualizations() {
        this.tabStates.forEach((tabState, tabId) => {
            if (tabState.currentChromosome && tabState.currentPosition) {
                this.updateTabPositionVisualization(
                    tabId,
                    tabState.currentChromosome,
                    tabState.currentPosition.start + 1,
                    tabState.currentPosition.end
                );
            }
        });
    }

    /**
     * Force visibility of all position indicators (for debugging and fixing display issues)
     */
    forcePositionIndicatorVisibility() {
        this.tabs.forEach((tabElement, tabId) => {
            const positionIndicator = tabElement.querySelector('.position-indicator');
            if (positionIndicator) {
                positionIndicator.style.display = 'block';
                positionIndicator.style.visibility = 'visible';
                positionIndicator.style.opacity = '1';
                
                // Apply some default visible styling if not already set
                if (!positionIndicator.style.backgroundColor) {
                    positionIndicator.style.backgroundColor = '#1a73e8';
                    positionIndicator.style.border = '2px solid #1a73e8';
                    positionIndicator.style.boxShadow = '0 0 6px rgba(26, 115, 232, 0.8)';
                    positionIndicator.style.minWidth = '4px';
                    positionIndicator.style.left = '10%';
                    positionIndicator.style.width = '15%';
                }
                
                console.log(`Forced visibility for position indicator in tab ${tabId}`);
            }
        });
    }

    /**
     * Cleanup resources
     */
    dispose() {
        // Clean up all tab states and cache
        this.tabStates.clear();
        this.tabs.clear();
        this.clearAllCache();
        
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeydown);
        
        console.log('TabManager disposed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabManager;
}

// Global debugging function for position indicators
window.debugPositionIndicators = function() {
    console.log('=== Position Indicators Debug ===');
    
    const tabs = document.querySelectorAll('.genome-tab');
    tabs.forEach((tab, index) => {
        const tabId = tab.dataset.tabId;
        const positionIndicator = tab.querySelector('.position-indicator');
        const chromosomeTrack = tab.querySelector('.chromosome-track');
        
        console.log(`Tab ${index + 1} (${tabId}):`);
        console.log('  Tab element:', tab);
        console.log('  Position indicator:', positionIndicator);
        console.log('  Chromosome track:', chromosomeTrack);
        
        if (positionIndicator) {
            const styles = window.getComputedStyle(positionIndicator);
            console.log('  Position indicator styles:');
            console.log('    display:', styles.display);
            console.log('    visibility:', styles.visibility);
            console.log('    opacity:', styles.opacity);
            console.log('    width:', styles.width);
            console.log('    height:', styles.height);
            console.log('    left:', styles.left);
            console.log('    background-color:', styles.backgroundColor);
            console.log('    border:', styles.border);
            console.log('    box-shadow:', styles.boxShadow);
            console.log('    z-index:', styles.zIndex);
            
            // Force visibility for debugging
            positionIndicator.style.display = 'block';
            positionIndicator.style.visibility = 'visible';
            positionIndicator.style.opacity = '1';
            positionIndicator.style.backgroundColor = '#ff0000'; // Red for debugging
            positionIndicator.style.border = '2px solid #ff0000';
            positionIndicator.style.width = '20%';
            positionIndicator.style.left = '10%';
            positionIndicator.style.minWidth = '10px';
            positionIndicator.style.zIndex = '999';
            
            console.log('  → Forced red visibility for debugging');
        } else {
            console.log('  → No position indicator found!');
        }
    });
    
    console.log('=== End Debug ===');
    
    // Also check for CSS conflicts
    const allStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
    console.log('CSS sources:', allStyles.length);
    allStyles.forEach((style, index) => {
        if (style.tagName === 'STYLE') {
            const content = style.textContent || style.innerText;
            if (content.includes('position-indicator')) {
                console.log(`Style ${index}: Contains position-indicator rules`);
            }
        } else if (style.tagName === 'LINK') {
            console.log(`Style ${index}: External stylesheet ${style.href}`);
        }
    });
};

// Add to global scope for easy access
window.forcePositionIndicatorVisibility = function() {
    if (window.genomeBrowser && window.genomeBrowser.tabManager) {
        window.genomeBrowser.tabManager.forcePositionIndicatorVisibility();
    } else {
        console.warn('TabManager not available');
    }
};