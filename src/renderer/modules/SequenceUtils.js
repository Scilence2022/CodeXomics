/**
 * SequenceUtils - Handles sequence processing, display, and biological utilities
 */
class SequenceUtils {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this._cachedCharWidth = null; // Cache for character width measurement
        this.vscodeEditor = null;
        this.sequenceEditor = null; // Advanced editing capabilities
        
        // Sequence display mode: 'view' for traditional display, 'edit' for VS Code editor
        this.displayMode = 'view';
        
        // Performance optimization caches
        this.renderCache = new Map(); // Cache for rendered sequence lines
        this.featureCache = new Map(); // Cache for feature lookups
        this.colorCache = new Map(); // Cache for color calculations
        this.svgCache = new Map(); // Cache for SVG indicators
        this.lastRenderParams = null; // Track last render parameters
        
        // Virtual scrolling parameters
        this.virtualScrolling = {
            enabled: false,
            visibleLines: 20,
            bufferLines: 5,
            lineHeight: 32,
            scrollTop: 0
        };
        
        // Performance monitoring
        this.performanceStats = {
            renderTime: 0,
            cacheHits: 0,
            cacheMisses: 0,
            lastRenderStart: 0
        };
        
        // Drag optimization
        this.dragOptimization = {
            isDragging: false,
            pendingRender: null,
            renderThrottle: 100, // ms
            lastRenderTime: 0
        };
        
