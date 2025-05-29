/**
 * NavigationManager - Handles navigation, search, zoom, and position management
 */
class NavigationManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.searchResults = [];
        this.currentSearchIndex = 0;
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
    }

    resetZoom() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) return;
        
        const sequence = this.genomeBrowser.currentSequence[currentChr];
        this.genomeBrowser.currentPosition = { start: 0, end: Math.min(10000, sequence.length) };
        this.genomeBrowser.updateStatistics(currentChr, sequence);
        this.genomeBrowser.displayGenomeView(currentChr, sequence);
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
        
        if (results.length > 0) {
            // Go to first result
            const firstResult = results[0];
            const start = Math.max(0, firstResult.position - 500); // Show some context
            const end = Math.min(sequence.length, firstResult.end + 500);
            
            this.genomeBrowser.currentPosition = { start, end };
            this.genomeBrowser.updateStatistics(currentChr, sequence);
            this.genomeBrowser.displayGenomeView(currentChr, sequence);
            
            // Create detailed results message
            let message = `Found ${results.length} match${results.length > 1 ? 'es' : ''}:\n\n`;
            results.slice(0, 5).forEach((result, index) => {
                message += `${index + 1}. ${result.name} (${result.position + 1}-${result.end})\n   ${result.details}\n\n`;
            });
            
            if (results.length > 5) {
                message += `... and ${results.length - 5} more matches.\n\n`;
            }
            
            message += `Showing first match at position ${firstResult.position + 1}.`;
            alert(message);
        } else {
            let searchInfo = `No matches found for "${searchQuery}"`;
            if (includeReverseComplement && searchQuery.match(/^[ATGC]+$/i)) {
                const rc = this.getReverseComplement(searchQuery);
                searchInfo += `\n(Also searched for reverse complement: "${rc}")`;
            }
            alert(searchInfo);
        }
        
        // Close modal if it was opened
        const modal = document.getElementById('searchModal');
        if (modal) {
            modal.classList.remove('show');
        }
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
        
        element.style.cursor = 'grab';
        element.title = 'Drag left or right to navigate through the genome\nKeyboard: ← → arrows, Home, End';
        
        const handleMouseDown = (e) => {
            // Only handle left mouse button
            if (e.button !== 0) return;
            
            isDragging = true;
            hasDragged = false;
            startX = e.clientX;
            lastUpdateX = e.clientX;
            startPosition = this.genomeBrowser.currentPosition.start;
            element.style.cursor = 'grabbing';
            element.classList.add('dragging');
            
            // Prevent text selection during drag
            document.body.style.userSelect = 'none';
            
            e.preventDefault();
        };
        
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
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
            const elementWidth = element.offsetWidth || 800; // fallback width
            const sequence = this.genomeBrowser.currentSequence[chromosome];
            
            // Calculate how much of the genome each pixel represents
            // Use a much smaller sensitivity factor for fine control
            const genomeFraction = currentRange / sequence.length; // What fraction of genome is currently visible
            const pixelMovement = deltaX; // Total pixel movement from start
            
            // Convert pixel movement to genome position change
            // Use a very conservative multiplier to prevent jumping
            const movementFactor = 1.50; // Increased from 0.05 for better responsiveness
            const positionChange = Math.round(pixelMovement * currentRange * movementFactor / elementWidth);
            
            // Calculate new position (drag right = move left in genome, drag left = move right)
            const newStart = Math.max(0, Math.min(
                sequence.length - currentRange,
                startPosition - positionChange
            ));
            const newEnd = newStart + currentRange;
            
            // Only update if position actually changed
            if (newStart !== this.genomeBrowser.currentPosition.start) {
                this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
                
                // Throttle updates for better performance
                if (!this.dragUpdateTimeout) {
                    this.dragUpdateTimeout = setTimeout(() => {
                        this.genomeBrowser.updateStatistics(chromosome, sequence);
                        this.genomeBrowser.displayGenomeView(chromosome, sequence);
                        this.dragUpdateTimeout = null;
                    }, 32); // Reduced frequency for smoother performance
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
            
            // Final update after drag ends
            if (this.dragUpdateTimeout) {
                clearTimeout(this.dragUpdateTimeout);
                this.dragUpdateTimeout = null;
            }
            
            const sequence = this.genomeBrowser.currentSequence[chromosome];
            this.genomeBrowser.updateStatistics(chromosome, sequence);
            this.genomeBrowser.displayGenomeView(chromosome, sequence);
            
            e.preventDefault();
            e.stopPropagation();
        };
        
        const handleMouseLeave = () => {
            if (isDragging) {
                handleMouseUp();
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
        });
        
        // Store cleanup function for later removal if needed
        element._dragCleanup = () => {
            element.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            element.removeEventListener('mouseleave', handleMouseLeave);
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationManager;
} 