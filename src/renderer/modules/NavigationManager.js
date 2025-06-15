/**
 * NavigationManager - Handles navigation, search, zoom, and position management
 */
class NavigationManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.searchResults = [];
        this.currentSearchIndex = 0;
        this.searchResultsOriginalPosition = null; // Store original position for restoration
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

    // Draggable functionality for tracks
    makeDraggable(element, chromosome) {
        let isDragging = false;
        let startX = 0;
        let startPosition = 0;
        let dragThreshold = 5; // Minimum pixels to move before considering it a drag
        let hasDragged = false;
        let lastUpdateX = 0; // Track last update position to prevent excessive updates
        let cumulativeVisualDeltaX = 0; // Track cumulative visual movement
        
        element.style.cursor = 'grab';
        element.title = 'Drag left or right to navigate through the genome\nKeyboard: ← → arrows, Home, End';
        
        const handleMouseDown = (e) => {
            // Only handle left mouse button
            if (e.button !== 0) return;
            
            // Don't start dragging if a splitter is being resized
            if (document.body.hasAttribute('data-splitter-resizing')) return;
            
            isDragging = true;
            hasDragged = false;
            startX = e.clientX;
            lastUpdateX = e.clientX;
            startPosition = this.genomeBrowser.currentPosition.start;
            cumulativeVisualDeltaX = 0; // Reset cumulative visual movement
            element.style.cursor = 'grabbing';
            element.classList.add('dragging');
            
            // Prevent text selection during drag
            document.body.style.userSelect = 'none';
            
            e.preventDefault();
        };
        
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            // Don't update if a splitter is being resized
            if (document.body.hasAttribute('data-splitter-resizing')) return;
            
            const deltaX = e.clientX - startX;
            
            // Check if we've moved enough to consider this a drag
            if (Math.abs(deltaX) > dragThreshold) {
                hasDragged = true;
            }
            
            if (!hasDragged) return;
            
            // Only update if mouse moved significantly since last update
            const deltaFromLastUpdate = Math.abs(e.clientX - lastUpdateX);
            if (deltaFromLastUpdate < 3) return; // Reduce update frequency
            
            lastUpdateX = e.clientX;
            
            // Calculate movement with much more conservative approach
            const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
            const elementWidth = getEffectiveWidth();
            const sequence = this.genomeBrowser.currentSequence[chromosome];
            
            // Calculate how much of the genome each pixel represents
            // Use a much smaller sensitivity factor for fine control
            const genomeFraction = currentRange / sequence.length; // What fraction of genome is currently visible
            const pixelMovement = deltaX; // Total pixel movement from start
            
            // Convert pixel movement to genome position change
            // Use 1:1 ratio for exact mouse synchronization
            const movementFactor = 1.0; // 1:1 ratio for perfect mouse sync
            const positionChange = Math.round(pixelMovement * currentRange * movementFactor / elementWidth);
            
            // Calculate new position (drag right = move left in genome, drag left = move right)
            const newStart = Math.max(0, Math.min(
                sequence.length - currentRange,
                startPosition - positionChange
            ));
            const newEnd = newStart + currentRange;
            
            // Only update if position actually changed
            if (newStart !== this.genomeBrowser.currentPosition.start) {
                // Update position for visual feedback during drag
                this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
                
                // Calculate cumulative visual movement that matches mouse movement
                // Visual movement should follow mouse direction directly
                const newCumulativeVisualDeltaX = deltaX;
                
                // OPTIMIZED: Only move visual elements during drag, no re-rendering
                this.performVisualDragUpdate(newCumulativeVisualDeltaX, element);
                
                // Update cumulative tracking
                cumulativeVisualDeltaX = newCumulativeVisualDeltaX;
                
                // Update navigation bar only (lightweight)
                if (this.genomeBrowser.genomeNavigationBar) {
                    this.genomeBrowser.genomeNavigationBar.update();
                }
            }
        };
        
        const handleMouseUp = (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            element.style.cursor = 'grab';
            element.classList.remove('dragging');
            document.body.style.userSelect = '';
            
            // If we didn't drag much, allow click events to propagate
            if (!hasDragged) {
                // Let click events on gene elements work normally
                return;
            }
            
            // OPTIMIZED: Clean up any pending visual updates
            if (this.dragUpdateTimeout) {
                clearTimeout(this.dragUpdateTimeout);
                this.dragUpdateTimeout = null;
            }
            
            // ------------------ 1) 获取实际视觉位移 ------------------
            // 优先通过 DOM 读取 transform 中的 translateX，保证使用真正渲染的距离
            const getActualDeltaX = () => {
                // 选一个示例元素（HTML gene 或 SVG gene）
                const sample = element.querySelector('.gene-element') ||
                                element.querySelector('.svg-gene-element') ||
                                element.querySelector('.genes-svg-container');
                if (!sample) return cumulativeVisualDeltaX;
                let tx = 0;
                // HTML 元素: 通过 style 或 computedStyle 获取 transform
                if (sample.style && sample.style.transform) {
                    const match = sample.style.transform.match(/translateX\((-?[0-9.]+)px\)/);
                    if (match) tx = parseFloat(match[1]);
                }
                if (!tx) {
                    const computed = window.getComputedStyle(sample);
                    const transform = computed.transform || computed.webkitTransform;
                    if (transform && transform !== 'none') {
                        // matrix(a,b,c,d,tx,ty)
                        const parts = transform.match(/matrix\(([^)]+)\)/);
                        if (parts && parts[1]) {
                            const nums = parts[1].split(',').map(v => parseFloat(v.trim()));
                            if (nums.length === 6) {
                                tx = nums[4];
                            }
                        }
                    }
                }
                // SVG 元素: 通过 getAttribute('transform')
                if (!tx && sample.getAttribute) {
                    const attr = sample.getAttribute('transform');
                    if (attr) {
                        const match = attr.match(/translate\(([^,]+),?\s*([^)]+)?\)/);
                        if (match) {
                            tx = parseFloat(match[1]);
                        }
                    }
                }
                // 如果还是取不到，回退到记录值
                return isNaN(tx) ? cumulativeVisualDeltaX : tx;
            };

            const actualDeltaX = getActualDeltaX();

            // ------------------ 2) 根据视觉位移计算基因组位置变化 ------------------
            const sequence = this.genomeBrowser.currentSequence[chromosome];
            const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
            const elementWidth = getEffectiveWidth();

            // 使用与 handleMouseMove 相同的公式并取整，保证一致性
            const finalPositionChange = Math.round(-actualDeltaX * currentRange / elementWidth);

            const finalNewStart = Math.max(0, Math.min(
                sequence.length - currentRange,
                startPosition + finalPositionChange
            ));
            const finalNewEnd = finalNewStart + currentRange;
            
            // Set the final position based on visual movement
            this.genomeBrowser.currentPosition = { start: finalNewStart, end: finalNewEnd };
            
            // Reset visual transforms
            this.resetVisualDragUpdates(element);
            
            // Full re-render after drag ends - now perfectly matches visual position
            this.genomeBrowser.updateStatistics(chromosome, sequence);
            this.genomeBrowser.displayGenomeView(chromosome, sequence);
            // Update navigation bar
            this.genomeBrowser.genomeNavigationBar.update();
            
            e.preventDefault();
            e.stopPropagation();
        };
        
        const handleMouseLeave = (e) => {
            if (isDragging) {
                handleMouseUp(e || {preventDefault: () => {}, stopPropagation: () => {}});
            }
        };
        
        // Add event listeners
        element.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        element.addEventListener('mouseleave', handleMouseLeave);
        
        // Add keyboard navigation
        element.setAttribute('tabindex', '0');
        element.addEventListener('keydown', (e) => {
            const sequence = this.genomeBrowser.currentSequence[chromosome];
            const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
            const step = Math.max(1, Math.floor(currentRange * 0.1)); // 10% of current view
            
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
                    return; // Don't prevent default for other keys
            }
            
            e.preventDefault();
            
            const newEnd = newStart + currentRange;
            this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
            this.genomeBrowser.updateStatistics(chromosome, sequence);
            this.genomeBrowser.displayGenomeView(chromosome, sequence);
            // Update navigation bar
            this.genomeBrowser.genomeNavigationBar.update();
        });
        
        // Store cleanup function for later removal if needed
        element._dragCleanup = () => {
            element.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            element.removeEventListener('mouseleave', handleMouseLeave);
        };

        // Helper: compute effective width of the track that corresponds to genome rendering
        const getEffectiveWidth = () => {
            // 1) if element itself is track-content
            if (element.classList.contains('track-content')) {
                return element.getBoundingClientRect().width || element.offsetWidth || 800;
            }
            // 2) look for inner .track-content
            const tc = element.querySelector('.track-content');
            if (tc) {
                return tc.getBoundingClientRect().width || tc.offsetWidth || 800;
            }
            // 3) look in genome viewer as fallback
            const gv = document.getElementById('genomeViewer');
            if (gv) {
                const tc2 = gv.querySelector('.track-content');
                if (tc2) {
                    return tc2.getBoundingClientRect().width || tc2.offsetWidth || 800;
                }
            }
            // 4) fallback to element width or default
            return element.offsetWidth || 800;
        };
    }

    /**
     * Perform lightweight visual updates during dragging
     * Only moves gene elements without re-rendering, keeping rulers static
     */
    performVisualDragUpdate(deltaX, element) {
        console.log('performVisualDragUpdate called with deltaX:', deltaX);
        console.log('Element being dragged:', element, 'className:', element.className);
        
        let elementsUpdated = 0;
        let searchContainers = [];
        
        // Check if element itself is a track-content, or contains track-content
        if (element.classList.contains('track-content')) {
            searchContainers = [element];
            console.log('Element itself is track-content');
        } else {
            // Find all track content elements within the element
            const trackContents = element.querySelectorAll('.track-content');
            searchContainers = Array.from(trackContents);
            console.log('Found track contents within element:', trackContents.length);
        }
        
        // If still no containers, search in parent genome viewer
        if (searchContainers.length === 0) {
            const genomeViewer = document.getElementById('genomeViewer');
            if (genomeViewer) {
                const trackContents = genomeViewer.querySelectorAll('.track-content');
                searchContainers = Array.from(trackContents);
                console.log('Found track contents in genome viewer:', trackContents.length);
            }
        }
        
        searchContainers.forEach((trackContent, index) => {
            console.log(`Processing track content ${index}:`, trackContent);
            
            // Only move gene-related elements, keep rulers static to avoid gaps
            
            // Move HTML gene elements (if any)
            const geneElements = trackContent.querySelectorAll('.gene-element');
            
            // Move SVG containers that specifically contain genes
            const genesSvgContainers = trackContent.querySelectorAll('.genes-svg-container');
            
            // Also try to find SVG gene elements directly
            const svgGeneElements = trackContent.querySelectorAll('.svg-gene-element');
            
            // Move gene-specific statistics
            const geneStatsElements = trackContent.querySelectorAll('.gene-stats');
            
            console.log(`Track ${index}: ${geneElements.length} HTML genes, ${genesSvgContainers.length} SVG containers, ${svgGeneElements.length} SVG genes, ${geneStatsElements.length} stats`);
            
            // Apply transform to move HTML gene elements
            geneElements.forEach(geneEl => {
                if (!geneEl.dataset.originalTransform) {
                    geneEl.dataset.originalTransform = geneEl.style.transform || '';
                }
                const originalTransform = geneEl.dataset.originalTransform;
                geneEl.style.transform = `${originalTransform} translateX(${deltaX}px)`.trim();
                console.log(`Moved HTML gene element, new transform: ${geneEl.style.transform}`);
                elementsUpdated++;
            });
            
            // Move gene SVG containers (most important for gene visualization)
            genesSvgContainers.forEach(svgEl => {
                if (!svgEl.dataset.originalTransform) {
                    svgEl.dataset.originalTransform = svgEl.style.transform || svgEl.getAttribute('transform') || '';
                }
                const originalTransform = svgEl.dataset.originalTransform;
                const newTransform = `${originalTransform} translateX(${deltaX}px)`.trim();
                
                // For SVG elements, try both style.transform and setAttribute
                svgEl.style.transform = newTransform;
                if (svgEl.tagName === 'svg' || svgEl.tagName === 'g') {
                    svgEl.setAttribute('transform', `translate(${deltaX}, 0)`);
                }
                console.log(`Moved SVG container, new transform: ${newTransform}`);
                elementsUpdated++;
            });
            
            // Move individual SVG gene elements if containers don't work
            svgGeneElements.forEach(svgGeneEl => {
                if (!svgGeneEl.dataset.originalTransform) {
                    svgGeneEl.dataset.originalTransform = svgGeneEl.getAttribute('transform') || '';
                }
                const originalTransform = svgGeneEl.dataset.originalTransform;
                
                // For SVG gene elements, use setAttribute for transform
                let newTransform;
                if (originalTransform) {
                    newTransform = `${originalTransform} translate(${deltaX}, 0)`;
                } else {
                    newTransform = `translate(${deltaX}, 0)`;
                }
                svgGeneEl.setAttribute('transform', newTransform);
                console.log(`Moved SVG gene element, new transform: ${newTransform}`);
                elementsUpdated++;
            });
            
            // Move gene statistics elements
            geneStatsElements.forEach(statsEl => {
                if (!statsEl.dataset.originalTransform) {
                    statsEl.dataset.originalTransform = statsEl.style.transform || '';
                }
                const originalTransform = statsEl.dataset.originalTransform;
                statsEl.style.transform = `${originalTransform} translateX(${deltaX}px)`.trim();
                console.log(`Moved stats element, new transform: ${statsEl.style.transform}`);
                elementsUpdated++;
            });
        });
        
        console.log(`Total elements updated: ${elementsUpdated}`);
        
        // If no elements found, try alternative approach - look globally
        if (elementsUpdated === 0) {
            console.log('No elements found in track contents, trying global search...');
            
            // Try to find gene elements anywhere in the document
            const allGeneElements = document.querySelectorAll('.gene-element, .svg-gene-element, .genes-svg-container');
            console.log(`Found ${allGeneElements.length} gene elements globally`);
            
            allGeneElements.forEach(el => {
                const isHTMLElement = el.classList.contains('gene-element');
                const isSVGContainer = el.classList.contains('genes-svg-container');
                const isSVGGene = el.classList.contains('svg-gene-element');
                
                if (isHTMLElement) {
                    // Handle HTML gene elements
                    if (!el.dataset.originalTransform) {
                        el.dataset.originalTransform = el.style.transform || '';
                    }
                    const originalTransform = el.dataset.originalTransform;
                    el.style.transform = `${originalTransform} translateX(${deltaX}px)`.trim();
                    console.log(`Globally moved HTML element, new transform: ${el.style.transform}`);
                } else if (isSVGContainer) {
                    // Handle SVG containers
                    if (!el.dataset.originalTransform) {
                        el.dataset.originalTransform = el.style.transform || el.getAttribute('transform') || '';
                    }
                    el.style.transform = `translateX(${deltaX}px)`;
                    if (el.tagName === 'svg') {
                        el.setAttribute('transform', `translate(${deltaX}, 0)`);
                    }
                    console.log(`Globally moved SVG container, applied translateX(${deltaX}px)`);
                } else if (isSVGGene) {
                    // Handle individual SVG gene elements
                    if (!el.dataset.originalTransform) {
                        el.dataset.originalTransform = el.getAttribute('transform') || '';
                    }
                    const originalTransform = el.dataset.originalTransform;
                    let newTransform;
                    if (originalTransform && originalTransform.trim()) {
                        // Parse existing transform and add translation
                        if (originalTransform.includes('translate(')) {
                            // Extract existing translate values and modify
                            const translateMatch = originalTransform.match(/translate\(([^)]+)\)/);
                            if (translateMatch) {
                                const coords = translateMatch[1].split(',').map(n => parseFloat(n.trim()));
                                const newX = (coords[0] || 0) + deltaX;
                                const newY = coords[1] || 0;
                                newTransform = originalTransform.replace(/translate\([^)]+\)/, `translate(${newX}, ${newY})`);
                            } else {
                                newTransform = `${originalTransform} translate(${deltaX}, 0)`;
                            }
                        } else {
                            newTransform = `${originalTransform} translate(${deltaX}, 0)`;
                        }
                    } else {
                        newTransform = `translate(${deltaX}, 0)`;
                    }
                    el.setAttribute('transform', newTransform);
                    console.log(`Globally moved SVG gene element, new transform: ${newTransform}`);
                }
                elementsUpdated++;
            });
            
            console.log(`Global search updated ${elementsUpdated} elements`);
        }
        
        // Add visual feedback class to indicate dragging
        element.classList.add('visual-dragging');
    }

    /**
     * Reset visual transforms after drag ends
     */
    resetVisualDragUpdates(element) {
        const trackContents = element.querySelectorAll('.track-content');
        let elementsReset = 0;
        
        trackContents.forEach(trackContent => {
            // Reset all transformed elements inside trackContent
            const transformedElements = trackContent.querySelectorAll('[data-original-transform]');
            transformedElements.forEach(el => {
                el.style.transform = el.dataset.originalTransform || '';
                if (el.tagName === 'svg' || el.tagName === 'g') {
                    // 还原 SVG 元素的 transform 属性
                    el.setAttribute('transform', el.dataset.originalTransform || '');
                }
                delete el.dataset.originalTransform;
                elementsReset++;
            });
        });
        
        // 同时处理 performVisualDragUpdate 的全局 fallback
        const globalTransformed = document.querySelectorAll('[data-original-transform]');
        globalTransformed.forEach(el => {
            el.style.transform = el.dataset.originalTransform || '';
            if (el.tagName === 'svg' || el.tagName === 'g') {
                el.setAttribute('transform', el.dataset.originalTransform || '');
            }
            delete el.dataset.originalTransform;
            elementsReset++;
        });
        
        // Remove visual feedback class
        element.classList.remove('visual-dragging');
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