        // Listen for drag events to optimize rendering
        this.setupDragOptimization();
    }

    /**
     * Setup drag optimization listeners
     */
    setupDragOptimization() {
        // Listen for drag start/end events from NavigationManager
        document.addEventListener('dragstart', () => {
            this.dragOptimization.isDragging = true;
            console.log('🔧 [SequenceUtils] Drag started - enabling render optimization');
        });
        
        document.addEventListener('dragend', () => {
            this.dragOptimization.isDragging = false;
            console.log('🔧 [SequenceUtils] Drag ended - disabling render optimization');
            
            // Execute any pending render
            if (this.dragOptimization.pendingRender) {
                console.log('🔧 [SequenceUtils] Executing pending render after drag');
                this.dragOptimization.pendingRender();
                this.dragOptimization.pendingRender = null;
            }
        });
        
        // Listen for custom drag events from NavigationManager
        document.addEventListener('genomeViewDragStart', () => {
            this.dragOptimization.isDragging = true;
            console.log('🔧 [SequenceUtils] Genome view drag started');
        });
        
        document.addEventListener('genomeViewDragEnd', () => {
            this.dragOptimization.isDragging = false;
            console.log('🔧 [SequenceUtils] Genome view drag ended');
            
            // Execute any pending render
            if (this.dragOptimization.pendingRender) {
                console.log('🔧 [SequenceUtils] Executing pending render after genome drag');
                this.dragOptimization.pendingRender();
                this.dragOptimization.pendingRender = null;
            }
        });
    }
    
    /**
     * Check if rendering should be throttled during drag
     */
    shouldThrottleRender() {
        if (!this.dragOptimization.isDragging) return false;
        
        const now = Date.now();
        const timeSinceLastRender = now - this.dragOptimization.lastRenderTime;
        
        return timeSinceLastRender < this.dragOptimization.renderThrottle;
    }
    
    /**
     * Throttled render wrapper for drag optimization
     */
    throttledRender(renderFunction) {
        if (this.shouldThrottleRender()) {
            console.log('🔧 [SequenceUtils] Render throttled during drag - queuing for later');
            this.dragOptimization.pendingRender = renderFunction;
            return false; // Render was throttled
        }
        
        this.dragOptimization.lastRenderTime = Date.now();
        renderFunction();
        return true; // Render was executed
    }

    // Sequence display methods
    displayEnhancedSequence(chromosome, sequence) {
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const windowSize = end - start;
        
        // Update sequence title
        const sequenceTitle = document.getElementById('sequenceTitle');
        if (sequenceTitle) {
            sequenceTitle.textContent = `${chromosome}:${start + 1}-${end} (${windowSize} bp)`;
        }
        
        // Show sequence display section and splitter if not already visible
        const sequenceDisplaySection = document.getElementById('sequenceDisplaySection');
        if(sequenceDisplaySection.style.display === 'none') {
            sequenceDisplaySection.style.display = 'flex';
            document.getElementById('splitter').style.display = 'flex';
            
            // Ensure proper initial layout balance
            const genomeViewerSection = document.getElementById('genomeViewerSection');
            if (genomeViewerSection) {
                // Reset to balanced flex properties
                genomeViewerSection.style.flex = '1';
                genomeViewerSection.style.maxHeight = '70%';
            }
        }
        document.getElementById('sequenceDisplay').style.display = 'flex'; // Ensure content area is visible
        
        // Add mode toggle button if not already present
        this.addModeToggleButton();
        
        // Display sequence based on current mode
        if (this.displayMode === 'edit') {
            // For edit mode, we need to get the full sequence and pass current view positions
            const editStart = this.genomeBrowser.currentPosition?.start || 0;
            const editEnd = this.genomeBrowser.currentPosition?.end || Math.min(sequence.length, editStart + 10000);
            this.displayVSCodeSequence(chromosome, sequence, editStart, editEnd);
        } else {
            // Use traditional detailed sequence display as default
            this.displayDetailedSequence(chromosome, sequence, start, end);
        }
        
        // Re-highlight selected gene sequence if there is one
        if (this.genomeBrowser.selectedGene && this.genomeBrowser.selectedGene.gene) {
            // Use setTimeout to ensure the DOM is updated before highlighting
            setTimeout(() => {
                this.genomeBrowser.highlightGeneSequence(this.genomeBrowser.selectedGene.gene);
            }, 100);
        }
    }
    
    /**
     * Add mode toggle button to sequence display header
     */
    addModeToggleButton() {
        const sequenceTitle = document.getElementById('sequenceTitle');
        if (!sequenceTitle) return;
        
        // Check if button already exists
        if (document.getElementById('sequenceModeToggle')) return;
        
        const toggleButton = document.createElement('button');
        toggleButton.id = 'sequenceModeToggle';
        toggleButton.className = 'btn btn-sm'; // Use same style as Settings, Copy, Export buttons
        toggleButton.innerHTML = this.displayMode === 'edit' ? 
            '<i class="fas fa-eye"></i> View Mode' : '<i class="fas fa-edit"></i> Edit Mode';
        toggleButton.title = this.displayMode === 'edit' ? 
            'Switch to traditional sequence view' : 'Switch to VS Code-style editor';
        
        toggleButton.onclick = () => {
            this.toggleDisplayMode();
        };
        
        // Store reference to toggle button for later updates
        this.modeToggleButton = toggleButton;
        
        // Find the sequence controls container and insert before Settings button
        const sequenceControls = document.querySelector('.sequence-controls');
        const settingsBtn = document.getElementById('sequenceSettingsBtn');
        
        if (sequenceControls && settingsBtn) {
            // Insert before Settings button
            sequenceControls.insertBefore(toggleButton, settingsBtn);
        } else {
            // Fallback: Add after the title if controls not found
            sequenceTitle.parentNode.insertBefore(toggleButton, sequenceTitle.nextSibling);
        }
    }
    

    
    /**
     * Toggle between view and edit modes
     */
    toggleDisplayMode() {
        this.displayMode = this.displayMode === 'edit' ? 'view' : 'edit';
        
        // Update button text
        const toggleButton = document.getElementById('sequenceModeToggle');
        if (toggleButton) {
            toggleButton.innerHTML = this.displayMode === 'edit' ? 
                '<i class="fas fa-eye"></i> View Mode' : '<i class="fas fa-edit"></i> Edit Mode';
            toggleButton.title = this.displayMode === 'edit' ? 
                'Switch to traditional sequence view' : 'Switch to VS Code-style editor';
        }
        
        // Handle editing button
        if (this.displayMode === 'edit') {
            this.addEditingButton();
        } else {
            this.removeEditingButton();
        }
        
        // Clean up the container to avoid style conflicts
        this.cleanupContainer();
        
        // Re-display sequence with new mode
        const chromosome = this.genomeBrowser.currentChromosome;
        const sequenceData = this.genomeBrowser.currentSequence;
        if (chromosome && sequenceData && sequenceData[chromosome]) {
            // Extract the actual sequence string from the sequence data object
            const sequence = sequenceData[chromosome];
            
            // Force re-render by calling displayEnhancedSequence
            this.displayEnhancedSequence(chromosome, sequence);
        }
    }
    
    /**
     * Add editing button when in Edit Mode
     */
    addEditingButton() {
        // Remove existing editing button if any
        this.removeEditingButton();
        
        const editingButton = document.createElement('button');
        editingButton.id = 'sequenceEditingToggle';
        editingButton.className = 'btn btn-sm btn-warning';
        editingButton.innerHTML = '<i class="fas fa-pencil-alt"></i> Enable Editing';
        editingButton.title = 'Enable sequence editing capabilities';
        
        editingButton.onclick = () => {
            this.toggleEditingMode();
        };
        
        // Insert editing button after mode toggle
        const sequenceControls = document.querySelector('.sequence-controls');
        const settingsBtn = document.getElementById('sequenceSettingsBtn');
        
        if (sequenceControls && settingsBtn) {
            sequenceControls.insertBefore(editingButton, settingsBtn);
        }
    }
    
    /**
     * Remove editing button when not in Edit Mode
     */
    removeEditingButton() {
        const editingButton = document.getElementById('sequenceEditingToggle');
        if (editingButton) {
            editingButton.remove();
        }
    }
    
    /**
     * Toggle editing capabilities within Edit Mode
     */
    toggleEditingMode() {
        if (this.displayMode !== 'edit' || !this.sequenceEditor) {
            console.warn('⚠️ [SequenceUtils] Editing mode only available in Edit Mode with SequenceEditor');
            this.genomeBrowser.showNotification('Editing mode only available in Edit Mode', 'warning');
            return;
        }
        
        const isCurrentlyEditing = this.sequenceEditor.isEditMode;
        console.log(`🔧 [SequenceUtils] Toggling editing mode: ${isCurrentlyEditing ? 'Disable' : 'Enable'}`);
        
        if (isCurrentlyEditing) {
            this.sequenceEditor.disableEditMode();
        } else {
            this.sequenceEditor.enableEditMode();
        }
        
        this.updateEditingToggleButton();
        
        console.log(`✅ [SequenceUtils] Editing mode ${isCurrentlyEditing ? 'disabled' : 'enabled'}`);
    }
    
    /**
     * Update the editing toggle button text and style
     */
    updateEditingToggleButton() {
        const editingButton = document.getElementById('sequenceEditingToggle');
        if (!editingButton || !this.sequenceEditor) return;
        
        const isEditing = this.sequenceEditor.isEditMode;
        
        if (isEditing) {
            editingButton.innerHTML = '<i class="fas fa-times"></i> Disable Editing';
            editingButton.className = 'btn btn-sm btn-danger';
            editingButton.title = 'Disable sequence editing and return to view mode';
        } else {
            editingButton.innerHTML = '<i class="fas fa-pencil-alt"></i> Enable Editing';
            editingButton.className = 'btn btn-sm btn-warning';
            editingButton.title = 'Enable sequence editing capabilities';
        }
    }
    
    /**
     * Clean up container styles to prevent mode interference
     */
    cleanupContainer() {
        const container = document.getElementById('sequenceContent');
        if (!container) return;
        
        // If switching from edit mode, destroy VS Code editor and SequenceEditor instances first
        if (this.displayMode === 'view' && this.vscodeEditor) {
            try {
                // Destroy SequenceEditor first
                if (this.sequenceEditor) {
                    if (this.sequenceEditor.destroy) {
                        this.sequenceEditor.destroy();
                    }
                    this.sequenceEditor = null;
                }
                
                // Then destroy VSCode editor
                if (this.vscodeEditor.destroy) {
                    this.vscodeEditor.destroy();
                }
                this.vscodeEditor = null;
            } catch (error) {
                console.warn('Error destroying editors:', error);
                this.vscodeEditor = null;
                this.sequenceEditor = null;
            }
        }
        
        // Clear container content
        container.innerHTML = '';
        
        // Remove any VS Code editor specific styles
        container.style.removeProperty('font-family');
        container.style.removeProperty('font-size');
        container.style.removeProperty('line-height');
        container.style.removeProperty('background');
        container.style.removeProperty('color');
        container.style.removeProperty('overflow');
        container.style.removeProperty('position');
        container.style.removeProperty('min-height');
        container.style.removeProperty('height');
        
        // Reset container to default state
        container.className = '';
        
        // Remove any VS Code editor specific classes from container
        container.classList.remove('vscode-sequence-editor');
        
        // Clear any inline styles that might interfere
        const inlineStyles = container.querySelectorAll('[style]');
        inlineStyles.forEach(element => {
            // Only clear if it's not a sequence-specific style we want to keep
            if (!element.classList.contains('sequence-line') && 
                !element.classList.contains('sequence-position') && 
                !element.classList.contains('gene-indicator-line')) {
                element.removeAttribute('style');
            }
        });
    }
    
    /**
     * Display sequence using VS Code-style editor
     */
    displayVSCodeSequence(chromosome, sequence, start, end) {
        const container = document.getElementById('sequenceContent');
        const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
        
        // Enhanced debug logging
        console.log('🔧 [SequenceUtils] displayVSCodeSequence called with:', {
            chromosome,
            sequenceType: typeof sequence,
            sequenceLength: sequence?.length,
            start,
            end,
            currentPosition: this.genomeBrowser.currentPosition,
            annotationsCount: annotations.length,
            existingEditor: !!this.vscodeEditor,
            containerHasVSCodeEditor: !!container.querySelector('.vscode-sequence-editor')
        });
        
        // Ensure we have valid parameters
        if (!sequence || typeof sequence !== 'string') {
            console.error('❌ [SequenceUtils] Invalid sequence provided to VS Code editor:', sequence);
            console.error('Expected string, got:', typeof sequence);
            return;
        }
        
        // Get current position from genomeBrowser if start/end not provided
        if (start === undefined || end === undefined) {
            start = this.genomeBrowser.currentPosition?.start || 0;
            end = this.genomeBrowser.currentPosition?.end || Math.min(sequence.length, start + 10000);
            console.log('🔧 [SequenceUtils] Using fallback positions:', { start, end });
        }
        
        // Validate the range
        if (start >= end || start < 0 || end > sequence.length) {
            console.warn('⚠️ [SequenceUtils] Invalid range detected:', {
                start,
                end,
                sequenceLength: sequence.length,
                rangeSize: end - start
            });
            
            // Fix the range
            start = Math.max(0, start);
            end = Math.min(sequence.length, Math.max(start + 1000, end));
            console.log('🔧 [SequenceUtils] Corrected range:', { start, end });
        }
        
        // Check if we have a valid existing editor that's properly initialized
        const hasValidEditor = this.vscodeEditor && 
                              this.vscodeEditor.container === container &&
                              container.querySelector('.vscode-sequence-editor');
        
        if (hasValidEditor) {
            // Editor exists and is properly attached, just update the sequence
            console.log('🔧 [SequenceUtils] Updating existing VSCode editor with new sequence data');
            
            // Use setTimeout to ensure any ongoing operations complete
            setTimeout(() => {
                if (this.vscodeEditor) {
                    this.vscodeEditor.updateDimensions();
                    this.vscodeEditor.updateSequence(chromosome, sequence, start, end, annotations);
                }
            }, 10); // Shorter delay for updates
            
            return; // Exit early to avoid recreating editor
        }
        
        // Need to create or recreate the editor
        console.log('🔧 [SequenceUtils] Creating/recreating VSCode editor');
        
        // Clean up any existing editor first
        if (this.vscodeEditor) {
            try {
                if (this.vscodeEditor.destroy) {
                    this.vscodeEditor.destroy();
                }
            } catch (error) {
                console.warn('⚠️ [SequenceUtils] Error destroying existing editor:', error);
            }
            this.vscodeEditor = null;
        }
        
        // Clean container
        container.innerHTML = '';
        
        // Set minimum height to ensure proper sizing
        container.style.minHeight = '400px';
        container.style.height = '100%';
        
        // Create new editor instance
        console.log('🔧 [SequenceUtils] Creating new VSCode editor instance');
        this.vscodeEditor = new VSCodeSequenceEditor(container, this.genomeBrowser);
        
        // Initialize SequenceEditor for advanced editing capabilities
        if (typeof SequenceEditor !== 'undefined') {
            console.log('🔧 [SequenceUtils] Initializing SequenceEditor for advanced editing...');
            this.sequenceEditor = new SequenceEditor(this.vscodeEditor, this.genomeBrowser);
        } else {
            console.warn('⚠️ [SequenceUtils] SequenceEditor class not available');
        }
        
        // Use setTimeout to ensure container dimensions are properly calculated
        setTimeout(() => {
            // Double-check editor still exists after timeout
            if (this.vscodeEditor && this.vscodeEditor.container === container) {
                console.log('🔧 [SequenceUtils] Initializing new VSCode editor with sequence data');
                this.vscodeEditor.updateDimensions();
                this.vscodeEditor.updateSequence(chromosome, sequence, start, end, annotations);
                
                // Add editing capabilities
                if (this.sequenceEditor) {
                    console.log('🔧 [SequenceUtils] SequenceEditor ready for editing');
                }
            } else {
                console.error('❌ [SequenceUtils] VSCode editor instance lost after timeout');
            }
        }, 50); // Small delay to ensure container is properly sized
    }

    measureCharacterWidth(container) {
        // Return cached value if available
        if (this._cachedCharWidth) {
            return this._cachedCharWidth;
        }
        
        // Create a temporary element to measure character width
        const testElement = document.createElement('span');
        testElement.textContent = 'ATCG'; // Use representative DNA bases
        testElement.style.fontFamily = "'Courier New', monospace";
        testElement.style.fontSize = '14px';
        testElement.style.fontWeight = '600';
        testElement.style.visibility = 'hidden';
        testElement.style.position = 'absolute';
        testElement.style.whiteSpace = 'nowrap';
        
        container.appendChild(testElement);
        const width = testElement.offsetWidth / 4; // Divide by 4 since we measured 4 characters
        container.removeChild(testElement);
        
        this._cachedCharWidth = 9.5; //width; //Math.ceil(width); // Round up to be conservative and cache result
        return this._cachedCharWidth;
    }

    displayDetailedSequence(chromosome, fullSequence, viewStart, viewEnd) {
        // Use throttled render for drag optimization
        const renderFunction = () => {
            this.performDetailedSequenceRender(chromosome, fullSequence, viewStart, viewEnd);
        };
        
        // If not throttled, render immediately; otherwise queue for later
        if (!this.throttledRender(renderFunction)) {
            console.log('🔧 [SequenceUtils] Sequence render throttled during drag');
        }
    }
    
    /**
     * Perform the actual detailed sequence render
     */
    performDetailedSequenceRender(chromosome, fullSequence, viewStart, viewEnd) {
        // Start performance monitoring
        this.performanceStats.lastRenderStart = performance.now();
        
        const container = document.getElementById('sequenceContent');
        
        // Clean container and reset styles for view mode
        container.innerHTML = '';
        container.style.removeProperty('font-family');
        container.style.removeProperty('background');
        container.style.removeProperty('color');
        container.style.removeProperty('overflow');
        container.className = '';
        
        const subsequence = fullSequence.substring(viewStart, viewEnd);
        const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
        const operons = this.genomeBrowser.detectOperons ? this.genomeBrowser.detectOperons(annotations) : [];

        // Check if we should invalidate cache
        if (this.shouldInvalidateCache(chromosome, viewStart, viewEnd, annotations)) {
            this.clearRenderCache();
            console.log('🔧 [SequenceUtils] Cache invalidated due to parameter changes');
        }

        const containerWidth = container.offsetWidth || 800;
        const charWidth = this.measureCharacterWidth(container);
        const positionWidth = 100;
        const availableWidth = containerWidth - positionWidth - 30;
        const optimalLineLength = Math.max(10, Math.floor(availableWidth / charWidth));
        
        // Get sequence track settings
        const sequenceSettings = this.getSequenceTrackSettings();
        
        // Pre-compute feature lookups for better performance
        const featureLookup = this.buildFeatureLookup(annotations, viewStart, viewEnd);
        
        // Enable virtual scrolling for large sequences
        const totalLines = Math.ceil(subsequence.length / optimalLineLength);
        const enableVirtualScrolling = totalLines > 50;
        
        if (enableVirtualScrolling) {
            this.renderVirtualizedSequence(container, chromosome, subsequence, viewStart, annotations, operons, charWidth, optimalLineLength, sequenceSettings, featureLookup);
        } else {
            this.renderFullSequence(container, chromosome, subsequence, viewStart, annotations, operons, charWidth, optimalLineLength, sequenceSettings, featureLookup);
        }
        
        // Update render parameters
        this.updateLastRenderParams(chromosome, viewStart, viewEnd, annotations);
        
        // Log performance stats
        this.performanceStats.renderTime = performance.now() - this.performanceStats.lastRenderStart;
        console.log('🔧 [SequenceUtils] Render completed:', {
            renderTime: this.performanceStats.renderTime.toFixed(2) + 'ms',
            cacheHits: this.performanceStats.cacheHits,
            cacheMisses: this.performanceStats.cacheMisses,
            totalLines: totalLines,
            virtualScrolling: enableVirtualScrolling
        });
    }
    
    /**
     * Build optimized feature lookup table
     */
    buildFeatureLookup(annotations, viewStart, viewEnd) {
        const lookupKey = `${viewStart}:${viewEnd}:${this.getAnnotationHash(annotations)}`;
        
        if (this.featureCache.has(lookupKey)) {
            this.performanceStats.cacheHits++;
            return this.featureCache.get(lookupKey);
        }
        
        this.performanceStats.cacheMisses++;
        
        const lookup = new Map();
        
        // Only process annotations that overlap with the view range
        const relevantAnnotations = annotations.filter(f => 
            f.end >= viewStart && f.start <= viewEnd && 
            this.genomeBrowser.shouldShowGeneType(f.type)
        );
        
        // Build position-based lookup
        for (let pos = viewStart; pos <= viewEnd; pos++) {
            const overlapping = relevantAnnotations.filter(f => pos >= f.start && pos <= f.end);
            if (overlapping.length > 0) {
                // Sort by priority
                const sorted = overlapping.sort((a, b) => {
                    const typeOrder = { 'CDS': 1, 'mRNA': 2, 'tRNA': 2, 'rRNA': 2, 'promoter': 3, 'terminator': 3, 'regulatory': 3, 'gene': 4 };
                    return (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5);
                });
                lookup.set(pos, sorted[0]);
            }
        }
        
        this.featureCache.set(lookupKey, lookup);
        return lookup;
    }
    
    /**
     * Render full sequence (for smaller sequences)
     */
    renderFullSequence(container, chromosome, subsequence, viewStart, annotations, operons, charWidth, optimalLineLength, sequenceSettings, featureLookup) {
        let html = '<div class="detailed-sequence-view">';
        html += '<div class="sequence-info"><strong>DNA Sequence (colored by features):</strong></div>';
        
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        tempDiv.className = 'detailed-sequence-view';
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'sequence-info';
        infoDiv.innerHTML = '<strong>DNA Sequence (colored by features):</strong>';
        tempDiv.appendChild(infoDiv);
        
        // Batch DOM operations
        const linesToRender = [];
        for (let i = 0; i < subsequence.length; i += optimalLineLength) {
            const lineSubsequence = subsequence.substring(i, i + optimalLineLength);
            const lineStartPos = viewStart + i;
            linesToRender.push({ lineSubsequence, lineStartPos, index: i });
        }
        
        // Render lines in batches to avoid blocking the UI
        this.renderSequenceLinesBatch(tempDiv, linesToRender, chromosome, annotations, operons, charWidth, sequenceSettings, featureLookup, 0);
        
        // Add protein translations
        this.addProteinTranslations(tempDiv, chromosome, subsequence, viewStart, viewEnd, annotations);
        
        container.appendChild(tempDiv);
    }
    
    /**
     * Render sequence lines in batches to avoid UI blocking
     */
    renderSequenceLinesBatch(container, linesToRender, chromosome, annotations, operons, charWidth, sequenceSettings, featureLookup, batchStart) {
        // Skip rendering if we're dragging (optimization)
        if (this.dragOptimization.isDragging) {
            console.log('🔧 [SequenceUtils] Skipping batch render during drag');
            return;
        }
        
        const batchSize = 10; // Render 10 lines at a time
        const batchEnd = Math.min(batchStart + batchSize, linesToRender.length);
        
        for (let i = batchStart; i < batchEnd; i++) {
            const { lineSubsequence, lineStartPos } = linesToRender[i];
            const lineElement = this.renderSequenceLine(lineSubsequence, lineStartPos, chromosome, annotations, operons, charWidth, sequenceSettings, featureLookup);
            container.appendChild(lineElement);
        }
        
        // Continue with next batch if there are more lines
        if (batchEnd < linesToRender.length) {
            // Use requestAnimationFrame to avoid blocking the UI
            requestAnimationFrame(() => {
                // Check again if we're still not dragging before continuing
                if (!this.dragOptimization.isDragging) {
                    this.renderSequenceLinesBatch(container, linesToRender, chromosome, annotations, operons, charWidth, sequenceSettings, featureLookup, batchEnd);
                } else {
                    console.log('🔧 [SequenceUtils] Stopping batch render due to drag start');
                }
            });
        }
    }
    
    /**
     * Render individual sequence line with caching
     */
    renderSequenceLine(lineSubsequence, lineStartPos, chromosome, annotations, operons, charWidth, sequenceSettings, featureLookup) {
        const cacheKey = this.getSequenceLineCacheKey(lineSubsequence, lineStartPos, chromosome);
        
        if (this.renderCache.has(cacheKey)) {
            this.performanceStats.cacheHits++;
            return this.renderCache.get(cacheKey).cloneNode(true);
        }
        
        this.performanceStats.cacheMisses++;
        
        const lineGroup = document.createElement('div');
        lineGroup.className = 'sequence-line-group';
        lineGroup.style.marginBottom = '8px';
        
        // Create sequence line
        const sequenceLine = document.createElement('div');
        sequenceLine.className = 'sequence-line';
        sequenceLine.style.cssText = 'display: flex; margin-bottom: 4px; font-family: "Courier New", monospace; font-size: 14px; line-height: 1.6;';
        
        // Position label
        const positionSpan = document.createElement('span');
        positionSpan.className = 'sequence-position';
        positionSpan.style.cssText = 'width: 100px; color: #6c757d; font-weight: 600; margin-right: 15px; text-align: right; flex-shrink: 0;';
        positionSpan.textContent = (lineStartPos + 1).toLocaleString();
        
        // Sequence bases
        const basesDiv = document.createElement('div');
        basesDiv.className = 'sequence-bases';
        basesDiv.style.cssText = 'flex: 1; word-break: break-all; font-family: "Courier New", monospace; font-size: 14px; line-height: 1.6;';
        basesDiv.innerHTML = this.colorizeSequenceWithFeaturesOptimized(lineSubsequence, lineStartPos, featureLookup, operons);
        
        sequenceLine.appendChild(positionSpan);
        sequenceLine.appendChild(basesDiv);
        
        // Gene indicator line
        const indicatorLine = document.createElement('div');
        indicatorLine.className = 'gene-indicator-line';
        indicatorLine.style.cssText = 'height: 12px; margin-left: 115px; margin-bottom: 4px;';
        indicatorLine.innerHTML = this.createGeneIndicatorBarOptimized(lineSubsequence, lineStartPos, annotations, operons, charWidth, false, sequenceSettings);
        
        lineGroup.appendChild(sequenceLine);
        lineGroup.appendChild(indicatorLine);
        
        // Cache the rendered line
        this.renderCache.set(cacheKey, lineGroup.cloneNode(true));
        
        return lineGroup;
    }
    
    /**
     * Optimized sequence colorization with feature lookup
     */
    colorizeSequenceWithFeaturesOptimized(sequence, lineStartAbs, featureLookup, operons) {
        const baseFontSize = '14px';
        const fragments = [];
        
        for (let i = 0; i < sequence.length; i++) {
            const base = sequence[i];
            const absPos = lineStartAbs + i + 1;
            const baseTextColor = this.getBaseColor(base);
            
            let featureHexColor = null;
            let featureTitle = '';
            
            // Use optimized feature lookup
            const mainFeature = featureLookup.get(absPos);
            if (mainFeature) {
                const operonInfo = operons && mainFeature.type !== 'promoter' && mainFeature.type !== 'terminator' ? 
                    this.genomeBrowser.getGeneOperonInfo(mainFeature, operons) : null;
                featureHexColor = operonInfo ? operonInfo.color : this.getFeatureTypeColor(mainFeature.type);
                featureTitle = `${mainFeature.qualifiers.gene || mainFeature.qualifiers.locus_tag || mainFeature.type} (${mainFeature.start}-${mainFeature.end})`;
            }
            
            // Use cached color calculations
            const colorKey = `${base}:${featureHexColor || 'none'}`;
            let style;
            
            if (this.colorCache.has(colorKey)) {
                style = this.colorCache.get(colorKey);
                this.performanceStats.cacheHits++;
            } else {
                style = `color: ${baseTextColor}; font-size: ${baseFontSize}; display: inline-block; padding: 0; margin: 0; vertical-align: top;`;
                if (featureHexColor) {
                    const backgroundColorRgba = this.hexToRgba(featureHexColor, 0.1);
                    style += ` background-color: ${backgroundColorRgba};`;
                } else {
                    style += ` background-color: transparent;`;
                }
                this.colorCache.set(colorKey, style);
                this.performanceStats.cacheMisses++;
            }
            
            const className = `base-${base.toLowerCase()}`;
            const titleAttr = featureTitle ? ` title="${featureTitle}"` : '';
            fragments.push(`<span class="${className}" style="${style}"${titleAttr}>${base}</span>`);
        }
        
        return fragments.join('');
    }
    
    /**
     * Optimized gene indicator bar creation
     */
    createGeneIndicatorBarOptimized(sequence, lineStartAbs, annotations, operons, charWidth, simplified = false, settings = {}) {
        // Check if indicators should be shown
        if (settings.showIndicators === false) {
            return '<div style="height: 0px;"></div>';
        }
        
        const cacheKey = `indicator:${lineStartAbs}:${sequence.length}:${this.getAnnotationHash(annotations)}`;
        
        if (this.svgCache.has(cacheKey)) {
            this.performanceStats.cacheHits++;
            return this.svgCache.get(cacheKey);
        }
        
        this.performanceStats.cacheMisses++;
        
        const barHeight = settings.indicatorHeight || 8;
        const lineWidth = sequence.length * charWidth;
        const lineEndAbs = lineStartAbs + sequence.length;
        
        // Pre-filter overlapping genes
        const overlappingGenes = annotations.filter(gene => {
            if (gene.start > lineEndAbs || gene.end < lineStartAbs + 1) return false;
            if (!this.genomeBrowser.shouldShowGeneType(gene.type)) return false;
            
            const geneType = gene.type.toLowerCase();
            if (geneType === 'cds' && settings.showCDS === false) return false;
            if (['trna', 'rrna', 'mrna'].includes(geneType) && settings.showRNA === false) return false;
            if (geneType === 'promoter' && settings.showPromoter === false) return false;
            if (geneType === 'terminator' && settings.showTerminator === false) return false;
            if (geneType === 'regulatory' && settings.showRegulatory === false) return false;
            
            return true;
        });
        
        if (overlappingGenes.length === 0) {
            const result = `<svg class="gene-indicator-svg" style="width: ${lineWidth}px; height: ${barHeight}px; margin-left: 0;"></svg>`;
            this.svgCache.set(cacheKey, result);
            return result;
        }
        
        // Build SVG content
        const svgParts = [`<svg class="gene-indicator-svg" style="width: ${lineWidth}px; height: ${barHeight}px; margin-left: 0;">`];
        
        overlappingGenes.forEach(gene => {
            const indicator = this.createGeneIndicator(gene, lineStartAbs, lineEndAbs, charWidth, barHeight, operons, settings);
            if (indicator) svgParts.push(indicator);
        });
        
        svgParts.push('</svg>');
        
        const result = svgParts.join('');
        this.svgCache.set(cacheKey, result);
        return result;
    }
    
    /**
     * Render virtualized sequence for large sequences
     */
    renderVirtualizedSequence(container, chromosome, subsequence, viewStart, annotations, operons, charWidth, optimalLineLength, sequenceSettings, featureLookup) {
        console.log('🔧 [SequenceUtils] Using virtualized rendering for large sequence');
        
        const totalLines = Math.ceil(subsequence.length / optimalLineLength);
        const containerHeight = Math.min(600, totalLines * this.virtualScrolling.lineHeight);
        
        // Create virtualized container
        const virtualContainer = document.createElement('div');
        virtualContainer.className = 'detailed-sequence-view virtualized';
        virtualContainer.style.cssText = `
            height: ${containerHeight}px;
            overflow-y: auto;
            position: relative;
        `;
        
        // Info header
        const infoDiv = document.createElement('div');
        infoDiv.className = 'sequence-info';
        infoDiv.innerHTML = '<strong>DNA Sequence (colored by features) - Virtualized View:</strong>';
        virtualContainer.appendChild(infoDiv);
        
        // Viewport for visible lines
        const viewport = document.createElement('div');
        viewport.className = 'virtual-viewport';
        viewport.style.cssText = `
            height: ${totalLines * this.virtualScrolling.lineHeight}px;
            position: relative;
        `;
        
        // Visible content container
        const visibleContent = document.createElement('div');
        visibleContent.className = 'virtual-visible-content';
        visibleContent.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
        `;
        
        viewport.appendChild(visibleContent);
        virtualContainer.appendChild(viewport);
        
        // Initial render
        this.updateVirtualizedContent(visibleContent, 0, chromosome, subsequence, viewStart, annotations, operons, charWidth, optimalLineLength, sequenceSettings, featureLookup, totalLines);
        
        // Scroll handler for virtual scrolling
        let scrollTimeout;
        virtualContainer.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const scrollTop = virtualContainer.scrollTop;
                this.updateVirtualizedContent(visibleContent, scrollTop, chromosome, subsequence, viewStart, annotations, operons, charWidth, optimalLineLength, sequenceSettings, featureLookup, totalLines);
            }, 16); // ~60fps
        });
        
        container.appendChild(virtualContainer);
        
        // Add protein translations below
        this.addProteinTranslations(container, chromosome, subsequence, viewStart, viewStart + subsequence.length, annotations);
    }
    
    /**
     * Update virtualized content based on scroll position
     */
    updateVirtualizedContent(visibleContent, scrollTop, chromosome, subsequence, viewStart, annotations, operons, charWidth, optimalLineLength, sequenceSettings, featureLookup, totalLines) {
        const lineHeight = this.virtualScrolling.lineHeight;
        const visibleLines = this.virtualScrolling.visibleLines;
        const bufferLines = this.virtualScrolling.bufferLines;
        
        const startLine = Math.max(0, Math.floor(scrollTop / lineHeight) - bufferLines);
        const endLine = Math.min(totalLines, startLine + visibleLines + bufferLines * 2);
        
        // Clear existing content
        visibleContent.innerHTML = '';
        
        // Render visible lines
        for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
            const i = lineIndex * optimalLineLength;
            if (i >= subsequence.length) break;
            
            const lineSubsequence = subsequence.substring(i, i + optimalLineLength);
            const lineStartPos = viewStart + i;
            
            const lineElement = this.renderSequenceLine(lineSubsequence, lineStartPos, chromosome, annotations, operons, charWidth, sequenceSettings, featureLookup);
            lineElement.style.position = 'absolute';
            lineElement.style.top = `${lineIndex * lineHeight}px`;
            lineElement.style.left = '0';
            lineElement.style.right = '0';
            
            visibleContent.appendChild(lineElement);
        }
        
        console.log(`🔧 [SequenceUtils] Virtual scroll update: lines ${startLine}-${endLine} of ${totalLines}`);
    }
    
    /**
     * Add protein translations section
     */
    addProteinTranslations(container, chromosome, subsequence, viewStart, viewEnd, annotations) {
        const cdsFeatures = annotations.filter(feature => 
            feature.type === 'CDS' &&
            feature.start <= viewEnd && feature.end >= viewStart &&
            this.genomeBrowser.shouldShowGeneType('CDS')
        );
        
        if (cdsFeatures.length === 0) return;
        
        const translationsDiv = document.createElement('div');
        translationsDiv.className = 'protein-translations';
        translationsDiv.style.cssText = 'margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'sequence-info';
        headerDiv.innerHTML = '<strong>Protein Translations:</strong>';
        translationsDiv.appendChild(headerDiv);
        
        cdsFeatures.forEach(cds => {
            const fullSequence = this.genomeBrowser.currentSequence[chromosome];
            const dnaForTranslation = fullSequence.substring(cds.start - 1, cds.end);
            const proteinSequence = this.translateDNA(dnaForTranslation, cds.strand);
            const geneName = cds.qualifiers.gene || cds.qualifiers.locus_tag || 'Unknown';
            
            const proteinDiv = document.createElement('div');
            proteinDiv.className = 'protein-sequence';
            proteinDiv.style.marginBottom = '15px';
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'protein-header';
            headerDiv.style.cssText = 'font-weight: bold; color: #495057; margin-bottom: 5px;';
            headerDiv.textContent = `${geneName} (${cds.start}-${cds.end}, ${cds.strand === -1 ? '-' : '+'} strand):`;
            
            const seqDiv = document.createElement('div');
            seqDiv.className = 'protein-seq';
            seqDiv.style.cssText = 'font-family: "Courier New", monospace; font-size: 12px; background: #f8f9fa; padding: 8px; border-radius: 4px; word-break: break-all; line-height: 1.4;';
            seqDiv.innerHTML = this.colorizeProteinSequence(proteinSequence);
            
            proteinDiv.appendChild(headerDiv);
            proteinDiv.appendChild(seqDiv);
            translationsDiv.appendChild(proteinDiv);
        });
        
        container.appendChild(translationsDiv);
    }

    // Biological utilities
    translateDNA(dnaSequence, strand = 1) {
        const geneticCode = {
            'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
            'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
            'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
            'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W',
            'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
            'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
            'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
            'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
            'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M',
            'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
            'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
            'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
            'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
            'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
            'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
            'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
        };

        let sequence = dnaSequence.toUpperCase();
        
        // Reverse complement if on negative strand
        if (strand === -1) {
            sequence = this.getReverseComplement(sequence);
        }
        
        let protein = '';
        for (let i = 0; i < sequence.length - 2; i += 3) {
            const codon = sequence.substring(i, i + 3);
            protein += geneticCode[codon] || 'X';
        }
        
        return protein;
    }

    getReverseComplement(sequence) {
        const complement = {
            'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G',
            'N': 'N', 'R': 'Y', 'Y': 'R', 'S': 'S',
            'W': 'W', 'K': 'M', 'M': 'K', 'B': 'V',
            'D': 'H', 'H': 'D', 'V': 'B'
        };
        
        return sequence.split('').reverse().map(base => complement[base] || base).join('');
    }

    // Sequence operations
    copySequence() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
            alert('No sequence to copy');
            return;
        }
        
        const sequence = this.genomeBrowser.currentSequence[currentChr];
        let textToCopy, copyMessage, copySource;
        
        // Priority 1: Check if there's a selected gene sequence
        if (this.genomeBrowser.sequenceSelection && this.genomeBrowser.sequenceSelection.active && 
            this.genomeBrowser.sequenceSelection.source === 'gene') {
            
            const geneSeq = this.genomeBrowser.sequenceSelection;
            textToCopy = sequence.substring(geneSeq.start - 1, geneSeq.end); // Convert to 0-based indexing
            copyMessage = `Copied ${geneSeq.geneName} sequence (${textToCopy.length} bp) to clipboard`;
            copySource = 'gene';
        }
        // Priority 2: Check if there's a manual sequence selection (drag selection)
        else if (this.genomeBrowser.currentSequenceSelection) {
            const manualSelection = this.genomeBrowser.currentSequenceSelection;
            console.log('Manual selection:', manualSelection);
            // Convert to 0-based indexing for substring
            const startIdx = manualSelection.start;
            const endIdx = manualSelection.end + 1; // Include end position
            textToCopy = sequence.substring(startIdx, endIdx);
            console.log('Extracted sequence:', textToCopy);
            copyMessage = `Copied selected sequence (${textToCopy.length} bp) to clipboard`;
            copySource = 'manual';
        }
        // Priority 3: Check if there's a text selection
        else {
            const selection = window.getSelection();
            if (selection.toString().length > 0) {
                // Use selected text
                textToCopy = selection.toString().replace(/\s+/g, '').replace(/\d+/g, '');
                copyMessage = `Copied text selection (${textToCopy.length} bases) to clipboard`;
                copySource = 'text';
            } else {
                // Priority 4: Use entire visible sequence
                const userChoice = confirm('No sequence selected. Click OK to copy the entire visible sequence, or Cancel to select a specific region first.');
                if (!userChoice) {
                    alert('Please click on a gene in the Gene Track or drag to select sequence, then click Copy again.');
                    return;
                }
                textToCopy = sequence.substring(this.genomeBrowser.currentPosition.start, this.genomeBrowser.currentPosition.end);
                copyMessage = `Copied visible sequence (${textToCopy.length} bases) to clipboard`;
                copySource = 'visible';
            }
        }
        
        // Create FASTA format for gene sequences and manual selections
        if (copySource === 'gene') {
            const geneSeq = this.genomeBrowser.sequenceSelection;
            const fastaHeader = `>${geneSeq.geneName} ${currentChr}:${geneSeq.start}-${geneSeq.end}`;
            textToCopy = `${fastaHeader}\n${textToCopy}`;
        } else if (copySource === 'manual') {
            const manualSelection = this.genomeBrowser.currentSequenceSelection;
            const fastaHeader = `>${currentChr}:${manualSelection.start + 1}-${manualSelection.end + 1}`;
            textToCopy = `${fastaHeader}\n${textToCopy}`;
        }
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            alert(copyMessage);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert('Failed to copy to clipboard');
        });
    }

    exportSequence() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
            alert('No sequence to export');
            return;
        }
        
        const sequence = this.genomeBrowser.currentSequence[currentChr];
        const subsequence = sequence.substring(this.genomeBrowser.currentPosition.start, this.genomeBrowser.currentPosition.end);
        
        const fastaContent = `>${currentChr}:${this.genomeBrowser.currentPosition.start + 1}-${this.genomeBrowser.currentPosition.end}\n${subsequence}`;
        
        const blob = new Blob([fastaContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentChr}_${this.genomeBrowser.currentPosition.start + 1}-${this.genomeBrowser.currentPosition.end}.fasta`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Statistics and analysis
    updateStatistics(chromosome, sequence) {
        const length = sequence.length;
        const gcCount = (sequence.match(/[GC]/g) || []).length;
        const gcContent = ((gcCount / length) * 100).toFixed(2);

        const sequenceLength = document.getElementById('sequenceLength');
        const gcContentElement = document.getElementById('gcContent');
        const currentPosition = document.getElementById('currentPosition');
        
        if (sequenceLength) sequenceLength.textContent = length.toLocaleString();
        if (gcContentElement) gcContentElement.textContent = `${gcContent}%`;
        if (currentPosition) {
            currentPosition.textContent = `${this.genomeBrowser.currentPosition.start + 1}-${this.genomeBrowser.currentPosition.end}`;
        }
    }

    // Chromosome management
    populateChromosomeSelect() {
        const select = document.getElementById('chromosomeSelect');
        select.innerHTML = '<option value="">Select chromosome...</option>';
        
        if (this.genomeBrowser.currentSequence) {
            Object.keys(this.genomeBrowser.currentSequence).forEach(chr => {
                const option = document.createElement('option');
                option.value = chr;
                option.textContent = chr;
                select.appendChild(option);
            });
        }
    }

    selectChromosome(chromosome) {
        if (!chromosome || !this.genomeBrowser.currentSequence[chromosome]) return;

        const sequence = this.genomeBrowser.currentSequence[chromosome];
        this.genomeBrowser.currentPosition = { start: 0, end: Math.min(10000, sequence.length) };
        
        // Set the current chromosome property for chat interface
        this.genomeBrowser.currentChromosome = chromosome;
        
        // Update chromosome select
        document.getElementById('chromosomeSelect').value = chromosome;
        
        // Update statistics
        this.updateStatistics(chromosome, sequence);
        
        // Show sequence and annotations
        this.genomeBrowser.displayGenomeView(chromosome, sequence);
    }

    /**
     * Create gene indicator bar below sequence line - simple narrow shapes with track-consistent colors
     */
    createGeneIndicatorBar(sequence, lineStartAbs, annotations, operons, charWidth, simplified = false, settings = {}) {
        // Check if indicators should be shown
        if (settings.showIndicators === false) {
            return '<div style="height: 0px;"></div>';
        }
        
        const barHeight = settings.indicatorHeight || 8; // Use settings or default
        const lineWidth = sequence.length * charWidth;
        
        // Create SVG for the indicator bar
        let svg = `<svg class="gene-indicator-svg" style="width: ${lineWidth}px; height: ${barHeight}px; margin-left: 0;">`;
        
        // Process genes that overlap with this sequence line
        const lineEndAbs = lineStartAbs + sequence.length;
        const overlappingGenes = annotations.filter(gene => {
            if (gene.start > lineEndAbs || gene.end < lineStartAbs + 1) return false;
            if (!this.genomeBrowser.shouldShowGeneType(gene.type)) return false;
            
            // Apply gene type filters from settings
            const geneType = gene.type.toLowerCase();
            if (geneType === 'cds' && settings.showCDS === false) return false;
            if (['trna', 'rrna', 'mrna'].includes(geneType) && settings.showRNA === false) return false;
            if (geneType === 'promoter' && settings.showPromoter === false) return false;
            if (geneType === 'terminator' && settings.showTerminator === false) return false;
            if (geneType === 'regulatory' && settings.showRegulatory === false) return false;
            
            return true;
        });
        
        // Draw gene indicators for each overlapping gene
        overlappingGenes.forEach(gene => {
            svg += this.createGeneIndicator(gene, lineStartAbs, lineEndAbs, charWidth, barHeight, operons, settings);
        });
        
        svg += '</svg>';
        return svg;
    }

    /**
     * Create individual gene indicator with start line, gene body, and end arrow
     */
    createGeneIndicator(gene, lineStartAbs, lineEndAbs, charWidth, barHeight, operons, settings = {}) {
        // Get gene color - same as Genes & Features track
        const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);
        const geneColor = operonInfo ? operonInfo.color : this.getFeatureTypeColor(gene.type);
        
        // Calculate positions relative to the sequence line
        const geneStartInLine = Math.max(gene.start, lineStartAbs + 1) - lineStartAbs - 1;
        const geneEndInLine = Math.min(gene.end, lineEndAbs) - lineStartAbs - 1;
        
        // Convert to pixel positions
        const startX = geneStartInLine * charWidth;
        const endX = (geneEndInLine + 1) * charWidth;
        const width = endX - startX;
        
        if (width <= 0) return '';
        
        const isForward = gene.strand !== -1;
        const geneType = gene.type.toLowerCase();
        
        let indicator = '';
        
        // Gene body shape
        indicator += this.createGeneBodyShape(gene, startX, width, barHeight, geneColor, geneType, settings);
        
        // For forward genes: start marker at left, end arrow at right
        // For reverse genes: start marker at right, end arrow at left
        if (isForward) {
            // Start marker (vertical line) - only if gene actually starts in this line and enabled
            if (settings.showStartMarkers !== false && gene.start >= lineStartAbs + 1 && gene.start <= lineEndAbs) {
                const markerWidth = settings.startMarkerWidth || 6;
                const markerHeightPercent = settings.startMarkerHeight || 200;
                const markerHeight = (barHeight * markerHeightPercent / 100);
                const markerOffset = (barHeight - markerHeight) / 2;
                indicator += `<line x1="${startX}" y1="${markerOffset}" x2="${startX}" y2="${markerOffset + markerHeight}" 
                                   stroke="${this.darkenHexColor(geneColor, 30)}" stroke-width="${markerWidth}" opacity="0.9"
                                   ${settings.showTooltips !== false ? `title="Gene start: ${gene.qualifiers?.gene || gene.type}"` : ''}/>`;
            }
            
            // End marker (arrow) - only if gene actually ends in this line and enabled
            if (settings.showEndArrows !== false && gene.end >= lineStartAbs + 1 && gene.end <= lineEndAbs) {
                indicator += this.createGeneEndArrow(endX, barHeight, geneColor, isForward, gene, settings);
            }
        } else {
            // For reverse genes: start marker at right (gene's actual start), end arrow at left (transcription direction)
            // Start marker (vertical line) - only if gene actually starts in this line and enabled
            if (settings.showStartMarkers !== false && gene.start >= lineStartAbs + 1 && gene.start <= lineEndAbs) {
                const markerWidth = settings.startMarkerWidth || 6;
                const markerHeightPercent = settings.startMarkerHeight || 200;
                const markerHeight = (barHeight * markerHeightPercent / 100);
                const markerOffset = (barHeight - markerHeight) / 2;
                // For reverse genes, the start marker should be at the RIGHT end (where gene actually starts)
                indicator += `<line x1="${endX}" y1="${markerOffset}" x2="${endX}" y2="${markerOffset + markerHeight}" 
                                   stroke="${this.darkenHexColor(geneColor, 30)}" stroke-width="${markerWidth}" opacity="0.9"
                                   ${settings.showTooltips !== false ? `title="Gene start: ${gene.qualifiers?.gene || gene.type}"` : ''}/>`;
            }
            
            // End marker (arrow) - only if gene actually ends in this line and enabled
            if (settings.showEndArrows !== false && gene.end >= lineStartAbs + 1 && gene.end <= lineEndAbs) {
                // For reverse genes, the end arrow should be at the LEFT end (transcription direction)
                indicator += this.createGeneEndArrow(startX, barHeight, geneColor, isForward, gene, settings);
            }
        }
        
        return indicator;
    }

    /**
     * Create gene body shape based on gene type
     */
    createGeneBodyShape(gene, x, width, height, color, geneType, settings = {}) {
        const isForward = gene.strand !== -1;
        const opacity = settings.indicatorOpacity || 0.7;
        const tooltipAttr = settings.showTooltips !== false ? `title="${gene.qualifiers?.gene || gene.type}"` : '';
        const hoverClass = settings.showHoverEffects !== false ? 'gene-indicator-hover' : '';
        
        let shape = '';
        
        if (geneType === 'promoter') {
            // Simple arrow for promoter
            if (isForward) {
                shape = `<path d="M ${x} 3 L ${x + width - 6} 3 L ${x + width} ${height/2} L ${x + width - 6} ${height - 3} L ${x} ${height - 3} Z" 
                               fill="${color}" opacity="${opacity}" ${tooltipAttr} class="${hoverClass}"/>`;
            } else {
                shape = `<path d="M ${x + 6} 3 L ${x + width} 3 L ${x + width} ${height - 3} L ${x + 6} ${height - 3} L ${x} ${height/2} Z" 
                               fill="${color}" opacity="${opacity}" ${tooltipAttr} class="${hoverClass}"/>`;
            }
        } else if (geneType === 'terminator') {
            // Rectangle with rounded ends for terminator
            shape = `<rect x="${x}" y="3" width="${width}" height="${height - 6}" rx="3" ry="3" 
                           fill="${color}" opacity="${opacity}" ${tooltipAttr} class="${hoverClass}"/>`;
        } else if (['trna', 'rrna', 'mrna'].includes(geneType)) {
            // Wavy shape for RNA
            const waveHeight = 2;
            shape = `<path d="M ${x} ${3 + waveHeight} 
                            Q ${x + width/4} 3 ${x + width/2} ${3 + waveHeight/2}
                            Q ${x + 3*width/4} 3 ${x + width} ${3 + waveHeight}
                            L ${x + width} ${height - 3}
                            L ${x} ${height - 3} Z" 
                            fill="${color}" opacity="${opacity}" ${tooltipAttr} class="${hoverClass}"/>`;
        } else {
            // Default rectangle for CDS and others
            shape = `<rect x="${x}" y="3" width="${width}" height="${height - 6}" 
                           fill="${color}" opacity="${opacity}" ${tooltipAttr} class="${hoverClass}"/>`;
        }
        
        return shape;
    }

    /**
     * Create end arrow marker to show gene direction and termination
     */
    createGeneEndArrow(x, height, color, isForward, gene, settings = {}) {
        const arrowSize = settings.arrowSize || 12; // Use settings or default
        const arrowHeightPercent = settings.arrowHeight || 200;
        const arrowHeight = (height * arrowHeightPercent / 100);
        const arrowOffset = (height - arrowHeight) / 2;
        const darkColor = this.darkenHexColor(color, 40);
        const tooltipAttr = settings.showTooltips !== false ? 
            `title="Gene end (${gene.qualifiers?.gene || gene.type}) ${isForward ? '→' : '←'}"` : '';
        const hoverClass = settings.showHoverEffects !== false ? 'gene-indicator-hover' : '';
        
        let arrow = '';
        
        const arrowTop = arrowOffset;
        const arrowMiddle = height / 2;
        const arrowBottom = arrowOffset + arrowHeight;
        
        if (isForward) {
            // Right-pointing arrow
            arrow = `<path d="M ${x-arrowSize} ${arrowTop} L ${x} ${arrowMiddle} L ${x-arrowSize} ${arrowBottom} Z" 
                           fill="${darkColor}" opacity="1" ${tooltipAttr} class="${hoverClass}"/>`;
        } else {
            // Left-pointing arrow
            arrow = `<path d="M ${x+arrowSize} ${arrowTop} L ${x} ${arrowMiddle} L ${x+arrowSize} ${arrowBottom} Z" 
                           fill="${darkColor}" opacity="1" ${tooltipAttr} class="${hoverClass}"/>`;
        }
        
        return arrow;
    }

    /**
     * Create simple indicator shape with colors consistent with Genes & Features track
     */
    createSimpleIndicatorShape(feature, x, width, height, operons) {
        const operonInfo = this.genomeBrowser.getGeneOperonInfo(feature, operons);
        const geneType = feature.type.toLowerCase();
        const isForward = feature.strand !== -1;
        
        // Use the same colors as Genes & Features track
        let fillColor = operonInfo ? operonInfo.color : this.getFeatureTypeColor(feature.type);
        
        let shape = '';
        
        if (geneType === 'promoter') {
            // Simple arrow for promoter
            if (isForward) {
                shape = `<path d="M ${x} 1 L ${x + width - 3} 1 L ${x + width} ${height/2} L ${x + width - 3} ${height - 1} L ${x} ${height - 1} Z" 
                               fill="${fillColor}" opacity="0.8" title="${feature.qualifiers?.gene || feature.type}"/>`;
            } else {
                shape = `<path d="M ${x + 3} 1 L ${x + width} 1 L ${x + width} ${height - 1} L ${x + 3} ${height - 1} L ${x} ${height/2} Z" 
                               fill="${fillColor}" opacity="0.8" title="${feature.qualifiers?.gene || feature.type}"/>`;
            }
        } else if (geneType === 'terminator') {
            // Rounded rectangle for terminator
            shape = `<rect x="${x}" y="1" width="${width}" height="${height - 2}" rx="2" ry="2" 
                           fill="${fillColor}" opacity="0.8" title="${feature.qualifiers?.gene || feature.type}"/>`;
        } else if (['trna', 'rrna', 'mrna'].includes(geneType)) {
            // Wavy top for RNA
            const waveHeight = 1;
            shape = `<path d="M ${x} ${1 + waveHeight} 
                            Q ${x + width/4} 1 ${x + width/2} ${1 + waveHeight/2}
                            Q ${x + 3*width/4} 1 ${x + width} ${1 + waveHeight}
                            L ${x + width} ${height - 1}
                            L ${x} ${height - 1} Z" 
                            fill="${fillColor}" opacity="0.8" title="${feature.qualifiers?.gene || feature.type}"/>`;
        } else {
            // Simple rectangle for CDS and others
            shape = `<rect x="${x}" y="1" width="${width}" height="${height - 2}" 
                           fill="${fillColor}" opacity="0.8" title="${feature.qualifiers?.gene || feature.type}"/>`;
        }
        
        return shape;
    }

    /**
     * Get sequence track settings from trackRenderer
     */
    getSequenceTrackSettings() {
        // Try to get settings from trackRenderer if available
        if (this.genomeBrowser.trackRenderer && this.genomeBrowser.trackRenderer.getTrackSettings) {
            return this.genomeBrowser.trackRenderer.getTrackSettings('sequence');
        }
        
        // Return default settings if trackRenderer not available
        return {
            showIndicators: true,
            indicatorHeight: 8,
            indicatorOpacity: 0.7,
            showStartMarkers: true,
            showEndArrows: true,
            startMarkerWidth: 6,
            startMarkerHeight: 200,
            arrowSize: 12,
            arrowHeight: 200,
            showCDS: true,
            showRNA: true,
            showPromoter: true,
            showTerminator: true,
            showRegulatory: true,
            showTooltips: true,
            showHoverEffects: true
        };
    }

    /**
     * Clear all performance caches
     */
    clearRenderCache() {
        this.renderCache.clear();
        this.featureCache.clear();
        this.colorCache.clear();
        this.svgCache.clear();
        console.log('🔧 [SequenceUtils] Performance caches cleared');
    }
    
    /**
     * Get cache key for sequence line
     */
    getSequenceLineCacheKey(lineSubsequence, lineStartPos, chromosome) {
        return `${chromosome}:${lineStartPos}:${lineSubsequence.length}:${lineSubsequence.substring(0, 10)}`;
    }
    
    /**
     * Check if render parameters have changed significantly
     */
    shouldInvalidateCache(chromosome, viewStart, viewEnd, annotations) {
        if (!this.lastRenderParams) return true;
        
        const params = this.lastRenderParams;
        return (
            params.chromosome !== chromosome ||
            params.viewStart !== viewStart ||
            params.viewEnd !== viewEnd ||
            params.annotationCount !== annotations.length ||
            params.annotationHash !== this.getAnnotationHash(annotations)
        );
    }
    
    /**
     * Get simple hash for annotations to detect changes
     */
    getAnnotationHash(annotations) {
        if (!annotations || annotations.length === 0) return '0';
        return annotations.length + ':' + annotations.slice(0, 3).map(a => `${a.start}-${a.end}-${a.type}`).join(',');
    }
    
    /**
     * Update last render parameters
     */
    updateLastRenderParams(chromosome, viewStart, viewEnd, annotations) {
        this.lastRenderParams = {
            chromosome,
            viewStart,
            viewEnd,
            annotationCount: annotations.length,
            annotationHash: this.getAnnotationHash(annotations),
            timestamp: Date.now()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SequenceUtils;
} 