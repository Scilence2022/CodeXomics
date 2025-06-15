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
        };

        // Bind methods and add global listeners once
        this.handleDocumentMouseMove = this.handleDocumentMouseMove.bind(this);
        this.handleDocumentMouseUp = this.handleDocumentMouseUp.bind(this);
        document.addEventListener('mousemove', this.handleDocumentMouseMove);
        document.addEventListener('mouseup', this.handleDocumentMouseUp);
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
            
            annotations.forEach(annotation => {
                if (annotation.qualifiers) {
                    // Search in gene names
                    const geneName = annotation.qualifiers.gene || '';
                    const locusTag = annotation.qualifiers.locus_tag || '';
                    const product = annotation.qualifiers.product || '';
                    const note = annotation.qualifiers.note || '';
                    
                    const searchFields = [geneName, locusTag, product, note].join(' ');
                    const fieldToSearch = caseSensitive ? searchFields : searchFields.toUpperCase();
                    
                    if (fieldToSearch.includes(searchTerm)) {
                        results.push({
                            type: 'gene',
                            position: annotation.start,
                            end: annotation.end,
                            name: geneName || locusTag || annotation.type,
                            details: `${annotation.type}: ${product || 'No description'}`,
                            annotation: annotation
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
            this.genomeBrowser.updateStatus(`Found ${results.length} match${results.length > 1 ? 'es' : ''} for "${searchQuery}"`);
        } else {
            let searchInfo = `No matches found for "${searchQuery}"`;
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
        
        this.currentSearchIndex = index;
        
        // Update status
        this.genomeBrowser.updateStatus(`Showing result ${index + 1} of ${this.searchResults.length}: ${result.name}`);
    }

    // Helper method to get reverse complement
    getReverseComplement(sequence) {
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

        // Update the visual representation
        this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
        this.performVisualDragUpdate(deltaX, element);
        
        if (this.genomeBrowser.genomeNavigationBar) {
            this.genomeBrowser.genomeNavigationBar.update();
        }
    }

    handleDocumentMouseUp(e) {
        if (!this.dragState.isDragging) return;

        const { element, hasDragged, chromosome } = this.dragState;

        // Immediately reset dragging state
        this.dragState.isDragging = false;
        
        element.style.cursor = 'grab';
        element.classList.remove('dragging');
        document.body.style.userSelect = '';
        
        this.resetVisualDragUpdates(element);

        if (!hasDragged) {
            this.dragState.hasDragged = false;
            return;
        }
        this.dragState.hasDragged = false;
        
        // Use the last calculated position as the final position
        const finalNewStart = this.dragState.lastCalculatedStart;
        const sequence = this.genomeBrowser.currentSequence[chromosome];
        const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
        const finalNewEnd = finalNewStart + currentRange;
        
        this.genomeBrowser.currentPosition = { start: finalNewStart, end: finalNewEnd };
        
        // Trigger a full re-render with the definitive new position
        this.genomeBrowser.updateStatistics(chromosome, sequence);
        this.genomeBrowser.displayGenomeView(chromosome, sequence);
        this.genomeBrowser.genomeNavigationBar.update();
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
            });
            
            element.style.cursor = 'grabbing';
            element.classList.add('dragging');
            
            this.cacheOriginalTransforms(element);
            
            document.body.style.userSelect = 'none';
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
        });
    }

    getEffectiveWidth(element) {
        if (!element) return 800;
        
        let width = 0;
        let method = 'none';

        if (element.classList.contains('track-content')) {
            width = element.getBoundingClientRect().width || element.offsetWidth;
            method = 'element.track-content';
        } else {
            const tc = element.querySelector('.track-content');
            if (tc) {
                width = tc.getBoundingClientRect().width || tc.offsetWidth;
                method = 'inner.track-content';
            }
        }
        
        if (!width) {
            const svg = element.querySelector('.genes-svg-container svg');
            if (svg) {
                const wAttr = parseFloat(svg.getAttribute('width'));
                if (!isNaN(wAttr) && wAttr > 0) {
                    width = wAttr;
                    method = 'svg.width.attribute';
                } else {
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
        console.log(`[Drag] Effective width: ${finalWidth}px (method: ${method})`);
        return finalWidth;
    }

    /**
     * Perform lightweight visual updates during dragging
     * Uses absolute positioning based on cached original transforms
     */
    performVisualDragUpdate(deltaX, element) {
        // Find all gene-related elements that were cached
        const allElements = document.querySelectorAll('[data-base-transform]');
        
        // Debug output (but not too frequent)
        if (Math.abs(deltaX) % 20 < 5) {
            console.log('🔧 [DRAG] Visual update - deltaX:', deltaX, 'px, elements:', allElements.length);
        }
        
        allElements.forEach(el => {
            const baseTransform = el.dataset.baseTransform || '';
            const isHTMLElement = el.classList.contains('gene-element') || el.classList.contains('gene-stats');
            const isSVGElement = el.tagName === 'svg' || el.tagName === 'g' || el.classList.contains('svg-gene-element');
            
            if (isHTMLElement) {
                // HTML elements: use style.transform
                if (baseTransform) {
                    el.style.transform = `${baseTransform} translateX(${deltaX}px)`;
                } else {
                    el.style.transform = `translateX(${deltaX}px)`;
                }
            } else if (isSVGElement) {
                // SVG elements: only use transform attribute, never style.transform
                if (baseTransform) {
                    el.setAttribute('transform', `${baseTransform} translate(${deltaX}, 0)`);
                } else {
                    el.setAttribute('transform', `translate(${deltaX}, 0)`);
                }
            }
        });
        
        // Add visual feedback class
        element.classList.add('visual-dragging');
    }

        /**
     * Cache original transforms before dragging starts
     */
    cacheOriginalTransforms(element) {
        // Find all gene-related elements
        const geneElements = document.querySelectorAll('.gene-element, .svg-gene-element, .genes-svg-container, .gene-stats');
        
        console.log('🔧 [DRAG] Caching transforms for', geneElements.length, 'elements');
        
        geneElements.forEach(el => {
            const isHTMLElement = el.classList.contains('gene-element') || el.classList.contains('gene-stats');
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

    /**
     * Reset visual transforms after drag ends
     */
    resetVisualDragUpdates(element) {
        // Find all cached elements and restore their original transforms
        const cachedElements = document.querySelectorAll('[data-base-transform]');
        
        console.log('🔧 [DRAG] Resetting transforms for', cachedElements.length, 'elements');
        
        cachedElements.forEach(el => {
            const baseTransform = el.dataset.baseTransform || '';
            const isHTMLElement = el.classList.contains('gene-element') || el.classList.contains('gene-stats');
            const isSVGElement = el.tagName === 'svg' || el.tagName === 'g' || el.classList.contains('svg-gene-element');
            
            if (isHTMLElement) {
                // Restore HTML element's style.transform
                el.style.transform = baseTransform;
                console.log('🔧 [DRAG] Restored HTML transform:', el.className, '-> "' + baseTransform + '"');
            } else if (isSVGElement) {
                // Restore SVG element's transform attribute
                el.setAttribute('transform', baseTransform);
                console.log('🔧 [DRAG] Restored SVG transform:', el.tagName, '-> "' + baseTransform + '"');
            }
            
            // Clean up cache
            delete el.dataset.baseTransform;
        });

        // Remove visual feedback class
        element.classList.remove('visual-dragging');
        console.log('🔧 [DRAG] Transform reset completed');
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
        
        if (searchResultsList) {
            searchResultsList.innerHTML = '<p class="no-results">No search results</p>';
        }
        
        // Restore original position
        this.restoreSearchResultsPosition();
        
        // Clear search results array
        this.searchResults = [];
        this.currentSearchIndex = 0;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationManager;
} 