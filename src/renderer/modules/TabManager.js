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
        
        // Tab state isolation
        this.tabStates = new Map(); // Store individual tab states
        
        this.initializeEventListeners();
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
     * Create a new tab
     */
    createNewTab(title = 'New Genome', genomeData = null) {
        const tabId = `tab-${this.nextTabId++}`;
        
        // Create tab element
        const tabElement = this.createTabElement(tabId, title);
        this.tabContainer.appendChild(tabElement);
        
        // Create tab state
        const tabState = this.createTabState(tabId, title, genomeData);
        this.tabs.set(tabId, tabElement);
        this.tabStates.set(tabId, tabState);
        
        // Switch to new tab
        this.switchToTab(tabId);
        
        console.log(`Created new tab: ${tabId} - ${title}`);
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
     * Create isolated tab state
     */
    createTabState(tabId, title, genomeData = null) {
        return {
            id: tabId,
            title: title,
            isActive: false,
            isLoading: false,
            
            // Genome data state
            genomeData: genomeData,
            currentChromosome: null,
            currentSequence: null,
            currentAnnotations: null,
            currentPosition: { start: 0, end: 1000 },
            
            // File management state
            loadedFiles: {
                genome: null,
                annotations: [],
                variants: [],
                reads: [],
                wig: []
            },
            
            // UI state
            sidebarVisible: true,
            activeTrackTypes: new Set(['genes', 'sequence']),
            trackSettings: {},
            
            // History for navigation
            navigationHistory: [],
            historyIndex: -1,
            
            // Chat and AI state
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
            this.setTabActive(this.activeTabId, false);
        }
        
        // Switch to new tab
        this.activeTabId = tabId;
        this.setTabActive(tabId, true);
        
        // Restore tab state
        this.restoreTabState(tabId);
        
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
        
        // Clean up state
        this.tabs.delete(tabId);
        this.tabStates.delete(tabId);
        
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
            // Save current genome state
            tabState.currentChromosome = this.genomeBrowser.currentChromosome;
            tabState.currentSequence = this.genomeBrowser.currentSequence;
            tabState.currentAnnotations = this.genomeBrowser.currentAnnotations;
            tabState.currentPosition = { ...this.genomeBrowser.currentPosition };
            
            // Save UI state
            tabState.sidebarVisible = !document.getElementById('sidebar').classList.contains('hidden');
            
            // Save selected items
            tabState.selectedGene = this.genomeBrowser.selectedGene;
            tabState.selectedRead = this.genomeBrowser.selectedRead;
            
            console.log(`Saved state for tab: ${this.activeTabId}`);
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
            // Restore genome state
            this.genomeBrowser.currentChromosome = tabState.currentChromosome;
            this.genomeBrowser.currentSequence = tabState.currentSequence;
            this.genomeBrowser.currentAnnotations = tabState.currentAnnotations;
            this.genomeBrowser.currentPosition = { ...tabState.currentPosition };
            
            // Restore UI state
            const sidebar = document.getElementById('sidebar');
            if (tabState.sidebarVisible) {
                sidebar.classList.remove('hidden');
            } else {
                sidebar.classList.add('hidden');
            }
            
            // Restore selected items
            this.genomeBrowser.selectedGene = tabState.selectedGene;
            this.genomeBrowser.selectedRead = tabState.selectedRead;
            
            // Refresh the display if there's genome data
            if (tabState.currentSequence && tabState.currentChromosome) {
                this.genomeBrowser.refreshCurrentView();
            }
            
            console.log(`Restored state for tab: ${tabId}`);
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
     * Load genome data into current tab
     */
    loadGenomeIntoCurrentTab(genomeData, filename) {
        if (!this.activeTabId) return;
        
        const tabState = this.tabStates.get(this.activeTabId);
        if (!tabState) return;
        
        // Update tab title based on filename
        const tabTitle = filename ? filename.replace(/\.[^/.]+$/, '') : 'Genome Analysis';
        this.updateTabTitle(this.activeTabId, tabTitle);
        
        // Update tab icon based on file type
        const tabElement = this.tabs.get(this.activeTabId);
        if (tabElement) {
            const iconElement = tabElement.querySelector('.tab-icon');
            if (iconElement) {
                // Determine icon based on file type
                if (filename?.toLowerCase().includes('fasta')) {
                    iconElement.className = 'tab-icon fas fa-dna';
                } else if (filename?.toLowerCase().includes('genbank')) {
                    iconElement.className = 'tab-icon fas fa-file-medical';
                } else {
                    iconElement.className = 'tab-icon fas fa-dna';
                }
            }
        }
        
        // Store genome data in tab state
        tabState.genomeData = genomeData;
        tabState.lastAccessedAt = new Date();
        
        console.log(`Loaded genome data into tab: ${this.activeTabId} - ${tabTitle}`);
    }
    
    /**
     * Cleanup resources
     */
    dispose() {
        // Clean up all tab states
        this.tabStates.clear();
        this.tabs.clear();
        
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeydown);
        
        console.log('TabManager disposed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabManager;
}