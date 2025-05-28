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
        const upperQuery = searchQuery.toUpperCase();
        const results = [];
        
        // Search for exact matches
        let index = sequence.indexOf(upperQuery);
        while (index !== -1) {
            results.push(index);
            index = sequence.indexOf(upperQuery, index + 1);
        }
        
        if (results.length > 0) {
            // Go to first result
            const start = results[0];
            const end = Math.min(sequence.length, start + Math.max(1000, upperQuery.length * 10));
            this.genomeBrowser.currentPosition = { start, end };
            this.genomeBrowser.updateStatistics(currentChr, sequence);
            this.genomeBrowser.displayGenomeView(currentChr, sequence);
            
            alert(`Found ${results.length} matches. Showing first match at position ${start + 1}.`);
        } else {
            alert('No matches found');
        }
        
        // Close modal if it was opened
        const modal = document.getElementById('searchModal');
        if (modal) {
            modal.classList.remove('show');
        }
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