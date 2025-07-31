/**
 * NavigationManager - Handles navigation, search, zoom, and position management
 */
class NavigationManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.searchResults = [];
        this.currentSearchIndex = 0;
        this.searchResultsOriginalPosition = null; // Store original position for restoration

        // Centralized drag state
        this.dragState = {
            isDragging: false,
            hasDragged: false,
            element: null,
            chromosome: null,
            startX: 0,
            startPosition: 0,
            lastUpdateX: 0,
            cumulativeVisualDeltaX: 0,
            lastCalculatedStart: 0, // Store the last calculated position
            canvasTransformsApplied: false, // Track if Canvas transforms were applied during this drag
        };
        
        // Ruler update throttling
        this.rulerUpdateThrottle = {
            lastUpdateTime: 0,
            updateInterval: 16, // 60fps (1000ms/60 ≈ 16ms)
            pendingUpdate: false
        };
        
        // Global dragging setting - when enabled, all tracks update during drag
        this.globalDraggingEnabled = false;

        // Wheel zoom configuration
        this.wheelZoomConfig = {
            enabled: true,
            sensitivity: 0.1, // Zoom factor per wheel step
            minRange: 100, // Minimum range in base pairs
            maxRange: 1000000, // Maximum range in base pairs
            smoothZoom: true, // Enable smooth zooming
            zoomToCursor: true // Zoom towards cursor position
        };

        // Initialize wheel zoom settings from GeneralSettingsManager
        this.initializeWheelZoomSettings();

        // Bind methods and add global listeners once
        this.handleDocumentMouseMove = this.handleDocumentMouseMove.bind(this);
        this.handleDocumentMouseUp = this.handleDocumentMouseUp.bind(this);
        this.handleWheelZoom = this.handleWheelZoom.bind(this);
        document.addEventListener('mousemove', this.handleDocumentMouseMove);
        document.addEventListener('mouseup', this.handleDocumentMouseUp);
        document.addEventListener('wheel', this.handleWheelZoom, { passive: false });
    }

    // Navigation methods
    navigatePrevious() {
        const range = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
        const newStart = Math.max(0, this.genomeBrowser.currentPosition.start - range);
        const newEnd = newStart + range;
        
        this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
        
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.updateStatistics(currentChr, this.genomeBrowser.currentSequence[currentChr]);
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
            // Update navigation bar
            this.genomeBrowser.genomeNavigationBar.update();
            
            // Update current tab title with new position
            if (this.genomeBrowser.tabManager) {
                this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, newStart + 1, newEnd);
            }
        }
    }

    navigateNext() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) return;
        
        const sequence = this.genomeBrowser.currentSequence[currentChr];
        const range = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
        const newStart = this.genomeBrowser.currentPosition.start + range;
        const newEnd = Math.min(sequence.length, newStart + range);
        
        if (newStart < sequence.length) {
            this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
            this.genomeBrowser.updateStatistics(currentChr, sequence);
            this.genomeBrowser.displayGenomeView(currentChr, sequence);
            // Update navigation bar
            this.genomeBrowser.genomeNavigationBar.update();
            
            // Update current tab title with new position
            if (this.genomeBrowser.tabManager) {
                this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, newStart + 1, newEnd);
            }
        }
    }

    // Zoom methods
    zoomIn() {
        const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
        const newRange = Math.max(100, Math.floor(currentRange / 2));
        const center = Math.floor((this.genomeBrowser.currentPosition.start + this.genomeBrowser.currentPosition.end) / 2);
        const newStart = Math.max(0, center - Math.floor(newRange / 2));
        const newEnd = newStart + newRange;
        
        this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
        
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.updateStatistics(currentChr, this.genomeBrowser.currentSequence[currentChr]);
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
            // Update navigation bar
            this.genomeBrowser.genomeNavigationBar.update();
            
            // Update current tab title with new position
            if (this.genomeBrowser.tabManager) {
                this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, newStart + 1, newEnd);
            }
        }
    }

    zoomOut() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) return;
        
        const sequence = this.genomeBrowser.currentSequence[currentChr];
        const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
        const newRange = Math.min(sequence.length, currentRange * 2);
        const center = Math.floor((this.genomeBrowser.currentPosition.start + this.genomeBrowser.currentPosition.end) / 2);
        const newStart = Math.max(0, center - Math.floor(newRange / 2));
        const newEnd = Math.min(sequence.length, newStart + newRange);
        
        this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
        this.genomeBrowser.updateStatistics(currentChr, sequence);
        this.genomeBrowser.displayGenomeView(currentChr, sequence);
        // Update navigation bar
        this.genomeBrowser.genomeNavigationBar.update();
        
        // Update current tab title with new position
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, newStart + 1, newEnd);
        }
    }

    resetZoom() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) return;
        
        const sequence = this.genomeBrowser.currentSequence[currentChr];
        this.genomeBrowser.currentPosition = { start: 0, end: Math.min(10000, sequence.length) };
        this.genomeBrowser.updateStatistics(currentChr, sequence);
        this.genomeBrowser.displayGenomeView(currentChr, sequence);
        // Update navigation bar
        this.genomeBrowser.genomeNavigationBar.update();
    }

    /**
     * Handle mouse wheel zoom functionality
     */
    handleWheelZoom(e) {
        // Check if wheel zoom is enabled
        if (!this.wheelZoomConfig.enabled) return;

        // Only handle wheel events on genome browser areas
        const genomeBrowserElement = e.target.closest('.genome-browser, .sequence-track, .gene-track, .gc-track, .reads-track, .tracks-container');
        if (!genomeBrowserElement) return;

        // Prevent default scrolling behavior
        e.preventDefault();

        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
            return;
        }

        const sequence = this.genomeBrowser.currentSequence[currentChr];
        const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
        
        // Determine zoom direction and factor
        const zoomDirection = Math.sign(e.deltaY); // Positive = zoom out, negative = zoom in
        const zoomFactor = 1 + (this.wheelZoomConfig.sensitivity * Math.abs(e.deltaY / 100));
        
        let newRange;
        if (zoomDirection > 0) {
            // Zoom out
            newRange = Math.min(this.wheelZoomConfig.maxRange, Math.min(sequence.length, currentRange * zoomFactor));
        } else {
            // Zoom in
            newRange = Math.max(this.wheelZoomConfig.minRange, currentRange / zoomFactor);
        }

        // If range hasn't changed significantly, skip update
        if (Math.abs(newRange - currentRange) < 1) return;

        let newStart, newEnd;
        
        if (this.wheelZoomConfig.zoomToCursor) {
            // Calculate cursor position within the genome browser
            const browserRect = genomeBrowserElement.getBoundingClientRect();
            const relativeX = e.clientX - browserRect.left;
            const cursorRatio = relativeX / browserRect.width;
            
            // Calculate focal point in genomic coordinates
            const focalPoint = this.genomeBrowser.currentPosition.start + (currentRange * cursorRatio);
            
            // Calculate new range around focal point
            const beforeFocal = (newRange * cursorRatio);
            const afterFocal = newRange - beforeFocal;
            
            newStart = Math.max(0, Math.round(focalPoint - beforeFocal));
            newEnd = Math.min(sequence.length, Math.round(focalPoint + afterFocal));
            
            // Adjust if we hit boundaries
            if (newStart === 0) {
                newEnd = Math.min(sequence.length, newRange);
            } else if (newEnd === sequence.length) {
                newStart = Math.max(0, sequence.length - newRange);
            }
        } else {
            // Zoom to center
            const center = Math.floor((this.genomeBrowser.currentPosition.start + this.genomeBrowser.currentPosition.end) / 2);
            newStart = Math.max(0, Math.round(center - newRange / 2));
            newEnd = Math.min(sequence.length, newStart + newRange);
            
            // Adjust if we hit boundaries
            if (newEnd === sequence.length) {
                newStart = Math.max(0, sequence.length - newRange);
            }
        }

        // Update position
        this.genomeBrowser.currentPosition = { start: Math.round(newStart), end: Math.round(newEnd) };
        
        // Update the view
        this.genomeBrowser.updateStatistics(currentChr, sequence);
        this.genomeBrowser.displayGenomeView(currentChr, sequence);
        
        // Update navigation bar
        if (this.genomeBrowser.genomeNavigationBar) {
            this.genomeBrowser.genomeNavigationBar.update();
        }
        
        // Update current tab title with new position
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, newStart + 1, newEnd);
        }

        // Show visual feedback
        this.showWheelZoomFeedback(zoomDirection, Math.round(newEnd - newStart));

        // Log zoom action for debugging
        console.log('🔍 [WHEEL-ZOOM]', {
            direction: zoomDirection > 0 ? 'out' : 'in',
            oldRange: currentRange.toLocaleString(),
            newRange: Math.round(newEnd - newStart).toLocaleString(),
            position: `${newStart.toLocaleString()}-${newEnd.toLocaleString()}`,
            zoomToCursor: this.wheelZoomConfig.zoomToCursor
        });
    }

    /**
     * Configure wheel zoom settings
     */
    configureWheelZoom(config) {
        this.wheelZoomConfig = { ...this.wheelZoomConfig, ...config };
        console.log('🔍 [WHEEL-ZOOM] Configuration updated:', this.wheelZoomConfig);
    }

    /**
     * Enable/disable wheel zoom
     */
    setWheelZoomEnabled(enabled) {
        this.wheelZoomConfig.enabled = enabled;
        console.log(`🔍 [WHEEL-ZOOM] ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Initialize wheel zoom settings from GeneralSettingsManager
     */
    initializeWheelZoomSettings() {
        // Wait for GeneralSettingsManager to be available
        setTimeout(() => {
            if (window.generalSettingsManager && window.generalSettingsManager.settings) {
                const settings = window.generalSettingsManager.settings;
                this.configureWheelZoom({
                    enabled: settings.enableWheelZoom,
                    sensitivity: settings.wheelZoomSensitivity,
                    zoomToCursor: settings.wheelZoomToCursor,
                    minRange: settings.wheelZoomMinRange,
                    maxRange: settings.wheelZoomMaxRange
                });
                console.log('🔍 [WHEEL-ZOOM] Settings initialized from GeneralSettingsManager');
            }
        }, 100);
    }

    /**
     * Show visual feedback for wheel zoom operations
     */
    showWheelZoomFeedback(direction, newRange) {
        // Create or get existing zoom indicator
        let indicator = document.getElementById('wheelZoomIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'wheelZoomIndicator';
            indicator.className = 'wheel-zoom-indicator';
            indicator.setAttribute('aria-live', 'polite');
            document.body.appendChild(indicator);
        }

        // Update indicator content
        const directionIcon = direction > 0 ? '🔍-' : '🔍+';
        const directionText = direction > 0 ? 'Zoom Out' : 'Zoom In';
        const directionClass = direction > 0 ? 'zoom-out' : 'zoom-in';
        
        indicator.innerHTML = `
            <span class="zoom-direction ${directionClass}">${directionIcon}</span>
            <span class="zoom-action">${directionText}</span>
            <span class="zoom-range">${this.formatRange(newRange)}</span>
        `;

        // Show indicator with animation
        indicator.classList.add('active', 'pulse');
        
        // Update genome browser cursor
        const genomeBrowser = document.querySelector('.genome-browser');
        if (genomeBrowser) {
            genomeBrowser.classList.add('wheel-zooming');
            if (direction > 0) {
                genomeBrowser.classList.add('zoom-out');
            } else {
                genomeBrowser.classList.remove('zoom-out');
            }
        }

        // Hide indicator after delay
        clearTimeout(this.zoomFeedbackTimeout);
        this.zoomFeedbackTimeout = setTimeout(() => {
            indicator.classList.remove('active', 'pulse');
            if (genomeBrowser) {
                genomeBrowser.classList.remove('wheel-zooming', 'zoom-out');
            }
        }, 1500);
    }

    /**
     * Format range for display
     */
    formatRange(range) {
        if (range >= 1000000) {
            return `${(range / 1000000).toFixed(1)}M bp`;
        } else if (range >= 1000) {
            return `${(range / 1000).toFixed(1)}K bp`;
        } else {
            return `${range} bp`;
        }
    }

    // Position navigation
    goToPosition() {
        const input = document.getElementById('positionInput').value.trim();
        this.parseAndGoToPosition(input);
    }

    performGoto() {
        const input = document.getElementById('modalPositionInput').value.trim();
        this.parseAndGoToPosition(input);
        document.getElementById('gotoModal').classList.remove('show');
    }

    parseAndGoToPosition(input) {
        if (!input) return;
        
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
            alert('Please select a chromosome first');
            return;
        }
        
        const sequence = this.genomeBrowser.currentSequence[currentChr];
        let start, end;
        
        // Parse different formats: "1000", "1000-2000", "chr1:1000-2000"
        if (input.includes(':')) {
            const [chr, range] = input.split(':');
            if (range.includes('-')) {
                const [s, e] = range.split('-');
                start = parseInt(s) - 1; // Convert to 0-based
                end = parseInt(e);
            } else {
                start = parseInt(range) - 1;
                end = start + 1000;
            }
        } else if (input.includes('-')) {
            const [s, e] = input.split('-');
            start = parseInt(s) - 1;
            end = parseInt(e);
        } else {
            start = parseInt(input) - 1;
            end = start + 1000;
        }
        
        // Validate and adjust bounds
        start = Math.max(0, start);
        end = Math.min(sequence.length, end);
        
        if (start >= end) {
            alert('Invalid position range');
            return;
        }
        
        this.genomeBrowser.currentPosition = { start, end };
        this.genomeBrowser.updateStatistics(currentChr, sequence);
        this.genomeBrowser.displayGenomeView(currentChr, sequence);
        // Update navigation bar
        this.genomeBrowser.genomeNavigationBar.update();
        
        // Update current tab title with new position
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, start + 1, end);
        }
    }

    // Search functionality
    showSearchModal() {
        const modal = document.getElementById('searchModal');
        if (modal) {
            modal.classList.add('show');
            document.getElementById('modalSearchInput').focus();
        }
    }

    showGotoModal() {
        const modal = document.getElementById('gotoModal');
        if (modal) {
            modal.classList.add('show');
            document.getElementById('modalPositionInput').focus();
        }
    }

    quickSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (query) {
            this.performSearch(query);
        }
    }

    performSearch(query = null) {
        const searchQuery = query || document.getElementById('modalSearchInput').value.trim();
        if (!searchQuery) return;
        
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
            alert('Please select a chromosome first');
            return;
        }
        
        // Clear previous search results before starting new search
        this.clearSearchResults();
        
        const sequence = this.genomeBrowser.currentSequence[currentChr];
        const caseSensitive = document.getElementById('caseSensitive')?.checked || false;
        const includeReverseComplement = document.getElementById('reverseComplement')?.checked || false;
        
        // Prepare search query based on case sensitivity
        const searchTerm = caseSensitive ? searchQuery : searchQuery.toUpperCase();
        const sequenceToSearch = caseSensitive ? sequence : sequence.toUpperCase();
        
        const results = [];
        
        // 1. Search for gene names in annotations
        if (this.genomeBrowser.currentAnnotations && this.genomeBrowser.currentAnnotations[currentChr]) {
            const annotations = this.genomeBrowser.currentAnnotations[currentChr];
            
            // Parse search terms - support OR operator
            const searchTerms = this.parseSearchQuery(searchTerm);
            
            annotations.forEach(annotation => {
                if (annotation.qualifiers) {
                    // Search in gene names
                    const geneName = annotation.qualifiers.gene || '';
                    const locusTag = annotation.qualifiers.locus_tag || '';
                    const product = annotation.qualifiers.product || '';
                    const note = annotation.qualifiers.note || '';
                    
                    const searchFields = [geneName, locusTag, product, note].join(' ');
                    const fieldToSearch = caseSensitive ? searchFields : searchFields.toUpperCase();
                    
                    // Check if any of the search terms match
                    const isMatch = searchTerms.some(term => fieldToSearch.includes(term));
                    
                    if (isMatch) {
                        // Find which term(s) matched for highlighting
                        const matchedTerms = searchTerms.filter(term => fieldToSearch.includes(term));
                        results.push({
                            type: 'gene',
                            position: annotation.start,
                            end: annotation.end,
                            name: geneName || locusTag || annotation.type,
                            details: `${annotation.type}: ${product || 'No description'}`,
                            annotation: annotation,
                            matchedTerms: matchedTerms
                        });
                    }
                }
            });
        }
        
        // 2. Search for exact sequence matches
        if (searchTerm.match(/^[ATGCN]+$/i)) { // Only search if it looks like a DNA sequence
            let index = sequenceToSearch.indexOf(searchTerm);
            while (index !== -1) {
                results.push({
                    type: 'sequence',
                    position: index,
                    end: index + searchTerm.length,
                    name: `Sequence match`,
                    details: `Found "${searchQuery}" at position ${index + 1}`
                });
                index = sequenceToSearch.indexOf(searchTerm, index + 1);
            }
            
            // 3. Search for reverse complement if requested
            if (includeReverseComplement && searchTerm.match(/^[ATGC]+$/i)) {
                const reverseComplement = this.getReverseComplement(searchTerm);
                const rcToSearch = caseSensitive ? reverseComplement : reverseComplement.toUpperCase();
                
                let rcIndex = sequenceToSearch.indexOf(rcToSearch);
                while (rcIndex !== -1) {
                    results.push({
                        type: 'sequence',
                        position: rcIndex,
                        end: rcIndex + rcToSearch.length,
                        name: `Reverse complement match`,
                        details: `Found reverse complement "${reverseComplement}" at position ${rcIndex + 1}`
                    });
                    rcIndex = sequenceToSearch.indexOf(rcToSearch, rcIndex + 1);
                }
            }
        }
        
        // Sort results by position
        results.sort((a, b) => a.position - b.position);
        
        // Store results for navigation
        this.searchResults = results;
        this.currentSearchIndex = 0;
        
        // Populate search results panel
        this.populateSearchResults(results, searchQuery);
        
        if (results.length > 0) {
            // Navigate to first result automatically
            this.navigateToSearchResult(0);
            
            // Show brief success message
            const searchTerms = this.parseSearchQuery(searchQuery);
            const termInfo = searchTerms.length > 1 ? ` (${searchTerms.length} terms searched)` : '';
            this.genomeBrowser.updateStatus(`Found ${results.length} match${results.length > 1 ? 'es' : ''} for "${searchQuery}"${termInfo}`);
        } else {
            const searchTerms = this.parseSearchQuery(searchQuery);
            let searchInfo = `No matches found for "${searchQuery}"`;
            if (searchTerms.length > 1) {
                searchInfo += ` (searched for ${searchTerms.length} terms: ${searchTerms.join(', ')})`;
            }
            if (includeReverseComplement && searchQuery.match(/^[ATGC]+$/i)) {
                const rc = this.getReverseComplement(searchQuery);
                searchInfo += ` (also searched for reverse complement: "${rc}")`;
            }
            this.genomeBrowser.updateStatus(searchInfo);
        }
        
        // Close modal if it was opened
        const modal = document.getElementById('searchModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    // Populate the search results panel
    populateSearchResults(results, searchQuery) {
        const searchResultsSection = document.getElementById('searchResultsSection');
        const searchResultsList = document.getElementById('searchResultsList');
        
        if (results.length === 0) {
            searchResultsList.innerHTML = '<p class="no-results">No search results</p>';
            searchResultsSection.style.display = 'none';
            // Restore original position when no results
            this.restoreSearchResultsPosition();
            return;
        }
        
        // Move search results panel to the top
        this.moveSearchResultsToTop();
        
        // Show the search results panel
        searchResultsSection.style.display = 'block';
        
        // Ensure sidebar is visible when showing search results
        this.genomeBrowser.uiManager.showSidebarIfHidden();
        
        // Update tab manager about search results panel state change
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.updateCurrentTabSidebarPanel('searchResultsSection', true, searchResultsSection.innerHTML);
        }
        
        // Create header
        let html = `<div class="search-results-header">Found ${results.length} match${results.length > 1 ? 'es' : ''} for "${searchQuery}"</div>`;
        
        // Create result items
        results.forEach((result, index) => {
            html += `
                <div class="search-result-item" data-index="${index}">
                    <div class="search-result-header">
                        <span class="search-result-name">${result.name}</span>
                        <span class="search-result-type ${result.type}">${result.type}</span>
                    </div>
                    <div class="search-result-position">Position: ${result.position + 1}-${result.end}</div>
                    <div class="search-result-details">${result.details}</div>
                </div>
            `;
        });
        
        searchResultsList.innerHTML = html;
        
        // Add click handlers for navigation
        searchResultsList.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.navigateToSearchResult(index);
                
                // Highlight selected result
                searchResultsList.querySelectorAll('.search-result-item').forEach(i => i.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
            });
        });
        
        // Highlight first result as selected
        const firstItem = searchResultsList.querySelector('.search-result-item');
        if (firstItem) {
            firstItem.classList.add('selected');
        }
        
        // Update tab manager with final search results content
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.updateCurrentTabSidebarPanel('searchResultsSection', true, searchResultsSection.innerHTML);
        }
    }

    // Navigate to a specific search result
    navigateToSearchResult(index) {
        if (!this.searchResults || index < 0 || index >= this.searchResults.length) return;
        
        const result = this.searchResults[index];
        const currentChr = document.getElementById('chromosomeSelect').value;
        const sequence = this.genomeBrowser.currentSequence[currentChr];
        
        // Calculate view range with context
        const start = Math.max(0, result.position - 500);
        const end = Math.min(sequence.length, result.end + 500);
        
        this.genomeBrowser.currentPosition = { start, end };
        this.genomeBrowser.updateStatistics(currentChr, sequence);
        this.genomeBrowser.displayGenomeView(currentChr, sequence);
        // Update navigation bar
        this.genomeBrowser.genomeNavigationBar.update();
        
        // Update current tab title with new position
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, start + 1, end);
        }
        
        this.currentSearchIndex = index;
        
        // Update status
        this.genomeBrowser.updateStatus(`Showing result ${index + 1} of ${this.searchResults.length}: ${result.name}`);
    }

    // Helper method to parse search query - supports OR operator
    parseSearchQuery(query) {
        // Check if query contains OR operator (case insensitive)
        if (query.toLowerCase().includes(' or ')) {
            // Split by OR operator and clean up terms
            return query.split(/\s+or\s+/i)
                .map(term => term.trim())
                .filter(term => term.length > 0);
        } else {
            // Single search term
            return [query];
        }
    }

    // Helper method to get reverse complement
    getReverseComplement(sequence) {
        // Use unified sequence processing implementation
        if (window.UnifiedSequenceProcessing) {
            const result = window.UnifiedSequenceProcessing.legacyReverseComplement(sequence);
            return result;
        }
        
        // Fallback to original implementation if unified module not available
        const complement = {
            'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G',
            'a': 't', 't': 'a', 'g': 'c', 'c': 'g',
            'N': 'N', 'n': 'n'
        };
        
        return sequence
            .split('')
            .reverse()
            .map(base => complement[base] || base)
            .join('');
    }

    handleDocumentMouseMove(e) {
        if (!this.dragState.isDragging) return;

        // Don't update if a splitter is being resized
        if (document.body.hasAttribute('data-splitter-resizing')) return;

        const { element, startX, chromosome, startPosition } = this.dragState;
        const deltaX = e.clientX - startX;

        // Check if we've moved enough to consider this a drag
        if (!this.dragState.hasDragged && Math.abs(deltaX) > 5) {
            this.dragState.hasDragged = true;
            console.log('🔧 [DRAG-MOVE] Drag started, threshold exceeded');
        }

        if (!this.dragState.hasDragged) return;

        this.dragState.lastUpdateX = e.clientX;

        const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
        const elementWidth = this.getEffectiveWidth(element);
        const sequence = this.genomeBrowser.currentSequence[chromosome];

        const positionChange = Math.round(deltaX * currentRange / elementWidth);

        const newStart = Math.max(0, Math.min(
            sequence.length - currentRange,
            startPosition - positionChange
        ));
        const newEnd = newStart + currentRange;

        // Store the calculated position
        this.dragState.lastCalculatedStart = newStart;

        // Debug output for move calculation
        console.log('🔧 [DRAG-MOVE] Movement calculation:');
        console.log('  - Mouse deltaX:', deltaX, 'px');
        console.log('  - Element width:', elementWidth, 'px');
        console.log('  - Current range:', currentRange, 'bp');
        console.log('  - Start position:', startPosition, 'bp');
        console.log('  - Position change:', positionChange, 'bp');
        console.log('  - Raw new start (before bounds):', startPosition - positionChange, 'bp');
        console.log('  - Bounded new start:', newStart, 'bp');
        console.log('  - New end:', newEnd, 'bp');
        console.log('  - Movement ratio:', (deltaX / elementWidth).toFixed(4), 'px/px');
        console.log('  - Genome movement:', (newStart - startPosition), 'bp');

        // Update the visual representation
        this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
        
        if (this.globalDraggingEnabled) {
            // Update all tracks during drag when global dragging is enabled
            this.performGlobalDragUpdate(deltaX, chromosome);
        } else {
            // Only update the current track (default behavior)
            this.performVisualDragUpdate(deltaX, element);
        }
        
        if (this.genomeBrowser.genomeNavigationBar) {
            this.genomeBrowser.genomeNavigationBar.update();
        }
        
        // Update detailed rulers during drag for real-time position display
        this.updateDetailedRulers();
        
        // Show real-time position feedback during drag
        this.showDragPositionFeedback(newStart, newEnd, chromosome);
    }

    handleDocumentMouseUp(e) {
        if (!this.dragState.isDragging) return;

        const { element, hasDragged, chromosome, startPosition, startX } = this.dragState;

        console.log('🔧 [DRAG-END] === DRAG ENDING ===');
        console.log('🔧 [DRAG-END] hasDragged:', hasDragged);
        console.log('🔧 [DRAG-END] Total mouse movement:', e.clientX - startX, 'px');

        // Immediately reset dragging state
        this.dragState.isDragging = false;
        
        element.style.cursor = 'grab';
        element.classList.remove('dragging');
        document.body.style.userSelect = '';
        
        if (this.globalDraggingEnabled) {
            // Reset all tracks when global dragging is enabled
            this.resetGlobalVisualDragUpdates();
        } else {
            // Only reset the dragged element (default behavior)
            this.resetVisualDragUpdates(element);
        }
        
        // Reset Canvas transform tracking flag after drag operations are complete
        this.dragState.canvasTransformsApplied = false;
        
        // Clean up global drag update timeout if it exists
        if (this.globalDragUpdateTimeout) {
            clearTimeout(this.globalDragUpdateTimeout);
            this.globalDragUpdateTimeout = null;
        }

        // Dispatch custom drag end event immediately after resetting state
        document.dispatchEvent(new CustomEvent('genomeViewDragEnd', {
            detail: { 
                chromosome, 
                element, 
                hasDragged,
                finalPosition: this.genomeBrowser.currentPosition 
            }
        }));
        console.log('🔧 [DRAG-END] genomeViewDragEnd event dispatched with details:', {
            chromosome,
            hasDragged,
            finalPosition: this.genomeBrowser.currentPosition
        });

        if (!hasDragged) {
            this.dragState.hasDragged = false;
            console.log('🔧 [DRAG-END] No significant drag detected, no position change');
            return;
        }
        this.dragState.hasDragged = false;
        
        // Use the last calculated position as the final position
        const finalNewStart = this.dragState.lastCalculatedStart;
        const sequence = this.genomeBrowser.currentSequence[chromosome];
        const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
        const finalNewEnd = finalNewStart + currentRange;
        
        // Debug output for final position
        console.log('🔧 [DRAG-END] Final position calculation:');
        console.log('  - Original start position:', startPosition, 'bp');
        console.log('  - Last calculated start (from move):', finalNewStart, 'bp');
        console.log('  - Final calculated end:', finalNewEnd, 'bp');
        console.log('  - Total genome movement:', finalNewStart - startPosition, 'bp');
        console.log('  - Current range:', currentRange, 'bp');
        console.log('  - Sequence length:', sequence.length, 'bp');
        
        // Verify consistency with drag movement
        const totalMouseDelta = e.clientX - startX;
        const elementWidth = this.getEffectiveWidth(element);
        const expectedPositionChange = Math.round(totalMouseDelta * currentRange / elementWidth);
        const expectedNewStart = Math.max(0, Math.min(
            sequence.length - currentRange,
            startPosition - expectedPositionChange
        ));
        
        console.log('🔧 [DRAG-END] Consistency check:');
        console.log('  - Expected position change (recalculated):', expectedPositionChange, 'bp');
        console.log('  - Expected new start (recalculated):', expectedNewStart, 'bp');
        console.log('  - Actual new start (from last move):', finalNewStart, 'bp');
        console.log('  - Difference:', Math.abs(expectedNewStart - finalNewStart), 'bp');
        console.log('  - Match:', expectedNewStart === finalNewStart ? '✅ CONSISTENT' : '❌ MISMATCH');
        
        // Set the position before re-render
        const positionBeforeRender = { ...this.genomeBrowser.currentPosition };
        this.genomeBrowser.currentPosition = { start: finalNewStart, end: finalNewEnd };
        
        console.log('🔧 [DRAG-END] Position update:');
        console.log('  - Position before render:', positionBeforeRender);
        console.log('  - Position after update:', this.genomeBrowser.currentPosition);
        
        // Trigger a full re-render with the definitive new position
        console.log('🔧 [DRAG-END] Starting re-render...');
        this.genomeBrowser.updateStatistics(chromosome, sequence);
        this.genomeBrowser.displayGenomeView(chromosome, sequence);
        this.genomeBrowser.genomeNavigationBar.update();
        
        // Update current tab title with new position
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.updateCurrentTabPosition(chromosome, finalNewStart + 1, finalNewEnd);
        }
        
        // Update all detailed rulers after re-render (force update for final position)
        this.updateDetailedRulers(true);
        
        // Hide drag position feedback with delay
        setTimeout(() => this.hideDragPositionFeedback(), 1000);
        
        console.log('🔧 [DRAG-END] Re-render completed');
        console.log('🔧 [DRAG-END] Final position after render:', this.genomeBrowser.currentPosition);
    }

    // Show real-time position feedback during drag
    showDragPositionFeedback(start, end, chromosome) {
        // Remove existing feedback tooltip if any
        let tooltip = document.getElementById('drag-position-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'drag-position-tooltip';
            tooltip.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                z-index: 10000;
                pointer-events: none;
                white-space: nowrap;
            `;
            document.body.appendChild(tooltip);
        }
        
        // Format position with commas for readability
        const formatPosition = (pos) => (pos + 1).toLocaleString();
        const range = end - start;
        
        tooltip.innerHTML = `
            <div><strong>${chromosome}</strong></div>
            <div>${formatPosition(start)} - ${formatPosition(end)}</div>
            <div>Range: ${range.toLocaleString()} bp</div>
        `;
        
        // Auto-hide after drag ends
        if (!this.dragState.isDragging) {
            setTimeout(() => {
                if (tooltip && tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
            }, 1000);
        }
    }
    
    // Hide drag position feedback
    hideDragPositionFeedback() {
        const tooltip = document.getElementById('drag-position-tooltip');
        if (tooltip && tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
        }
    }

    // Update all detailed rulers to reflect the new position (with throttling)
    updateDetailedRulers(forceUpdate = false) {
        const now = performance.now();
        
        // Use throttling during drag operations to maintain performance
        if (!forceUpdate && this.dragState.isDragging) {
            if (now - this.rulerUpdateThrottle.lastUpdateTime < this.rulerUpdateThrottle.updateInterval) {
                // Schedule update if not already pending
                if (!this.rulerUpdateThrottle.pendingUpdate) {
                    this.rulerUpdateThrottle.pendingUpdate = true;
                    requestAnimationFrame(() => {
                        this.updateDetailedRulers(true);
                        this.rulerUpdateThrottle.pendingUpdate = false;
                    });
                }
                return;
            }
        }
        
        this.rulerUpdateThrottle.lastUpdateTime = now;
        
        const detailedRulers = document.querySelectorAll('.detailed-ruler-container');
        console.log('🔧 [RULER-UPDATE] Found', detailedRulers.length, 'detailed rulers to update');
        
        detailedRulers.forEach((rulerContainer, index) => {
            if (rulerContainer._setupCanvas && typeof rulerContainer._setupCanvas === 'function') {
                console.log('🔧 [RULER-UPDATE] Updating detailed ruler', index + 1);
                try {
                    rulerContainer._setupCanvas();
                } catch (error) {
                    console.warn('🔧 [RULER-UPDATE] Error updating detailed ruler', index + 1, ':', error);
                }
            } else {
                console.warn('🔧 [RULER-UPDATE] No _setupCanvas function found for detailed ruler', index + 1);
            }
        });
    }

    // Draggable functionality for tracks
    makeDraggable(element, chromosome) {
        element.style.cursor = 'grab';
        element.title = 'Drag left or right to navigate through the genome\nKeyboard: ← → arrows, Home, End';

        const handleMouseDown = (e) => {
            if (e.button !== 0) return;
            if (document.body.hasAttribute('data-splitter-resizing')) return;

            // Initialize centralized drag state
            Object.assign(this.dragState, {
                isDragging: true,
                hasDragged: false,
                element: element,
                chromosome: chromosome,
                startX: e.clientX,
                startPosition: this.genomeBrowser.currentPosition.start,
                lastCalculatedStart: this.genomeBrowser.currentPosition.start,
                canvasTransformsApplied: false, // Reset Canvas transform tracking for new drag
            });
            
            element.style.cursor = 'grabbing';
            element.classList.add('dragging');
            
            if (this.globalDraggingEnabled) {
                // Cache transforms for all tracks when global dragging is enabled
                this.cacheAllTrackTransforms();
            } else {
                // Only cache the dragged element (default behavior)
                this.cacheOriginalTransforms(element);
            }
            
            document.body.style.userSelect = 'none';
            
            // Dispatch custom drag start event for performance optimization
            document.dispatchEvent(new CustomEvent('genomeViewDragStart', {
                detail: { chromosome, element }
            }));
            
            e.preventDefault();
        };

        // Cleanup previous listener if any, then add the new one
        if (element._handleDragMouseDown) {
            element.removeEventListener('mousedown', element._handleDragMouseDown);
        }
        element.addEventListener('mousedown', handleMouseDown);
        element._handleDragMouseDown = handleMouseDown;

        // Add keyboard navigation
        element.setAttribute('tabindex', '0');
        element.addEventListener('keydown', (e) => {
            const sequence = this.genomeBrowser.currentSequence[chromosome];
            const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
            const step = Math.max(1, Math.floor(currentRange * 0.1));

            let newStart = this.genomeBrowser.currentPosition.start;
            
            switch(e.key) {
                case 'ArrowLeft':
                    newStart = Math.max(0, this.genomeBrowser.currentPosition.start - step);
                    break;
                case 'ArrowRight':
                    newStart = Math.min(sequence.length - currentRange, this.genomeBrowser.currentPosition.start + step);
                    break;
                case 'Home':
                    newStart = 0;
                    break;
                case 'End':
                    newStart = Math.max(0, sequence.length - currentRange);
                    break;
                default:
                    return;
            }
            
            e.preventDefault();
            
            const newEnd = newStart + currentRange;
            this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
            this.genomeBrowser.updateStatistics(chromosome, sequence);
            this.genomeBrowser.displayGenomeView(chromosome, sequence);
            this.genomeBrowser.genomeNavigationBar.update();
            
            // Update current tab title with new position
            if (this.genomeBrowser.tabManager) {
                this.genomeBrowser.tabManager.updateCurrentTabPosition(chromosome, newStart + 1, newEnd);
            }
        });
    }

    getEffectiveWidth(element) {
        if (!element) return 800;
        
        let width = 0;
        let method = 'none';

        // Find the track-content element first (this is what SVG uses as containerWidth)
        let trackContent = null;
        if (element.classList.contains('track-content')) {
            trackContent = element;
        } else {
            trackContent = element.querySelector('.track-content');
        }
        
        // Use the SAME width calculation method as SVG containerWidth in TrackRenderer
        if (trackContent) {
            trackContent.style.width = '100%'; // Force layout calculation like in renderGeneElementsSVG
            width = trackContent.getBoundingClientRect().width || trackContent.offsetWidth;
            method = 'track-content.getBoundingClientRect (matching SVG)';
        }
        
        // Fallback methods if track-content not found
        if (!width) {
            const svg = element.querySelector('.genes-svg-container svg');
            if (svg) {
                const viewBox = svg.getAttribute('viewBox');
                if (viewBox) {
                    const viewBoxParts = viewBox.split(' ');
                    if (viewBoxParts.length >= 3) {
                        width = parseFloat(viewBoxParts[2]); // Extract width from viewBox
                        method = 'svg.viewBox.width (exact match)';
                    }
                }
                
                if (!width) {
                    width = svg.getBoundingClientRect().width;
                    method = 'svg.boundingClientRect';
                }
            }
        }

        if (!width) {
            width = element.offsetWidth;
            method = 'element.offsetWidth';
        }

        const finalWidth = width || 800; // Fallback to 800 if all else fails
        
        // Additional debug info to compare with SVG containerWidth
        if (trackContent) {
            const svgContainer = trackContent.querySelector('.genes-svg-container');
            if (svgContainer) {
                const svgViewBox = svgContainer.getAttribute('viewBox');
                console.log('🔧 [DRAG-WIDTH] Effective width:', finalWidth, 'px (method:', method + ')');
                console.log('🔧 [DRAG-WIDTH] SVG viewBox for comparison:', svgViewBox);
                
                if (svgViewBox) {
                    const svgWidth = parseFloat(svgViewBox.split(' ')[2]);
                    console.log('🔧 [DRAG-WIDTH] SVG containerWidth (should match):', svgWidth, 'px');
                    console.log('🔧 [DRAG-WIDTH] Width consistency:', Math.abs(finalWidth - svgWidth) < 1 ? '✅ CONSISTENT' : '❌ MISMATCH');
                }
            }
        } else {
            console.log('🔧 [DRAG-WIDTH] Effective width:', finalWidth, 'px (method:', method + ')');
        }
        
        return finalWidth;
    }

    /**
     * Perform lightweight visual updates during dragging
     * Uses unified container approach for consistent movement
     */
    performVisualDragUpdate(deltaX, element) {
        // Only apply Canvas drag transforms when global dragging is enabled
        // Single-line sequence tracks should follow global dragging setting
        if (this.globalDraggingEnabled && this.genomeBrowser.trackRenderer && this.genomeBrowser.trackRenderer.applyCanvasDragTransform) {
            this.genomeBrowser.trackRenderer.applyCanvasDragTransform(deltaX, 0);
            this.dragState.canvasTransformsApplied = true;
            console.log('🎨 [VISUAL-DRAG] Applied Canvas drag transforms (global dragging enabled)');
        }
        
        // Try to find the unified gene container first
        const unifiedContainer = document.querySelector('.unified-gene-container');
        
        if (unifiedContainer) {
            // Apply transform to the unified container only
            const baseTransform = unifiedContainer.dataset.baseTransform || '';
            
            if (baseTransform) {
                unifiedContainer.style.transform = `${baseTransform} translateX(${deltaX}px)`;
            } else {
                unifiedContainer.style.transform = `translateX(${deltaX}px)`;
            }
            
            // Debug output for unified visual updates
            console.log('🔧 [DRAG-VISUAL] Unified container update:');
            console.log('  - deltaX applied:', deltaX, 'px');
            console.log('  - Base transform:', baseTransform || 'none');
            console.log('  - Final transform:', unifiedContainer.style.transform);
            
        } else {
            // Fallback to individual element updates
            const allElements = document.querySelectorAll('[data-base-transform]');
            
            console.log('🔧 [DRAG-VISUAL] Fallback individual element update:');
            console.log('  - deltaX applied:', deltaX, 'px');
            console.log('  - Elements to update:', allElements.length);
            
            let htmlElementsUpdated = 0;
            let svgElementsUpdated = 0;
            
            allElements.forEach(el => {
                const baseTransform = el.dataset.baseTransform || '';
                const isHTMLElement = el.classList.contains('gene-element');
                const isSVGElement = el.tagName === 'svg' || el.tagName === 'g' || el.classList.contains('svg-gene-element');
                
                if (isHTMLElement) {
                    // HTML elements: use style.transform
                    if (baseTransform) {
                        el.style.transform = `${baseTransform} translateX(${deltaX}px)`;
                    } else {
                        el.style.transform = `translateX(${deltaX}px)`;
                    }
                    htmlElementsUpdated++;
                } else if (isSVGElement) {
                    // SVG elements: only use transform attribute, never style.transform
                    if (baseTransform) {
                        el.setAttribute('transform', `${baseTransform} translate(${deltaX}, 0)`);
                    } else {
                        el.setAttribute('transform', `translate(${deltaX}, 0)`);
                    }
                    svgElementsUpdated++;
                }
            });
            
            console.log('🔧 [DRAG-VISUAL] Update summary:');
            console.log('  - HTML elements updated:', htmlElementsUpdated);
            console.log('  - SVG elements updated:', svgElementsUpdated);
        }
        
        // Add visual feedback class
        element.classList.add('visual-dragging');
    }

    // Perform global drag update - applies visual transforms to all tracks (no redraw during drag)
    performGlobalDragUpdate(deltaX, chromosome) {
        console.log('🌍 [GLOBAL-DRAG] Applying visual transforms to all tracks with deltaX:', deltaX, 'px');
        
        // Apply Canvas drag transforms for high-performance sequence tracks
        if (this.genomeBrowser.trackRenderer && this.genomeBrowser.trackRenderer.applyCanvasDragTransform) {
            this.genomeBrowser.trackRenderer.applyCanvasDragTransform(deltaX, 0);
            this.dragState.canvasTransformsApplied = true;
            console.log('🎨 [GLOBAL-DRAG] Applied Canvas drag transforms');
        }
        
        // Handle genes & features track specially to match single-track behavior
        const unifiedContainer = document.querySelector('.unified-gene-container');
        let tracksUpdated = 0;
        
        if (unifiedContainer) {
            // For genes & features, use the same logic as performVisualDragUpdate
            this.cacheTrackTransform(unifiedContainer);
            const baseTransform = unifiedContainer.dataset.baseTransform || '';
            
            if (baseTransform) {
                unifiedContainer.style.transform = `${baseTransform} translateX(${deltaX}px)`;
            } else {
                unifiedContainer.style.transform = `translateX(${deltaX}px)`;
            }
            
            unifiedContainer.classList.add('visual-dragging');
            tracksUpdated++;
            console.log('🌍 [GLOBAL-DRAG] Applied unified container transform for genes & features');
        } else {
            // Fallback: handle genes & features elements individually
            const geneElements = document.querySelectorAll('[data-base-transform]');
            geneElements.forEach(el => {
                const baseTransform = el.dataset.baseTransform || '';
                const isHTMLElement = el.classList.contains('gene-element');
                const isSVGElement = el.tagName === 'svg' || el.tagName === 'g' || el.classList.contains('svg-gene-element');
                
                if (isHTMLElement) {
                    // HTML elements: use style.transform
                    if (baseTransform) {
                        el.style.transform = `${baseTransform} translateX(${deltaX}px)`;
                    } else {
                        el.style.transform = `translateX(${deltaX}px)`;
                    }
                    el.classList.add('visual-dragging');
                    tracksUpdated++;
                } else if (isSVGElement) {
                    // SVG elements: use SVG transform attribute (same as single-track mode)
                    if (baseTransform) {
                        el.setAttribute('transform', `${baseTransform} translate(${deltaX}, 0)`);
                    } else {
                        el.setAttribute('transform', `translate(${deltaX}, 0)`);
                    }
                    el.classList.add('visual-dragging');
                    tracksUpdated++;
                }
            });
            console.log('🌍 [GLOBAL-DRAG] Applied individual transforms for genes & features elements');
        }
        
        // Handle all other tracks (non-genes) with regular track-content approach
        const allTrackContents = document.querySelectorAll('.track-content');
        allTrackContents.forEach(trackContent => {
            const track = trackContent.closest('[class*="-track"]');
            if (!track) return;
            
            // Skip genes & features track since we handled it above
            if (track.classList.contains('genes-track') || 
                trackContent.querySelector('.unified-gene-container') ||
                trackContent.querySelector('.genes-svg-container')) {
                return;
            }
            
            // Cache the original transform if not already cached
            this.cacheTrackTransform(trackContent);
            
            // Apply visual transform to the track content
            const baseTransform = trackContent.dataset.baseTransform || '';
            if (baseTransform) {
                trackContent.style.transform = `${baseTransform} translateX(${deltaX}px)`;
            } else {
                trackContent.style.transform = `translateX(${deltaX}px)`;
            }
            
            // Add visual feedback class
            trackContent.classList.add('visual-dragging');
            tracksUpdated++;
        });
        
        // Handle other specialized SVG containers (but not genes-svg-container)
        const otherSvgContainers = document.querySelectorAll('.gc-svg-container, .variant-svg-container');
        otherSvgContainers.forEach(svgContainer => {
            this.cacheTrackTransform(svgContainer);
            
            const baseTransform = svgContainer.dataset.baseTransform || '';
            if (baseTransform) {
                svgContainer.style.transform = `${baseTransform} translateX(${deltaX}px)`;
            } else {
                svgContainer.style.transform = `translateX(${deltaX}px)`;
            }
            
            svgContainer.classList.add('visual-dragging');
            tracksUpdated++;
        });
        
        console.log('🌍 [GLOBAL-DRAG] Visual transforms applied to', tracksUpdated, 'track elements');
    }

    // Cache transform for a single track element
    cacheTrackTransform(element) {
        if (!element.dataset.baseTransform) {
            const originalTransform = element.style.transform || '';
            element.dataset.baseTransform = originalTransform;
            console.log('🔧 [CACHE] Cached transform for element:', element.className, 'Transform:', originalTransform);
        }
    }

    // Reset visual transforms for all tracks (global dragging)
    resetGlobalVisualDragUpdates() {
        console.log('🌍 [GLOBAL-RESET] Resetting visual transforms for all tracks');
        
        // Only reset Canvas drag transforms if they were actually applied during this drag
        if (this.dragState.canvasTransformsApplied && this.genomeBrowser.trackRenderer && this.genomeBrowser.trackRenderer.resetCanvasDragTransforms) {
            this.genomeBrowser.trackRenderer.resetCanvasDragTransforms();
            console.log('🎨 [GLOBAL-RESET] Reset Canvas drag transforms');
        }
        
        // Reset genes & features track specially to match single-track behavior
        const unifiedContainer = document.querySelector('.unified-gene-container');
        let tracksReset = 0;
        
        if (unifiedContainer) {
            // For genes & features, use the same reset logic as resetVisualDragUpdates
            const baseTransform = unifiedContainer.dataset.baseTransform || '';
            unifiedContainer.style.transform = baseTransform;
            unifiedContainer.classList.remove('visual-dragging');
            tracksReset++;
            console.log('🌍 [GLOBAL-RESET] Reset unified container transform for genes & features');
        } else {
            // Fallback: reset genes & features elements individually
            const geneElements = document.querySelectorAll('[data-base-transform]');
            geneElements.forEach(el => {
                const baseTransform = el.dataset.baseTransform || '';
                const isHTMLElement = el.classList.contains('gene-element');
                const isSVGElement = el.tagName === 'svg' || el.tagName === 'g' || el.classList.contains('svg-gene-element');
                
                if (isHTMLElement) {
                    // HTML elements: reset style.transform
                    el.style.transform = baseTransform;
                    el.classList.remove('visual-dragging');
                    tracksReset++;
                } else if (isSVGElement) {
                    // SVG elements: reset transform attribute
                    if (baseTransform) {
                        el.setAttribute('transform', baseTransform);
                    } else {
                        el.removeAttribute('transform');
                    }
                    el.classList.remove('visual-dragging');
                    tracksReset++;
                }
            });
            console.log('🌍 [GLOBAL-RESET] Reset individual transforms for genes & features elements');
        }
        
        // Reset all other tracks (non-genes) with regular track-content approach
        const allTrackContents = document.querySelectorAll('.track-content');
        allTrackContents.forEach(trackContent => {
            const track = trackContent.closest('[class*="-track"]');
            if (!track) return;
            
            // Skip genes & features track since we handled it above
            if (track.classList.contains('genes-track') || 
                trackContent.querySelector('.unified-gene-container') ||
                trackContent.querySelector('.genes-svg-container')) {
                return;
            }
            
            const baseTransform = trackContent.dataset.baseTransform || '';
            trackContent.style.transform = baseTransform;
            trackContent.classList.remove('visual-dragging');
            tracksReset++;
        });
        
        // Reset other specialized SVG containers (but not genes-svg-container)
        const otherSvgContainers = document.querySelectorAll('.gc-svg-container, .variant-svg-container');
        otherSvgContainers.forEach(svgContainer => {
            const baseTransform = svgContainer.dataset.baseTransform || '';
            svgContainer.style.transform = baseTransform;
            svgContainer.classList.remove('visual-dragging');
            tracksReset++;
        });
        
        console.log('🌍 [GLOBAL-RESET] Reset transforms for', tracksReset, 'track elements');
    }

    // Cache transforms for all tracks (global dragging)
    cacheAllTrackTransforms() {
        console.log('🌍 [GLOBAL-CACHE] Caching transforms for all tracks');
        
        // Cache genes & features track specially to match single-track behavior
        const unifiedContainer = document.querySelector('.unified-gene-container');
        
        if (unifiedContainer) {
            // For genes & features, use the same caching logic as cacheOriginalTransforms
            this.cacheTrackTransform(unifiedContainer);
            console.log('🌍 [GLOBAL-CACHE] Cached unified container transform for genes & features');
        } else {
            // Fallback: cache genes & features elements individually
            const geneElements = document.querySelectorAll('[data-base-transform]');
            geneElements.forEach(el => {
                this.cacheTrackTransform(el);
            });
            console.log('🌍 [GLOBAL-CACHE] Cached individual transforms for genes & features elements');
        }
        
        // Cache all other tracks (non-genes) with regular track-content approach
        const allTrackContents = document.querySelectorAll('.track-content');
        allTrackContents.forEach(trackContent => {
            const track = trackContent.closest('[class*="-track"]');
            if (!track) return;
            
            // Skip genes & features track since we handled it above
            if (track.classList.contains('genes-track') || 
                trackContent.querySelector('.unified-gene-container') ||
                trackContent.querySelector('.genes-svg-container')) {
                return;
            }
            
            this.cacheTrackTransform(trackContent);
        });
        
        // Cache other specialized SVG containers (but not genes-svg-container)
        const otherSvgContainers = document.querySelectorAll('.gc-svg-container, .variant-svg-container');
        otherSvgContainers.forEach(svgContainer => {
            this.cacheTrackTransform(svgContainer);
        });
        
        console.log('🌍 [GLOBAL-CACHE] Cached transforms for all track elements');
    }

        /**
     * Cache original transforms before dragging starts
     */
    cacheOriginalTransforms(element) {
        // Find the unified gene container or fall back to individual elements
        const unifiedContainer = document.querySelector('.unified-gene-container');
        
        if (unifiedContainer) {
            // Cache transform for the unified container only
            console.log('🔧 [DRAG] Caching transform for unified container');
            const originalTransform = unifiedContainer.style.transform || '';
            unifiedContainer.dataset.baseTransform = originalTransform;
            console.log('🔧 [DRAG] Cached unified container transform:', originalTransform);
        } else {
            // Fallback to individual elements for backward compatibility
            const geneElements = document.querySelectorAll('.gene-element, .svg-gene-element, .genes-svg-container');
            
            console.log('🔧 [DRAG] Caching transforms for', geneElements.length, 'individual elements');
            
            geneElements.forEach(el => {
                const isHTMLElement = el.classList.contains('gene-element');
                const isSVGElement = el.tagName === 'svg' || el.tagName === 'g' || el.classList.contains('svg-gene-element');
                
                if (isHTMLElement) {
                    // Cache HTML element's style.transform
                    const originalTransform = el.style.transform || '';
                    el.dataset.baseTransform = originalTransform;
                    console.log('🔧 [DRAG] Cached HTML transform:', el.className, '-> "' + originalTransform + '"');
                } else if (isSVGElement) {
                    // Cache SVG element's transform attribute
                    const originalTransform = el.getAttribute('transform') || '';
                    el.dataset.baseTransform = originalTransform;
                    console.log('🔧 [DRAG] Cached SVG transform:', el.tagName, '-> "' + originalTransform + '"');
                }
            });
        }
    }

    /**
     * Reset visual transforms after drag ends
     */
    resetVisualDragUpdates(element) {
        // Only reset Canvas drag transforms if they were actually applied during this drag
        if (this.dragState.canvasTransformsApplied && this.genomeBrowser.trackRenderer && this.genomeBrowser.trackRenderer.resetCanvasDragTransforms) {
            this.genomeBrowser.trackRenderer.resetCanvasDragTransforms();
            console.log('🎨 [DRAG-RESET] Reset Canvas drag transforms');
        }
        
        // Try to find the unified gene container first
        const unifiedContainer = document.querySelector('.unified-gene-container');
        
        if (unifiedContainer) {
            // Reset the unified container only
            const baseTransform = unifiedContainer.dataset.baseTransform || '';
            unifiedContainer.style.transform = baseTransform;
            
            // Clean up cache
            delete unifiedContainer.dataset.baseTransform;
            
            console.log('🔧 [DRAG-RESET] Unified container reset:');
            console.log('  - Restored transform:', baseTransform || 'none');
        } else {
            // Fallback to individual element reset
            const cachedElements = document.querySelectorAll('[data-base-transform]');
            
            console.log('🔧 [DRAG-RESET] Fallback individual element reset:');
            console.log('  - Elements to reset:', cachedElements.length);
            
            let htmlElementsReset = 0;
            let svgElementsReset = 0;
            
            cachedElements.forEach(el => {
                const baseTransform = el.dataset.baseTransform || '';
                const isHTMLElement = el.classList.contains('gene-element');
                const isSVGElement = el.tagName === 'svg' || el.tagName === 'g' || el.classList.contains('svg-gene-element');
                
                if (isHTMLElement) {
                    // Restore HTML element's style.transform
                    el.style.transform = baseTransform;
                    htmlElementsReset++;
                    console.log('🔧 [DRAG-RESET] HTML element reset:', el.className, '-> "' + baseTransform + '"');
                } else if (isSVGElement) {
                    // Restore SVG element's transform attribute
                    el.setAttribute('transform', baseTransform);
                    svgElementsReset++;
                    console.log('🔧 [DRAG-RESET] SVG element reset:', el.tagName, '-> "' + baseTransform + '"');
                }
                
                // Clean up cache
                delete el.dataset.baseTransform;
            });

            console.log('🔧 [DRAG-RESET] Reset summary:');
            console.log('  - HTML elements reset:', htmlElementsReset);
            console.log('  - SVG elements reset:', svgElementsReset);
        }

        // Remove visual feedback class
        element.classList.remove('visual-dragging');
        console.log('🔧 [DRAG-RESET] Transform reset completed');
    }

    // Method to move Search Results panel to the top
    moveSearchResultsToTop() {
        const searchResultsSection = document.getElementById('searchResultsSection');
        const sidebar = document.getElementById('sidebar');
        
        if (!searchResultsSection || !sidebar) return;
        
        // Store the original position if not already stored
        if (!this.searchResultsOriginalPosition) {
            // Find the next sibling to know where to restore it
            this.searchResultsOriginalPosition = {
                nextSibling: searchResultsSection.nextElementSibling,
                parent: searchResultsSection.parentElement
            };
        }
        
        // Move to the top (first child of sidebar)
        sidebar.insertBefore(searchResultsSection, sidebar.firstElementChild);
    }

    // Method to restore Search Results panel to its original position
    restoreSearchResultsPosition() {
        const searchResultsSection = document.getElementById('searchResultsSection');
        
        if (!searchResultsSection || !this.searchResultsOriginalPosition) return;
        
        const { nextSibling, parent } = this.searchResultsOriginalPosition;
        
        // Restore to original position
        if (nextSibling && nextSibling.parentElement === parent) {
            parent.insertBefore(searchResultsSection, nextSibling);
        } else {
            // If nextSibling doesn't exist, append to the end
            parent.appendChild(searchResultsSection);
        }
    }

    // Method to clear search results and restore position
    clearSearchResults() {
        const searchResultsSection = document.getElementById('searchResultsSection');
        const searchResultsList = document.getElementById('searchResultsList');
        
        if (searchResultsSection) {
            searchResultsSection.style.display = 'none';
        }
        
        // Update tab manager about search results panel state change
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.updateCurrentTabSidebarPanel('searchResultsSection', false, null);
        }
        
        if (searchResultsList) {
            searchResultsList.innerHTML = '<p class="no-results">No search results</p>';
        }
        
        // Restore original position
        this.restoreSearchResultsPosition();
        
        // Clear search results array
        this.searchResults = [];
        this.currentSearchIndex = 0;
    }

    // Set global dragging behavior
    setGlobalDragging(enabled) {
        this.globalDraggingEnabled = enabled;
        console.log(`🎯 NavigationManager: Global dragging ${enabled ? 'enabled' : 'disabled'}`);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationManager;
} 