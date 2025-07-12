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
        
        this.initializeEventListeners();
        this.initializeTabSettings();
        this.createInitialTab();
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
            trackSettings: this.genomeBrowser.trackRenderer ? { ...this.genomeBrowser.trackRenderer.trackSettings } : {},
            headerStates: this.genomeBrowser.trackRenderer ? new Map(this.genomeBrowser.trackRenderer.headerStates) : new Map(),
            
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
        
        // Update last accessed time
        const tabState = this.tabStates.get(tabId);
        if (tabState) {
            tabState.lastAccessedAt = new Date();
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
            
            // Save track renderer states (independent per tab)
            if (this.genomeBrowser.trackRenderer) {
                tabState.trackSettings = { ...this.genomeBrowser.trackRenderer.trackSettings };
                tabState.headerStates = new Map(this.genomeBrowser.trackRenderer.headerStates);
            }
            
            // Save selected items (unique per tab)
            tabState.selectedGene = this.genomeBrowser.selectedGene;
            tabState.selectedRead = this.genomeBrowser.selectedRead;
            
            console.log(`Saved state for tab: ${this.activeTabId} at position ${tabState.currentChromosome}:${tabState.currentPosition.start}-${tabState.currentPosition.end}`);
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
            
            // Restore track renderer states (independent per tab)
            if (this.genomeBrowser.trackRenderer && tabState.trackSettings) {
                this.genomeBrowser.trackRenderer.trackSettings = { ...tabState.trackSettings };
                if (tabState.headerStates) {
                    this.genomeBrowser.trackRenderer.headerStates = new Map(tabState.headerStates);
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
        
        // Clear cache for this tab since position changed
        if (this.cacheSettings.enabled) {
            this.clearTabCache(this.activeTabId);
        }
        
        console.log(`Updated tab ${this.activeTabId} position to: ${positionTitle}`);
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
            
            // Update chromosome selector
            const chromosomeSelect = document.getElementById('chromosomeSelect');
            if (chromosomeSelect && tabState.currentChromosome) {
                chromosomeSelect.value = tabState.currentChromosome;
            }
            
            // Restore selected items
            this.genomeBrowser.selectedGene = tabState.selectedGene;
            this.genomeBrowser.selectedRead = tabState.selectedRead;
            
            // Force update rulers with correct position
            this.updateRulersForPosition(tabState.currentChromosome, tabState.currentPosition);
            
            console.log(`Restored UI state for tab: ${tabId}`);
        } catch (error) {
            console.error('Error restoring UI state from cache:', error);
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