/**
 * SequenceUtils - Handles sequence processing, display, and biological utilities
 *
 * DEPRECATION NOTICE: View-mode cursor system (styles, status updates, and positioning)
 * is scheduled for removal. Do not introduce new dependencies on cursor behavior.
 * Code paths remain for validation only until final removal.
 */
class SequenceUtils {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        
        // Make this instance globally accessible for click handlers
        window.sequenceUtils = this;
        this._cachedCharWidth = null; // Cache for character width measurement
        // VSCode editor and SequenceEditor removed - only using view mode
        
        // Only using view mode - edit mode functionality removed
        
        // Sequence content display mode for View Mode
        this.sequenceContentMode = 'dna-only'; // 'auto', 'dna-only', 'protein-only', 'both'
        
        // Sequence line height configuration (in pixels)
        this.lineHeight = 28; // Default increased from 24px to 28px for better readability
        
        // Sequence line spacing configuration (margin between lines in pixels)
        this.lineSpacing = 8; // Default spacing between sequence lines
        this.minLineSpacing = 12; // Minimum line spacing to maintain readability (configurable in settings)
        
        // Performance optimization caches
        this.renderCache = new Map(); // Cache for rendered sequence lines
        this.featureCache = new Map(); // Cache for feature lookups
        this.colorCache = new Map(); // Cache for color calculations
        this.svgCache = new Map(); // Cache for SVG indicators
        this.lastRenderParams = null; // Track last render parameters
        
        // Virtual scrolling parameters - FIXED: Use actual line height + spacing
        this.virtualScrolling = {
            enabled: false,
            visibleLines: 20,
            bufferLines: 5,
            lineHeight: 36, // FIXED: lineHeight + lineSpacing = 28 + 8 = 36
            scrollTop: 0
        };
        
        // Search highlighting
        this.searchHighlights = [];
        this.highlightColor = 'rgba(255, 215, 0, 0.7)'; // Gold highlighting
        this.lastHighlightedMatches = [];
        
        // Performance monitoring
        this.performanceStats = {
            renderTime: 0,
            cacheHits: 0,
            cacheMisses: 0,
            lastRenderStart: 0
        };
        
        // DEPRECATED: Cursor management for View Mode (scheduled for removal)
        this.cursor = {
            position: -1,        // Absolute genome position
            element: null,       // DOM element for cursor
            visible: false,      // Cursor visibility state
            blinking: false,     // Blinking animation state
            color: '#000000'     // Default cursor color (black)
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
        
        // Load minimum line spacing from settings
        this.loadMinLineSpacingFromSettings();
        
        // Cursor system removed
        
        // Cursor system removed
    }

    /**
     * Setup drag optimization listeners with enhanced stability
     */
    setupDragOptimization() {
        // Listen for standard drag events
        document.addEventListener('dragstart', () => {
            this.dragOptimization.isDragging = true;
            console.log('🔧 [SequenceUtils] Drag started - enabling render optimization');
        });
        
        document.addEventListener('dragend', () => {
            this.dragOptimization.isDragging = false;
            console.log('🔧 [SequenceUtils] Drag ended - disabling render optimization');
            
            // Execute any pending render
            this.executePendingRender('dragend');
        });
        
        // Listen for custom drag events from NavigationManager (more reliable for genome view dragging)
        document.addEventListener('genomeViewDragStart', () => {
            this.dragOptimization.isDragging = true;
            this.dragOptimization.lastRenderTime = Date.now();
            console.log('🔧 [SequenceUtils] Genome view drag started');
        });
        
        document.addEventListener('genomeViewDragEnd', () => {
            this.dragOptimization.isDragging = false;
            console.log('🔧 [SequenceUtils] Genome view drag ended');
            
            // Execute any pending render with retry mechanism
            this.executePendingRender('genomeViewDragEnd');
        });
        
        // Enhanced safety: Listen for mouse up events to catch missed drag ends
        document.addEventListener('mouseup', () => {
            if (this.dragOptimization.isDragging) {
                console.log('🔧 [SequenceUtils] Force ending drag on mouseup (safety net)');
                this.dragOptimization.isDragging = false;
                this.executePendingRender('mouseup-fallback');
            }
        });
        
        // Periodic check to ensure drag state doesn't get stuck with enhanced recovery
        setInterval(() => {
            if (this.dragOptimization.isDragging) {
                const now = Date.now();
                const timeSinceDrag = now - this.dragOptimization.lastRenderTime;
                
                // If dragging for more than 5 seconds, force reset with fallback render
                if (timeSinceDrag > 5000) {
                    console.warn('⚠️ [SequenceUtils] Force resetting stuck drag state after 5s timeout');
                    this.dragOptimization.isDragging = false;
                    this.executePendingRender('timeout-reset');
                    
                    // Additional fallback if pending render fails
                    setTimeout(() => {
                        if (!this.dragOptimization.pendingRender) {
                            this.forceSequenceRerender();
                        }
                    }, 100);
                }
            }
        }, 1000);
    }
    
    /**
     * Execute pending render with enhanced error handling and recovery
     */
    executePendingRender(trigger) {
        if (this.dragOptimization.pendingRender) {
            console.log(`🔧 [SequenceUtils] Executing pending render (triggered by: ${trigger})`);
            try {
                const renderFunction = this.dragOptimization.pendingRender;
                this.dragOptimization.pendingRender = null; // Clear immediately to prevent re-entry
                
                renderFunction();
                console.log('✅ [SequenceUtils] Pending render executed successfully');
            } catch (error) {
                console.error('❌ [SequenceUtils] Error executing pending render:', error);
                console.error('🔧 [SequenceUtils] Error details:', {
                    trigger,
                    errorMessage: error.message,
                    stack: error.stack
                });
                
                // Try to recover by forcing a re-render with delay to avoid infinite loops
                setTimeout(() => {
                    this.forceSequenceRerender();
                }, 50);
            }
        } else if (trigger === 'genomeViewDragEnd') {
            // Special case: if drag end but no pending render, ensure we still have content
            console.log('🔧 [SequenceUtils] Drag ended but no pending render - checking for blank content');
            const container = document.getElementById('sequenceContent');
            if (container && container.children.length === 0) {
                console.warn('⚠️ [SequenceUtils] Blank content detected after drag - forcing rerender');
                this.forceSequenceRerender();
            }
        }
    }
    
    /**
     * Force a sequence re-render as fallback
     */
    forceSequenceRerender() {
        console.log('🔧 [SequenceUtils] Force re-rendering sequence as fallback');
        try {
            const chromosome = this.genomeBrowser.currentChromosome;
            const sequenceData = this.genomeBrowser.currentSequence;
            if (chromosome && sequenceData && sequenceData[chromosome]) {
                const sequence = sequenceData[chromosome];
                // Clear caches to force fresh render
                this.clearRenderCache();
                this.displayEnhancedSequence(chromosome, sequence);
            }
        } catch (error) {
            console.error('❌ [SequenceUtils] Error in force re-render:', error);
        }
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
        
        // Only using view mode - no edit mode functionality
        
        // Add sequence content mode selector for view mode
            this.addSequenceContentModeSelector();
        
        // Update CSS variables for line height
        this.updateSequenceLineHeightCSS();
        
        // Display sequence using traditional detailed sequence display
            this.displayDetailedSequence(chromosome, sequence, start, end);
        
        // Re-highlight selected gene sequence if there is one
        if (this.genomeBrowser.selectedGene && this.genomeBrowser.selectedGene.gene) {
            // Use setTimeout to ensure the DOM is updated before highlighting
            setTimeout(() => {
                this.genomeBrowser.highlightGeneSequence(this.genomeBrowser.selectedGene.gene);
            }, 100);
        }
        
        // Re-highlight manual text selection if there is one
        if (this.genomeBrowser.currentSequenceSelection) {
            // Use setTimeout to ensure the DOM is updated before highlighting
            setTimeout(() => {
                this.restoreManualSelection(this.genomeBrowser.currentSequenceSelection);
            }, 100);
        }
    }
    
    /**
     * Add sequence content mode selector for View Mode
     */
    addSequenceContentModeSelector() {
        const sequenceControls = document.querySelector('.sequence-controls') || this.createSequenceControlsContainer();
        
        // Check if selector already exists
        if (document.getElementById('sequenceContentModeSelector')) {
            return;
        }
        
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'sequence-content-mode-container';
        selectorContainer.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-left: 10px;
            gap: 8px;
        `;
        
        const label = document.createElement('label');
        label.textContent = 'Display:';
        label.style.cssText = `
            font-size: 12px;
            color: #6c757d;
            font-weight: 500;
        `;
        
        const selector = document.createElement('select');
        selector.id = 'sequenceContentModeSelector';
        selector.className = 'sequence-content-mode-select';
        selector.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 12px;
            background-color: white;
            color: #495057;
            cursor: pointer;
            min-width: 120px;
        `;
        
        const options = [
            { value: 'auto', text: 'Auto (Smart)' },
            { value: 'dna-only', text: 'DNA Only' },
            { value: 'protein-only', text: 'Protein Only' },
            { value: 'both', text: 'DNA + Protein' }
        ];
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            optionElement.selected = option.value === this.sequenceContentMode;
            selector.appendChild(optionElement);
        });
        
        selector.addEventListener('change', (e) => {
            this.sequenceContentMode = e.target.value;
            
            // Re-render the sequence with new mode
            const chromosome = this.genomeBrowser.currentChromosome;
            const sequenceData = this.genomeBrowser.currentSequence;
            if (chromosome && sequenceData && sequenceData[chromosome]) {
                const sequence = sequenceData[chromosome];
                this.displayEnhancedSequence(chromosome, sequence);
            }
        });
        
        selectorContainer.appendChild(label);
        selectorContainer.appendChild(selector);
        sequenceControls.appendChild(selectorContainer);
        
        // Add line height selector
        this.addLineHeightSelector(sequenceControls);
    }
    
    /**
     * Update sequence line height CSS variables and recalculate virtual scrolling
     */
    updateSequenceLineHeightCSS() {
        const root = document.documentElement;
        
        // Remove existing properties first
        root.style.removeProperty('--sequence-line-height');
        root.style.removeProperty('--sequence-line-ratio');
        root.style.removeProperty('--sequence-line-spacing');
        root.style.removeProperty('--min-sequence-line-spacing');
        
        // Calculate line height ratio for better text rendering
        const lineHeightRatio = Math.max(1.2, this.lineHeight / 16); // Ensure minimum ratio of 1.2
        
        // Set CSS custom properties with important flag
        root.style.setProperty('--sequence-line-height', `${this.lineHeight}px`, 'important');
        root.style.setProperty('--sequence-line-ratio', lineHeightRatio.toString(), 'important');
        root.style.setProperty('--sequence-line-spacing', `${this.lineSpacing}px`, 'important');
        root.style.setProperty('--min-sequence-line-spacing', `${this.minLineSpacing}px`, 'important');
        
        // FIXED: Update virtual scrolling line height to match actual rendering
        this.virtualScrolling.lineHeight = this.lineHeight + this.lineSpacing;
        
        console.log(`🔧 [SequenceUtils] Updated line height: ${this.lineHeight}px, spacing: ${this.lineSpacing}px, virtual line height: ${this.virtualScrolling.lineHeight}px`);
        
        // Verify the CSS properties were applied correctly
        setTimeout(() => {
            const appliedLineHeight = getComputedStyle(root).getPropertyValue('--sequence-line-height');
            const appliedSpacing = getComputedStyle(root).getPropertyValue('--sequence-line-spacing');
            console.log(`🔧 [SequenceUtils] Applied CSS - line height: ${appliedLineHeight}, spacing: ${appliedSpacing}`);
        }, 10);
    }
    
    /**
     * Add line height selector to sequence controls
     */
    addLineHeightSelector(sequenceControls) {
        // Check if selector already exists
        if (document.getElementById('sequenceLineHeightSelector')) {
            return;
        }
        
        const lineHeightContainer = document.createElement('div');
        lineHeightContainer.className = 'sequence-line-height-container';
        lineHeightContainer.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-left: 10px;
            gap: 8px;
        `;
        
        const label = document.createElement('label');
        label.textContent = 'Line Height:';
        label.style.cssText = `
            font-size: 12px;
            color: #6c757d;
            font-weight: 500;
        `;
        
        const selector = document.createElement('select');
        selector.id = 'sequenceLineHeightSelector';
        selector.className = 'sequence-line-height-select';
        selector.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 12px;
            background-color: white;
            color: #495057;
            cursor: pointer;
            min-width: 80px;
        `;
        
        const heightOptions = [
            { value: 20, text: 'Compact' },
            { value: 24, text: 'Normal' },
            { value: 28, text: 'Comfortable' },
            { value: 32, text: 'Spacious' },
            { value: 36, text: 'Extra Large' }
        ];
        
        heightOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            optionElement.selected = option.value === this.lineHeight;
            selector.appendChild(optionElement);
        });
        
        selector.addEventListener('change', (e) => {
            this.lineHeight = parseInt(e.target.value);
            
            // Update CSS variables for new line height
            this.updateSequenceLineHeightCSS();
            
            // Clear render cache to force re-render with new line height
            this.clearRenderCache();
            
            // Re-render the sequence with new line height
            const chromosome = this.genomeBrowser.currentChromosome;
            const sequenceData = this.genomeBrowser.currentSequence;
            if (chromosome && sequenceData && sequenceData[chromosome]) {
                const sequence = sequenceData[chromosome];
                this.displayEnhancedSequence(chromosome, sequence);
            }
        });
        
        lineHeightContainer.appendChild(label);
        lineHeightContainer.appendChild(selector);
        
        // Add line spacing selector
        this.addLineSpacingSelector(lineHeightContainer);
        
        sequenceControls.appendChild(lineHeightContainer);
    }
    
    /**
     * Add line spacing selector to line height container
     */
    addLineSpacingSelector(lineHeightContainer) {
        // Check if selector already exists
        if (document.getElementById('sequenceLineSpacingSelector')) {
            return;
        }
        
        const spacingLabel = document.createElement('label');
        spacingLabel.textContent = 'Spacing:';
        spacingLabel.style.cssText = `
            font-size: 12px;
            color: #6c757d;
            font-weight: 500;
            margin-left: 15px;
        `;
        
        const spacingSelector = document.createElement('select');
        spacingSelector.id = 'sequenceLineSpacingSelector';
        spacingSelector.className = 'sequence-line-spacing-select';
        spacingSelector.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 12px;
            background-color: white;
            color: #495057;
            cursor: pointer;
            min-width: 70px;
        `;
        
        const spacingOptions = [
            { value: 2, text: 'Tight' },
            { value: 4, text: 'Close' },
            { value: 6, text: 'Normal' },
            { value: 8, text: 'Relaxed' },
            { value: 12, text: 'Loose' },
            { value: 16, text: 'Wide' }
        ];
        
        spacingOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            optionElement.selected = option.value === this.lineSpacing;
            spacingSelector.appendChild(optionElement);
        });
        
        spacingSelector.addEventListener('change', (e) => {
            this.lineSpacing = parseInt(e.target.value);
            
            // Update CSS variables for new line spacing
            this.updateSequenceLineHeightCSS();
            
            // Clear render cache to force re-render with new line spacing
            this.clearRenderCache();
            
            // Re-render the sequence with new line spacing
            const chromosome = this.genomeBrowser.currentChromosome;
            const sequenceData = this.genomeBrowser.currentSequence;
            if (chromosome && sequenceData && sequenceData[chromosome]) {
                const sequence = sequenceData[chromosome];
                this.displayEnhancedSequence(chromosome, sequence);
            }
        });
        
        lineHeightContainer.appendChild(spacingLabel);
        lineHeightContainer.appendChild(spacingSelector);
    }
    
    /**
     * Create or get sequence controls container
     */
    createSequenceControlsContainer() {
        let sequenceControls = document.querySelector('.sequence-controls');
        if (!sequenceControls) {
            sequenceControls = document.createElement('div');
            sequenceControls.className = 'sequence-controls';
            sequenceControls.style.cssText = `
                display: flex;
                align-items: center;
                padding: 8px 15px;
                background-color: #f8f9fa;
                border-bottom: 1px solid #dee2e6;
                gap: 10px;
            `;
            
            const sequenceDisplay = document.getElementById('sequenceDisplay');
            if (sequenceDisplay) {
                sequenceDisplay.insertBefore(sequenceControls, sequenceDisplay.firstChild);
            }
        }
        return sequenceControls;
    }

    // Mode toggle button method removed - only using view mode
    

    
    // Toggle display mode method removed - only using view mode
    
    // Enable editing mode method removed - only using view mode
    
    // Remove editing button method removed - only using view mode
    
    /**
     * Remove sequence content mode selector when in Edit Mode
     */
    removeSequenceContentModeSelector() {
        const selectorContainer = document.querySelector('.sequence-content-mode-container');
        if (selectorContainer) {
            selectorContainer.remove();
        }
        
        // Also remove line height and spacing selectors
        const lineHeightContainer = document.querySelector('.sequence-line-height-container');
        if (lineHeightContainer) {
            lineHeightContainer.remove();
        }
    }
    

    
    /**
     * Clean up container styles to prevent mode interference
     */
    cleanupContainer() {
        const container = document.getElementById('sequenceContent');
        if (!container) return;
        
        console.log('🔧 [SequenceUtils] Cleaning up container for view mode');
        
        // Store current CSS variables before cleanup to preserve View Mode settings
        const preservedVars = {
            lineHeight: getComputedStyle(document.documentElement).getPropertyValue('--sequence-line-height'),
            lineRatio: getComputedStyle(document.documentElement).getPropertyValue('--sequence-line-ratio'),
            lineSpacing: getComputedStyle(document.documentElement).getPropertyValue('--sequence-line-spacing')
        };
        
        // VSCode editor and SequenceEditor removed - only using view mode
        
        // Clear container content
        container.innerHTML = '';
        
        // Only using view mode - clean up any remaining edit mode styles
            const editModeStyles = [
                'font-family', 'font-size', 'background', 'color', 
                'overflow', 'position', 'min-height', 'height'
            ];
            
            editModeStyles.forEach(prop => {
                container.style.removeProperty(prop);
            });
            
            // Reset container class to default sequence content
            container.className = 'sequence-content';
            
            // Remove VS Code editor specific classes
            container.classList.remove('vscode-sequence-editor');
            
            // Immediately restore View Mode CSS variables with verification
            this.updateSequenceLineHeightCSS();
            
            // Force style recalculation and verify
            setTimeout(() => {
                const currentVars = {
                    lineHeight: getComputedStyle(document.documentElement).getPropertyValue('--sequence-line-height'),
                    lineRatio: getComputedStyle(document.documentElement).getPropertyValue('--sequence-line-ratio'),
                    lineSpacing: getComputedStyle(document.documentElement).getPropertyValue('--sequence-line-spacing')
                };
                
                console.log('✅ [SequenceUtils] View Mode CSS variables verification:', {
                    expected: { lineHeight: this.lineHeight + 'px', lineSpacing: this.lineSpacing + 'px' },
                    actual: currentVars
                });
            }, 10);
        
        // Clear any problematic inline styles from child elements
        const inlineStyles = container.querySelectorAll('[style]');
        inlineStyles.forEach(element => {
            // Only clear if it's not a sequence-specific style we want to keep
            if (!element.classList.contains('sequence-line') && 
                !element.classList.contains('sequence-position') && 
                !element.classList.contains('gene-indicator-line') &&
                !element.classList.contains('sequence-bases')) {
                element.removeAttribute('style');
            }
        });
        
        // Clear render cache to ensure fresh rendering
        this.clearRenderCache();
        
        console.log('✅ [SequenceUtils] Container cleanup completed for view mode');
    }
    
    // VSCode sequence editor method removed - only using view mode

    measureCharacterWidth(container) {
        // Return cached value if available
        if (this._cachedCharWidth) {
            return this._cachedCharWidth;
        }
        
        // Use multiple measurements for better accuracy
        const measurements = [];
        const charCounts = [16, 32, 64]; // Use different character counts for validation
        
        charCounts.forEach(count => {
            const testElement = document.createElement('span');
            testElement.textContent = 'ATCG'.repeat(count / 4);
            testElement.style.cssText = `
                font-family: 'Courier New', monospace;
                font-size: 14px;
                font-weight: 600;
                visibility: hidden;
                position: absolute;
                white-space: nowrap;
                letter-spacing: 1px;
            `;
            
            container.appendChild(testElement);
            const totalWidth = testElement.offsetWidth;
            const charWidth = totalWidth / count;
            container.removeChild(testElement);
            
            if (charWidth > 0) {
                measurements.push(charWidth);
            }
        });
        
        // Calculate average and standard deviation for validation
        const average = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const variance = measurements.reduce((a, b) => a + Math.pow(b - average, 2), 0) / measurements.length;
        const stdDev = Math.sqrt(variance);
        
        // Use the most consistent measurement (lowest variance)
        const mostConsistent = measurements.reduce((prev, current) => 
            Math.abs(current - average) < Math.abs(prev - average) ? current : prev
        );
        
        // Use actual measured width, with a fallback if measurement fails
        this._cachedCharWidth = mostConsistent > 0 ? mostConsistent : 9.5;
        
        console.log('🔧 [SequenceUtils] Character width measurement:', {
            measurements: measurements.map(m => m.toFixed(3)),
            average: average.toFixed(3),
            stdDev: stdDev.toFixed(3),
            selectedWidth: this._cachedCharWidth.toFixed(3),
            effectiveCharWidth: (this._cachedCharWidth + 1).toFixed(3)
        });
        
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
        // Reset overflow and height - they will be set properly in render methods
        container.style.removeProperty('overflow');
        container.style.removeProperty('height');
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
        const marginRight = 15; // Position span margin-right
        const padding = 30; // Container padding
        const availableWidth = containerWidth - positionWidth - marginRight - padding;
        
        // Calculate optimal line length with better precision
        // FIX: Letter-spacing is already included in character width measurement
        const effectiveCharWidth = charWidth; // Remove +1 extra spacing
        const optimalLineLength = Math.max(10, Math.floor(availableWidth / effectiveCharWidth));
        
        // Calculate actual width that will be used
        const actualUsedWidth = optimalLineLength * effectiveCharWidth;
        const remainingWidth = availableWidth - actualUsedWidth;
        
        console.log('🔧 [SequenceUtils] Width calculation details:', {
            containerWidth,
            availableWidth,
            charWidth,
            effectiveCharWidth,
            optimalLineLength,
            actualUsedWidth,
            remainingWidth
        });
        
        console.log('🔧 [SequenceUtils] Line calculation:', {
            containerWidth,
            charWidth,
            effectiveCharWidth,
            availableWidth,
            optimalLineLength,
            actualUsedWidth,
            remainingWidth,
            utilizationPercentage: ((actualUsedWidth / availableWidth) * 100).toFixed(1) + '%'
        });
        
        // If there's significant unused space, try to optimize
        if (remainingWidth > effectiveCharWidth && optimalLineLength < 100) {
            const additionalChars = Math.floor(remainingWidth / effectiveCharWidth);
            const newOptimalLength = optimalLineLength + additionalChars;
            console.log('🔧 [SequenceUtils] Optimizing line length:', {
                originalLength: optimalLineLength,
                additionalChars,
                newLength: newOptimalLength,
                newUsedWidth: newOptimalLength * effectiveCharWidth
            });
            // Use the optimized length if it doesn't exceed container
            if (newOptimalLength * effectiveCharWidth <= availableWidth) {
                optimalLineLength = newOptimalLength;
            }
        }
        
        // Get sequence track settings
        const sequenceSettings = this.getSequenceTrackSettings();
        
        // Pre-compute feature lookups for better performance
        const featureLookup = this.buildFeatureLookup(annotations, viewStart, viewEnd);
        
        // Enable virtual scrolling for sequences that actually need it
        const totalLines = Math.ceil(subsequence.length / optimalLineLength);
        // Estimate if the content will overflow the container
        const estimatedContentHeight = totalLines * (this.lineHeight + this.lineSpacing);
        const estimatedContainerHeight = container.getBoundingClientRect().height || 400;
        const enableVirtualScrolling = totalLines > 50 && estimatedContentHeight > estimatedContainerHeight * 1.5;
        
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
            estimatedContentHeight: estimatedContentHeight,
            estimatedContainerHeight: estimatedContainerHeight,
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
        // Ensure parent container has proper scrolling enabled
        container.style.overflow = 'auto';
        container.style.height = '100%';
        
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        tempDiv.className = 'detailed-sequence-view';
        
        // Calculate viewEnd based on subsequence length
        const viewEnd = viewStart + subsequence.length - 1;
        
        // Batch DOM operations
        const linesToRender = [];
        for (let i = 0; i < subsequence.length; i += optimalLineLength) {
            const lineSubsequence = subsequence.substring(i, i + optimalLineLength);
            const lineStartPos = viewStart + i;
            linesToRender.push({ lineSubsequence, lineStartPos, index: i });
        }
        
        // Render lines in batches to avoid blocking the UI (only if DNA should be shown)
        const shouldShowDNA = this.shouldShowDNASequence(subsequence.length);
        if (shouldShowDNA) {
            this.renderSequenceLinesBatch(tempDiv, linesToRender, chromosome, annotations, operons, charWidth, sequenceSettings, featureLookup, 0);
        }
        
        // Add protein translations based on content mode
        this.addProteinTranslationsConditional(tempDiv, chromosome, subsequence, viewStart, viewEnd, annotations);
        
        container.appendChild(tempDiv);
        
        // Log container info for debugging
        const totalLines = Math.ceil(subsequence.length / optimalLineLength);
        console.log('🔧 [SequenceUtils] Full sequence render:', {
            totalLines,
            containerHeight: container.getBoundingClientRect().height,
            scrollHeight: container.scrollHeight,
            needsScrolling: container.scrollHeight > container.clientHeight
        });
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
        
        // Calculate indicator positioning first for dynamic sequence line spacing
        const positionWidth = 100; // position span width
        const marginRight = 15;    // margin-right of position span
        const alignmentOffset = positionWidth + marginRight;
        const horizontalAdjustment = charWidth * 0.8; // Add horizontal offset to compensate for character centering
        
        // Apply position and size corrections from settings
        const horizontalOffset = sequenceSettings.horizontalOffset || 0;
        const verticalOffset = sequenceSettings.verticalOffset || 0;
        const heightCorrection = (sequenceSettings.heightCorrection || 100) / 100;
        
        // Position indicator directly below the sequence text with minimal gap
        const indicatorMarginTop = -6; // Negative to move up closer to sequence text
        const indicatorMarginBottom = 4; // Small gap before next sequence line
        const correctedMarginTop = indicatorMarginTop + verticalOffset;
        const correctedMarginBottom = indicatorMarginBottom - verticalOffset;
        
        const lineGroup = document.createElement('div');
        lineGroup.className = 'sequence-line-group';
        lineGroup.style.marginBottom = `${this.lineSpacing}px`;
        
        // Create sequence line with configurable height to prevent compression
        const sequenceLine = document.createElement('div');
        sequenceLine.className = 'sequence-line';
        // Use configurable line height with appropriate line-height ratio
        const lineHeightRatio = Math.max(1.2, this.lineHeight / 16); // Ensure minimum ratio of 1.2
        // Use dynamic margin-bottom that works with gene indicator positioning
        const sequenceLineMarginBottom = Math.max(4, correctedMarginBottom + 6); // Ensure enough space for gene indicators
        sequenceLine.style.cssText = `display: flex; margin-bottom: ${sequenceLineMarginBottom}px; font-family: "Courier New", monospace; font-size: 14px; line-height: ${lineHeightRatio}; min-height: ${this.lineHeight}px; padding: 4px 0;`;
        
        // Position label
        const positionSpan = document.createElement('span');
        positionSpan.className = 'sequence-position';
        positionSpan.style.cssText = 'width: 100px; color: #6c757d; font-weight: 600; margin-right: 15px; text-align: right; flex-shrink: 0;';
        positionSpan.textContent = (lineStartPos + 1).toLocaleString();
        
        // Sequence bases
        const basesDiv = document.createElement('div');
        basesDiv.className = 'sequence-bases';
        basesDiv.style.cssText = 'flex: 1; white-space: nowrap; font-family: "Courier New", monospace; font-size: 14px; line-height: 1.6; letter-spacing: 1px; overflow: hidden;';
        basesDiv.innerHTML = this.colorizeSequenceWithFeaturesOptimized(lineSubsequence, lineStartPos, featureLookup, operons);
        
        // Apply search highlighting if any highlights overlap with this line
        this.applySearchHighlightToLine(basesDiv, lineStartPos, lineSubsequence.length);
        
        sequenceLine.appendChild(positionSpan);
        sequenceLine.appendChild(basesDiv);
        
        // Gene indicator line - use pre-calculated values
        const indicatorLine = document.createElement('div');
        indicatorLine.className = 'gene-indicator-line';
        
        const finalLeftMargin = alignmentOffset - horizontalAdjustment + horizontalOffset;
        const correctedHeight = 12 * heightCorrection;
        
        // Use both inline styles and CSS variables to ensure our spacing takes effect
        indicatorLine.style.cssText = `height: ${correctedHeight}px; margin-left: ${finalLeftMargin}px; margin-bottom: ${correctedMarginBottom}px; margin-top: ${correctedMarginTop}px;`;
        
        // Also set CSS variables to override the !important styles in sequence-tracks.css
        document.documentElement.style.setProperty('--sequence-line-spacing', `${Math.max(4, correctedMarginBottom)}px`);
        document.documentElement.style.setProperty('--min-sequence-line-spacing', `${Math.max(4, correctedMarginBottom)}px`);
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
                // Ensure cursor text is included even for cached styles
                if (!style.includes('cursor: text')) {
                    style += ' cursor: text;';
                }
                this.performanceStats.cacheHits++;
            } else {
                style = `color: ${baseTextColor}; font-size: ${baseFontSize}; display: inline-block; padding: 0; margin: 0; vertical-align: top; cursor: text;`;
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
            // Removed click handler for cursor positioning
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
        const widthCorrection = (settings.widthCorrection || 100) / 100;
        const lineWidth = sequence.length * charWidth * widthCorrection;
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
            if (geneType === 'source' && settings.showSource === false) return false;
            
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
     * Render virtualized sequence with corrected line height calculation
     */
    renderVirtualizedSequence(container, chromosome, subsequence, viewStart, annotations, operons, charWidth, optimalLineLength, sequenceSettings, featureLookup) {
        console.log('🔧 [SequenceUtils] Using virtualized rendering for large sequence');
        
        const totalLines = Math.ceil(subsequence.length / optimalLineLength);
        
        // FIXED: Use actual line height + spacing for virtual scrolling
        const actualLineHeight = this.lineHeight + this.lineSpacing;
        
        // Calculate actual available height from the parent container
        const parentContainer = document.getElementById('sequenceContent');
        const sequenceDisplaySection = document.getElementById('sequenceDisplaySection');
        let availableHeight = 400; // Default fallback
        
        if (parentContainer) {
            // Get the actual available height from the parent container
            const parentRect = parentContainer.getBoundingClientRect();
            const parentStyles = window.getComputedStyle(parentContainer);
            const paddingTop = parseInt(parentStyles.paddingTop) || 0;
            const paddingBottom = parseInt(parentStyles.paddingBottom) || 0;
            availableHeight = Math.max(200, parentRect.height - paddingTop - paddingBottom);
            
            console.log('🔧 [SequenceUtils] Parent container height calculation:', {
                parentHeight: parentRect.height,
                paddingTop,
                paddingBottom,
                availableHeight
            });
        } else if (sequenceDisplaySection) {
            const sectionRect = sequenceDisplaySection.getBoundingClientRect();
            const sequenceHeader = document.querySelector('.sequence-header');
            const headerHeight = sequenceHeader ? sequenceHeader.offsetHeight : 60;
            availableHeight = Math.max(200, sectionRect.height - headerHeight - 40);
        }
        
        // Calculate total content height
        const maxPossibleHeight = totalLines * actualLineHeight;
        
        // Determine if we need scrolling based on content exceeding available space
        const needsScrolling = maxPossibleHeight > availableHeight;
        const containerHeight = needsScrolling ? availableHeight : maxPossibleHeight;
        
        // Calculate how many lines can fit in the available height
        const dynamicVisibleLines = Math.floor(availableHeight / actualLineHeight);
        
        console.log(`🔧 [SequenceUtils] Container sizing: available=${availableHeight}px, calculated=${containerHeight}px, lines=${totalLines}, visible=${dynamicVisibleLines}, needsScrolling=${needsScrolling}, actualLineHeight=${actualLineHeight}px`);
        
        // Disable parent container scrolling to avoid conflicts
        container.style.overflow = 'hidden';
        container.style.height = '100%';
        
        // Create virtualized container that takes full parent space
        const virtualContainer = document.createElement('div');
        virtualContainer.className = 'detailed-sequence-view virtualized';
        virtualContainer.style.cssText = `
            height: 100%;
            width: 100%;
            overflow-y: ${needsScrolling ? 'auto' : 'hidden'};
            overflow-x: hidden;
            position: relative;
            box-sizing: border-box;
        `;
        
        // Viewport for visible lines - set proper height for scrolling
        const viewport = document.createElement('div');
        viewport.className = 'virtual-viewport';
        viewport.style.cssText = `
            height: ${maxPossibleHeight}px;
            position: relative;
            width: 100%;
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
        
        // Store dynamic parameters for scroll handling
        const virtualScrollingParams = {
            ...this.virtualScrolling,
            lineHeight: actualLineHeight, // FIXED: Use actual line height
            visibleLines: dynamicVisibleLines,
            containerHeight: containerHeight,
            totalLines: totalLines,
            needsScrolling: needsScrolling
        };
        
        // Initial render (only if DNA should be shown)
        const shouldShowDNA = this.shouldShowDNASequence(subsequence.length);
        if (shouldShowDNA) {
            this.updateVirtualizedContent(visibleContent, 0, chromosome, subsequence, viewStart, annotations, operons, charWidth, optimalLineLength, sequenceSettings, featureLookup, totalLines, virtualScrollingParams);
        }
        
        // Scroll handler for virtual scrolling (only if scrolling is needed)
        if (needsScrolling) {
            let scrollTimeout;
            virtualContainer.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    const scrollTop = virtualContainer.scrollTop;
                    this.updateVirtualizedContent(visibleContent, scrollTop, chromosome, subsequence, viewStart, annotations, operons, charWidth, optimalLineLength, sequenceSettings, featureLookup, totalLines, virtualScrollingParams);
                }, 16); // ~60fps
            });
        }
        
        container.appendChild(virtualContainer);
        
        // Add protein translations below based on content mode
        this.addProteinTranslationsConditional(container, chromosome, subsequence, viewStart, viewStart + subsequence.length, annotations);
    }
    
    /**
     * Update virtualized content based on scroll position with corrected line height
     */
    updateVirtualizedContent(visibleContent, scrollTop, chromosome, subsequence, viewStart, annotations, operons, charWidth, optimalLineLength, sequenceSettings, featureLookup, totalLines, virtualScrollingParams = null) {
        // Use dynamic parameters if provided, otherwise fall back to instance parameters
        const params = virtualScrollingParams || this.virtualScrolling;
        const lineHeight = params.lineHeight || (this.lineHeight + this.lineSpacing); // FIXED: Use actual line height
        const visibleLines = params.visibleLines;
        const bufferLines = params.bufferLines;
        
        const startLine = Math.max(0, Math.floor(scrollTop / lineHeight) - bufferLines);
        const endLine = Math.min(totalLines, startLine + visibleLines + bufferLines * 2);
        
        // FIXED: Save selection state before clearing content
        const savedSelection = this.saveSelectionState();
        
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
            lineElement.style.top = `${lineIndex * lineHeight}px`; // FIXED: Use correct line height
            lineElement.style.left = '0';
            // Calculate actual width needed instead of using right: 0
            const effectiveCharWidth = charWidth; // FIX: Remove +1 extra spacing
            const positionWidth = 100;
            const marginRight = 15;
            const padding = 30;
            const actualLineWidth = positionWidth + marginRight + (lineSubsequence.length * effectiveCharWidth) + padding;
            lineElement.style.width = `${actualLineWidth}px`;
            
            visibleContent.appendChild(lineElement);
        }
        
        // FIXED: Restore selection state after content update - use setTimeout to ensure DOM is ready
        if (savedSelection) {
            setTimeout(() => {
                this.restoreSelectionState(savedSelection);
            }, 0);
        }
        
        console.log(`🔧 [SequenceUtils] Virtual scroll update: lines ${startLine}-${endLine} of ${totalLines}, scrollTop=${scrollTop}px, lineHeight=${lineHeight}px`);
    }
    
    /**
     * Add protein translations section conditionally based on content mode
     */
    addProteinTranslationsConditional(container, chromosome, subsequence, viewStart, viewEnd, annotations) {
        const shouldShowProtein = this.shouldShowProteinSequence(subsequence.length);
        const shouldShowDNA = this.shouldShowDNASequence(subsequence.length);
        
        if (this.sequenceContentMode === 'protein-only' && !shouldShowDNA) {
            // For protein-only mode when DNA is not shown, clear DNA content and show only proteins
            this.renderProteinOnlyMode(container, chromosome, subsequence, viewStart, viewEnd, annotations);
        } else if (shouldShowProtein) {
            // Add protein translations in addition to DNA
            this.addProteinTranslations(container, chromosome, subsequence, viewStart, viewEnd, annotations);
        }
    }
    
    /**
     * Determine if DNA sequence should be shown based on content mode and zoom level
     */
    shouldShowDNASequence(sequenceLength) {
        switch (this.sequenceContentMode) {
            case 'dna-only':
                return true;
            case 'protein-only':
                return false;
            case 'both':
                return true;
            case 'auto':
            default:
                // Auto mode: show DNA when zoomed in enough (less than 5000 bp)
                return sequenceLength <= 5000;
        }
    }
    
    /**
     * Determine if protein sequence should be shown based on content mode and zoom level
     */
    shouldShowProteinSequence(sequenceLength) {
        switch (this.sequenceContentMode) {
            case 'dna-only':
                return false;
            case 'protein-only':
                return true;
            case 'both':
                return true;
            case 'auto':
            default:
                // Auto mode: show protein when very zoomed in (less than 2000 bp) or when DNA is not shown
                return sequenceLength <= 2000 || sequenceLength > 5000;
        }
    }
    
    /**
     * Render protein-only mode with consistent DNA-style formatting
     */
    renderProteinOnlyMode(container, chromosome, subsequence, viewStart, viewEnd, annotations) {
        const cdsFeatures = annotations.filter(feature => 
            feature.type === 'CDS' &&
            feature.start <= viewEnd && feature.end >= viewStart &&
            this.genomeBrowser.shouldShowGeneType('CDS')
        );
        
        if (cdsFeatures.length === 0) {
            const noProteinMsg = document.createElement('div');
            noProteinMsg.className = 'no-proteins-message';
            noProteinMsg.textContent = 'No protein-coding sequences in this region';
            container.appendChild(noProteinMsg);
            return;
        }
        
        // Clear existing DNA content
        container.innerHTML = '';
        
        const proteinContainer = document.createElement('div');
        proteinContainer.className = 'detailed-sequence-view protein-only-mode';
        
        cdsFeatures.forEach(cds => {
            const fullSequence = this.genomeBrowser.currentSequence[chromosome];
            const dnaForTranslation = fullSequence.substring(cds.start - 1, cds.end);
            const proteinSequence = this.translateDNA(dnaForTranslation, cds.strand);
            const geneName = cds.qualifiers.gene || cds.qualifiers.locus_tag || 'Unknown';
            
            // Create protein section with DNA-style formatting
            const proteinSection = document.createElement('div');
            proteinSection.className = 'protein-sequence-section';
            proteinSection.style.marginBottom = '20px';
            
            // Header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'sequence-info';
            headerDiv.innerHTML = `<strong>${geneName} (${cds.start}-${cds.end}, ${cds.strand === -1 ? '-' : '+'} strand) - Protein Sequence:</strong>`;
            proteinSection.appendChild(headerDiv);
            
            // Render protein sequence with DNA-style line formatting
            const optimalLineLength = 60; // Same as DNA display
            for (let i = 0; i < proteinSequence.length; i += optimalLineLength) {
                const lineSubsequence = proteinSequence.substring(i, i + optimalLineLength);
                const lineStartPos = i; // Protein position
                
                const lineGroup = document.createElement('div');
                lineGroup.className = 'sequence-line-group';
                lineGroup.style.marginBottom = `${this.lineSpacing}px`;
                
                // Create sequence line with same styling as DNA and configurable height
                const sequenceLine = document.createElement('div');
                sequenceLine.className = 'sequence-line';
                // Use configurable line height with appropriate line-height ratio (same as DNA)
                const lineHeightRatio = Math.max(1.2, this.lineHeight / 16); // Ensure minimum ratio of 1.2
                sequenceLine.style.cssText = `display: flex; margin-bottom: 8px; font-family: "Courier New", monospace; font-size: 14px; line-height: ${lineHeightRatio}; min-height: ${this.lineHeight}px; padding: 4px 0;`;
                
                // Position label (amino acid position)
                const positionSpan = document.createElement('span');
                positionSpan.className = 'sequence-position';
                positionSpan.style.cssText = 'width: 100px; color: #6c757d; font-weight: 600; margin-right: 15px; text-align: right; flex-shrink: 0;';
                positionSpan.textContent = `aa${lineStartPos + 1}`;
                
                // Sequence bases (amino acids)
                const basesDiv = document.createElement('div');
                basesDiv.className = 'sequence-bases';
                basesDiv.style.cssText = 'flex: 1; word-break: break-all; font-family: "Courier New", monospace; font-size: 14px; line-height: 1.6;';
                basesDiv.innerHTML = this.colorizeProteinSequence(lineSubsequence);
                
                sequenceLine.appendChild(positionSpan);
                sequenceLine.appendChild(basesDiv);
                lineGroup.appendChild(sequenceLine);
                proteinSection.appendChild(lineGroup);
            }
            
            proteinContainer.appendChild(proteinSection);
        });
        
        container.appendChild(proteinContainer);
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
        // Use unified translation implementation
        if (window.UnifiedDNATranslation) {
            const result = window.UnifiedDNATranslation.strandBasedTranslateDNA(dnaSequence, strand);
            return result;
        }
        
        // Fallback to original implementation if unified module not available
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
        // Use unified sequence processing implementation
        if (window.UnifiedSequenceProcessing) {
            const result = window.UnifiedSequenceProcessing.legacyReverseComplement(sequence);
            return result;
        }
        
        // Fallback to original implementation if unified module not available
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
            const errorMessage = 'No sequence to copy';
            if (this.genomeBrowser && this.genomeBrowser.uiManager) {
                this.genomeBrowser.uiManager.updateStatus(errorMessage);
            } else {
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = errorMessage;
                }
            }
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
                    const errorMessage = 'Please click on a gene in the Gene Track or drag to select sequence, then click Copy again.';
                    if (this.genomeBrowser && this.genomeBrowser.uiManager) {
                        this.genomeBrowser.uiManager.updateStatus(errorMessage);
                    } else {
                        const statusElement = document.getElementById('statusText');
                        if (statusElement) {
                            statusElement.textContent = errorMessage;
                        }
                    }
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
            // Update status bar instead of showing alert
            console.log('🔧 [SequenceUtils] Copy successful, updating status:', copyMessage);
            console.log('🔧 [SequenceUtils] UIManager available:', !!(this.genomeBrowser && this.genomeBrowser.uiManager));
            
            if (this.genomeBrowser && this.genomeBrowser.uiManager) {
                this.genomeBrowser.uiManager.updateStatus(copyMessage, { highlight: true });
            } else {
                // Fallback to status bar update if uiManager is not available
                console.log('🔧 [SequenceUtils] Using fallback status update');
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = copyMessage;
                    // Add visual feedback for copy success
                    statusElement.style.color = '#4CAF50';
                    statusElement.style.fontWeight = 'bold';
                    setTimeout(() => {
                        statusElement.style.color = '';
                        statusElement.style.fontWeight = '';
                    }, 3000);
                }
            }
        }).catch(err => {
            console.error('Failed to copy: ', err);
            const errorMessage = 'Failed to copy to clipboard';
            if (this.genomeBrowser && this.genomeBrowser.uiManager) {
                this.genomeBrowser.uiManager.updateStatus(errorMessage);
            } else {
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = errorMessage;
                }
            }
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
        
        // Update current tab title with new chromosome and position
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.updateCurrentTabPosition(
                chromosome, 
                this.genomeBrowser.currentPosition.start + 1, 
                this.genomeBrowser.currentPosition.end
            );
        }
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
            if (geneType === 'source' && settings.showSource === false) return false;
            
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
        
        // Calculate positions relative to the sequence line with precise alignment
        // Gene coordinates are 1-based, sequence display is 0-based
        // lineStartAbs is 0-based position of the first character in the line
        
        // Calculate the actual start and end positions within this line
        const geneStart1Based = gene.start;
        const geneEnd1Based = gene.end;
        const lineStart1Based = lineStartAbs + 1; // Convert to 1-based
        const lineEnd1Based = lineEndAbs;         // lineEndAbs is already 1-based equivalent
        
        // Find the portion of the gene that overlaps with this line
        const visibleStart1Based = Math.max(geneStart1Based, lineStart1Based);
        const visibleEnd1Based = Math.min(geneEnd1Based, lineEnd1Based);
        
        // Convert to 0-based positions relative to the start of this line
        const geneStartInLine = visibleStart1Based - lineStart1Based;
        const geneEndInLine = visibleEnd1Based - lineStart1Based;
        
        // Convert to pixel positions with character centering and apply width correction
        // Add 0.5 * charWidth to center the indicator on the character
        const widthCorrection = (settings.widthCorrection || 100) / 100;
        const correctedCharWidth = charWidth * widthCorrection;
        const startX = geneStartInLine * correctedCharWidth + (correctedCharWidth * 0.5);
        const endX = (geneEndInLine + 1) * correctedCharWidth + (correctedCharWidth * 0.5);
        const width = endX - startX;
        
        if (width <= 0) return '';
        
        const isForward = gene.strand !== -1;
        const geneType = gene.type.toLowerCase();
        
        // Apply height correction to barHeight
        const heightCorrection = (settings.heightCorrection || 100) / 100;
        const correctedBarHeight = barHeight * heightCorrection;
        
        let indicator = '';
        
        // Gene body shape with corrected height
        indicator += this.createGeneBodyShape(gene, startX, width, correctedBarHeight, geneColor, geneType, settings);
        
        // For forward genes: start marker at left, end arrow at right
        // For reverse genes: start marker at right, end arrow at left
        if (isForward) {
            // Start marker (vertical line) - only if gene actually starts in this line and enabled
            if (settings.showStartMarkers !== false && geneStart1Based >= lineStart1Based && geneStart1Based <= lineEnd1Based) {
                const markerWidth = settings.startMarkerWidth || 6;
                const markerHeightPercent = settings.startMarkerHeight || 200;
                const markerHeight = (correctedBarHeight * markerHeightPercent / 100);
                const markerOffset = (correctedBarHeight - markerHeight) / 2;
                indicator += `<line x1="${startX}" y1="${markerOffset}" x2="${startX}" y2="${markerOffset + markerHeight}" 
                                   stroke="${this.darkenHexColor(geneColor, 30)}" stroke-width="${markerWidth}" opacity="0.9"
                                   ${settings.showTooltips !== false ? `title="Gene start: ${gene.qualifiers?.gene || gene.type}"` : ''}/>`;
            }
            
            // End marker (arrow) - only if gene actually ends in this line and enabled
            if (settings.showEndArrows !== false && geneEnd1Based >= lineStart1Based && geneEnd1Based <= lineEnd1Based) {
                indicator += this.createGeneEndArrow(endX, correctedBarHeight, geneColor, isForward, gene, settings);
            }
        } else {
            // For reverse genes: start marker at right (gene's actual start), end arrow at left (transcription direction)
            // Start marker (vertical line) - only if gene actually starts in this line and enabled
            if (settings.showStartMarkers !== false && geneStart1Based >= lineStart1Based && geneStart1Based <= lineEnd1Based) {
                const markerWidth = settings.startMarkerWidth || 6;
                const markerHeightPercent = settings.startMarkerHeight || 200;
                const markerHeight = (correctedBarHeight * markerHeightPercent / 100);
                const markerOffset = (correctedBarHeight - markerHeight) / 2;
                // For reverse genes, the start marker should be at the RIGHT end (where gene actually starts)
                indicator += `<line x1="${endX}" y1="${markerOffset}" x2="${endX}" y2="${markerOffset + markerHeight}" 
                                   stroke="${this.darkenHexColor(geneColor, 30)}" stroke-width="${markerWidth}" opacity="0.9"
                                   ${settings.showTooltips !== false ? `title="Gene start: ${gene.qualifiers?.gene || gene.type}"` : ''}/>`;
            }
            
            // End marker (arrow) - for reverse genes, show arrow at the FIRST line where gene appears (gene start position)
            if (settings.showEndArrows !== false && geneStart1Based >= lineStart1Based && geneStart1Based <= lineEnd1Based) {
                // For reverse genes, the transcription arrow should be at the LEFT end (first appearance in sequence display)
                indicator += this.createGeneEndArrow(startX, correctedBarHeight, geneColor, isForward, gene, settings);
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
            showSource: false,  // Default: don't show source features
            showTooltips: true,
            showHoverEffects: true,
            // Cursor settings
            cursorColor: '#000000',
            // Position & Size Corrections
            horizontalOffset: 0,
            verticalOffset: 0,
            heightCorrection: 100,
            widthCorrection: 100
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

    // Color and styling utility methods
    
    /**
     * Get color for DNA base
     */
    getBaseColor(base) {
        const colors = {
            'A': '#FF6B6B', // Red
            'T': '#4ECDC4', // Teal
            'G': '#45B7D1', // Blue
            'C': '#96CEB4', // Green
            'N': '#95A5A6'  // Gray for unknown
        };
        return colors[base.toUpperCase()] || colors['N'];
    }
    
    /**
     * Get color for feature type
     */
    getFeatureTypeColor(featureType) {
        const colors = {
            'CDS': '#4CAF50',        // Green
            'mRNA': '#2196F3',       // Blue
            'tRNA': '#2196F3',       // Blue
            'rRNA': '#2196F3',       // Blue
            'promoter': '#FF9800',   // Orange
            'terminator': '#E91E63', // Pink
            'regulatory': '#9C27B0', // Purple
            'gene': '#607D8B',       // Blue Gray
            'misc_feature': '#795548' // Brown
        };
        return colors[featureType] || colors['misc_feature'];
    }
    
    /**
     * Convert hex color to rgba
     */
    hexToRgba(hex, alpha = 1) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    /**
     * Darken a hex color by a percentage
     */
    darkenHexColor(hex, percent) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        // Darken by reducing each component
        const factor = (100 - percent) / 100;
        const newR = Math.round(r * factor);
        const newG = Math.round(g * factor);
        const newB = Math.round(b * factor);
        
        // Convert back to hex
        const toHex = (n) => {
            const hex = n.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        
        return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
    }
    
    /**
     * Colorize protein sequence
     */
    colorizeProteinSequence(proteinSequence) {
        const aminoAcidColors = {
            // Hydrophobic
            'A': '#FFE4B5', 'V': '#FFE4B5', 'L': '#FFE4B5', 'I': '#FFE4B5', 'M': '#FFE4B5',
            'F': '#FFE4B5', 'W': '#FFE4B5', 'P': '#FFE4B5',
            // Polar
            'S': '#E6F3FF', 'T': '#E6F3FF', 'Y': '#E6F3FF', 'N': '#E6F3FF', 'Q': '#E6F3FF',
            'C': '#E6F3FF',
            // Positively charged
            'K': '#FFE6E6', 'R': '#FFE6E6', 'H': '#FFE6E6',
            // Negatively charged
            'D': '#E6FFE6', 'E': '#E6FFE6',
            // Special
            'G': '#F0F0F0', // Glycine - flexible
            '*': '#FF6B6B'  // Stop codon - red
        };
        
        return proteinSequence.split('').map(aa => {
            const color = aminoAcidColors[aa] || '#F0F0F0';
            return `<span style="background-color: ${color}; padding: 1px 2px; margin: 0 1px; border-radius: 2px;">${aa}</span>`;
        }).join('');
    }
    
    /**
     * Set minimum line spacing value to prevent overly tight spacing
     * @param {number} minSpacing - Minimum spacing in pixels (default: 6)
     */
    setMinimumLineSpacing(minSpacing = 6) {
        const oldMin = this.minLineSpacing;
        this.minLineSpacing = Math.max(2, Math.floor(minSpacing)); // Ensure at least 2px minimum
        
        console.log(`🔧 [SequenceUtils] Minimum line spacing updated: ${oldMin}px → ${this.minLineSpacing}px`);
        
        // If current spacing is below new minimum, adjust it
        if (this.lineSpacing < this.minLineSpacing) {
            this.lineSpacing = this.minLineSpacing;
            this.updateSequenceLineHeightCSS();
            
            // Update the UI selector if it exists
            const spacingSelector = document.getElementById('sequenceLineSpacingSelector');
            if (spacingSelector) {
                spacingSelector.value = this.lineSpacing;
            }
            
                         console.log(`🔧 [SequenceUtils] Line spacing adjusted to meet minimum: ${this.lineSpacing}px`);
         }
     }
     
     /**
      * Load minimum line spacing from general settings
      */
     loadMinLineSpacingFromSettings() {
         // Try to get settings from GeneralSettingsManager
         if (window.genomeBrowser && window.genomeBrowser.generalSettingsManager) {
             const settingsManager = window.genomeBrowser.generalSettingsManager;
             if (settingsManager.getSetting) {
                 const minSpacing = settingsManager.getSetting('minLineSpacing', 12);
                 if (minSpacing !== this.minLineSpacing) {
                     console.log(`🔧 [SequenceUtils] Loading minimum line spacing from settings: ${minSpacing}px`);
                     this.setMinimumLineSpacing(minSpacing);
                 }
             }
         } else {
             // Fallback: try to get from localStorage
             try {
                 const generalSettings = JSON.parse(localStorage.getItem('generalSettings') || '{}');
                 if (generalSettings.minLineSpacing && generalSettings.minLineSpacing !== this.minLineSpacing) {
                     console.log(`🔧 [SequenceUtils] Loading minimum line spacing from localStorage: ${generalSettings.minLineSpacing}px`);
                     this.setMinimumLineSpacing(generalSettings.minLineSpacing);
                 }
             } catch (error) {
                 console.warn('⚠️ [SequenceUtils] Could not load minimum line spacing from localStorage:', error);
             }
         }
     }
     
     /**
      * Load cursor settings from sequence track settings
      */
     loadCursorSettings() {
         const settings = this.getSequenceTrackSettings();
         if (settings.cursorColor) {
             this.cursor.color = settings.cursorColor;
         }
     }
     
     /**
      * Initialize cursor styles for View Mode
      */
    // REMOVED: initializeCursorStyles (cursor system deleted)
    initializeCursorStyles() {
         const style = document.createElement('style');
         style.id = 'view-mode-cursor-styles';
         style.textContent = `
             .view-mode-cursor {
                 position: absolute;
                 width: 2px;
                 min-height: 18px;
                 height: auto;
                 background-color: ${this.cursor.color};
                 z-index: 15;
                 pointer-events: none;
                 animation: view-cursor-blink 1.2s infinite;
                 border-radius: 1px;
                 box-shadow: 0 0 2px rgba(255, 255, 255, 0.5);
             }
             
             @keyframes view-cursor-blink {
                 0%, 45% { 
                     opacity: 1; 
                     background-color: ${this.cursor.color};
                 }
                 46%, 54% { 
                     opacity: 0.8; 
                     background-color: ${this.cursor.color};
                 }
                 55%, 100% { 
                     opacity: 0; 
                     background-color: transparent;
                 }
             }
             
             .sequence-bases {
                 position: relative;
                 cursor: text;
             }
             
             .sequence-base-clickable {
                 position: relative;
                 cursor: text;
             }
         `;
         
         // Only add if not already present
         if (!document.getElementById('view-mode-cursor-styles')) {
             document.head.appendChild(style);
         }
     }
     
     /**
      * Update cursor color and refresh styles
      */
    // REMOVED: setCursorColor (cursor system deleted)
    setCursorColor(color) {
         this.cursor.color = color;
         
         // Remove existing styles and recreate with new color
         const existingStyles = document.getElementById('view-mode-cursor-styles');
         if (existingStyles) {
             existingStyles.remove();
         }
         
         this.initializeCursorStyles();
         
         // Update cursor element if it exists
         if (this.cursor.element) {
             this.cursor.element.style.backgroundColor = color;
         }
         
         console.log('🎨 [SequenceUtils] Cursor color updated to:', color);
     }
     
     /**
      * Handle click on sequence base
      */
    // REMOVED: handleSequenceClick (cursor system deleted)
    handleSequenceClick(event, genomicPosition) {
         event.preventDefault();
         event.stopPropagation();
         
         console.log('🖱️ [SequenceUtils] Sequence clicked at position:', genomicPosition);
         
         // Store the clicked element for accurate positioning
         this.clickedElement = event.target;
         this.setCursorPosition(genomicPosition);
     }
     
     /**
      * Position cursor at specific genome position
      */
    // REMOVED: setCursorPosition (cursor system deleted)
    setCursorPosition(genomicPosition) {
         console.log('🎯 [SequenceUtils] Setting cursor position to:', genomicPosition);
         
         this.cursor.position = genomicPosition;
         
         // Update cursor position in ActionManager for paste operations
         if (this.genomeBrowser && this.genomeBrowser.actionManager) {
             this.genomeBrowser.actionManager.setCursorPosition(genomicPosition);
         }
         
         // Update status bar
         this.updateCursorStatus(genomicPosition);
         
         // Create cursor if needed and position it
         this.createAndPositionCursor();
     }
     
     /**
      * Force cursor repositioning (useful after layout changes)
      */
    // REMOVED: repositionCursor (cursor system deleted)
    repositionCursor() {
         if (this.cursor.position >= 0) {
             console.log('🔄 [SequenceUtils] Force repositioning cursor at position:', this.cursor.position);
             this.positionCursorInView();
         }
     }
     
     /**
      * Create and position cursor in the view
      */
    // REMOVED: createAndPositionCursor (cursor system deleted)
    createAndPositionCursor() {
         const container = document.getElementById('sequenceContent');
         if (!container) return;
         
         // Create cursor element if needed
         if (!this.cursor.element) {
             this.cursor.element = document.createElement('div');
             this.cursor.element.className = 'view-mode-cursor';
             this.cursor.element.style.display = 'none';
             container.appendChild(this.cursor.element);
         }
         
         // Find base element at cursor position and show cursor
         const currentPos = this.genomeBrowser.currentPosition;
         if (currentPos && this.cursor.position >= currentPos.start && this.cursor.position <= currentPos.end) {
             // Position cursor at the correct location
             setTimeout(() => {
                 this.positionCursorInView();
             }, 50); // Small delay to ensure DOM is updated
         }
     }
     
     /**
      * Position cursor element in the current view
      */
    // REMOVED: positionCursorInView (cursor system deleted)
    positionCursorInView() {
         if (!this.cursor.element || this.cursor.position < 0) return;
         
         const container = document.getElementById('sequenceContent');
         if (!container) return;
         
         // If we have a clicked element, use its position directly for accuracy
         if (this.clickedElement) {
             this.positionCursorAtElement(this.clickedElement, container);
             this.clickedElement = null;
             return;
         }
         
         // Fallback: find the base element by searching through spans
         const targetSpan = this.findSequenceSpanAtPosition(this.cursor.position, container);
         if (targetSpan) {
             this.positionCursorAtElement(targetSpan, container);
         } else {
             console.warn('🎯 [SequenceUtils] Could not find sequence span for position:', this.cursor.position);
             this.cursor.element.style.display = 'none';
         }
     }
     
     /**
      * Position cursor at a specific DOM element with improved accuracy
      */
    // REMOVED: positionCursorAtElement (cursor system deleted)
    positionCursorAtElement(element, container) {
         if (!element || !container || !this.cursor.element) return;
         
         // Get position coordinates with proper viewport consideration
         const elementRect = element.getBoundingClientRect();
         const containerRect = container.getBoundingClientRect();
         
         // Find the closest sequence line to get proper vertical alignment
         const sequenceLine = element.closest('.sequence-line') || element.closest('.sequence-line-group');
         let lineRect = null;
         if (sequenceLine) {
             lineRect = sequenceLine.getBoundingClientRect();
         }
         
        // Calculate horizontal position (relative to container) accounting for scroll
        const left = (elementRect.left - containerRect.left) + (container.scrollLeft || 0);
         
         // Calculate vertical position with improved accuracy
        let top;
         if (lineRect) {
             // Use the line's top position for better vertical alignment
            top = (lineRect.top - containerRect.top) + (container.scrollTop || 0);
         } else {
             // Fallback to element's top position
            top = (elementRect.top - containerRect.top) + (container.scrollTop || 0);
         }
         
         // Set cursor height to match the sequence line height
         const height = lineRect ? lineRect.height : (elementRect.height || 20);
         
         // Apply positioning with fixed position for stability
         this.cursor.element.style.position = 'absolute';
         this.cursor.element.style.left = Math.round(left) + 'px';
         this.cursor.element.style.top = Math.round(top) + 'px';
         this.cursor.element.style.height = Math.round(height) + 'px';
         this.cursor.element.style.display = 'block';
         this.cursor.element.style.zIndex = '15';
         this.cursor.element.style.pointerEvents = 'none';
         
         console.log('🎯 [SequenceUtils] Cursor positioned with improved accuracy:', {
             genomicPosition: this.cursor.position,
             left: Math.round(left) + 'px',
             top: Math.round(top) + 'px',
             height: Math.round(height) + 'px',
             elementText: element.textContent,
             hasLineRect: !!lineRect,
             containerScrollTop: container.scrollTop,
             containerScrollLeft: container.scrollLeft
         });
     }
     
     /**
      * Find sequence span element at specific genomic position
      */
     findSequenceSpanAtPosition(position, container) {
         // Try multiple selectors for better element finding
         const selectors = [
             `span[onclick*="${position})"]`,
             `span[onclick*="handleSequenceClick(event, ${position})"]`,
             '.base-a, .base-t, .base-g, .base-c, .base-n'
         ];
         
         for (const selector of selectors) {
             const spans = container.querySelectorAll(selector);
             for (const span of spans) {
                 const onclick = span.getAttribute('onclick');
                 if (onclick && onclick.includes(`${position})`)) {
                     return span;
                 }
             }
         }
         
         return null;
     }
     
     /**
      * Setup window resize handler for cursor repositioning
      */
    // REMOVED: setupWindowResizeHandler (cursor system deleted)
    setupWindowResizeHandler() {
         let resizeTimeout;
         
         const handleResize = () => {
             console.log('🔧 [SequenceUtils] Window resized, repositioning cursor...');
             
             // Clear any existing timeout
             clearTimeout(resizeTimeout);
             
             // Debounce the resize event to avoid excessive cursor updates
             resizeTimeout = setTimeout(() => {
                 if (this.cursor.element && this.cursor.position >= 0) {
                     // Re-position cursor after resize
                     this.positionCursorInView();
                 }
             }, 150); // 150ms debounce delay
         };
         
         // Listen for window resize events
         window.addEventListener('resize', handleResize);
         
         // Also listen for container size changes using ResizeObserver if available
         if (typeof ResizeObserver !== 'undefined') {
             const container = document.getElementById('sequenceContent');
             if (container) {
                 const resizeObserver = new ResizeObserver((entries) => {
                     for (const entry of entries) {
                         console.log('🔧 [SequenceUtils] Container resized, repositioning cursor...');
                         handleResize();
                         break; // Only handle the first entry
                     }
                 });
                 
                 resizeObserver.observe(container);
                 
                 // Store reference for cleanup if needed
                 this.resizeObserver = resizeObserver;
             }
         }
     }
     
     /**
      * Update cursor status in status bar
      */
    // REMOVED: updateCursorStatus (cursor system deleted)
    updateCursorStatus(position) {
         const cursorStatusElement = document.getElementById('cursorStatus');
         if (cursorStatusElement && position >= 0) {
             cursorStatusElement.textContent = `Cursor: ${position + 1}`;
         }
     }

    /**
     * Save current text selection state for virtual scrolling
     */
    saveSelectionState() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // Find the sequence container - handle both element and text nodes
        let sequenceContainer;
        if (container.nodeType === Node.ELEMENT_NODE) {
            sequenceContainer = container.closest('.detailed-sequence-view');
        } else {
            // If it's a text node, check its parent element
            sequenceContainer = container.parentElement?.closest('.detailed-sequence-view');
        }
        if (!sequenceContainer) {
            return null;
        }

        // Calculate relative positions within the sequence
        const containerRect = sequenceContainer.getBoundingClientRect();
        const startNode = range.startContainer;
        const endNode = range.endContainer;
        
        // Get genomic positions if possible
        let startPos = null;
        let endPos = null;
        
        // Try to extract genomic position from sequence spans - improved method
        startPos = this.extractGenomicPositionFromNode(startNode, range.startOffset);
        endPos = this.extractGenomicPositionFromNode(endNode, range.endOffset);
        
        // Fallback: try to find position from line context
        if (startPos === null || endPos === null) {
            const startLineElement = startNode.nodeType === Node.TEXT_NODE ? 
                startNode.parentElement?.closest('.sequence-line-group') : 
                startNode.closest?.('.sequence-line-group');
            const endLineElement = endNode.nodeType === Node.TEXT_NODE ? 
                endNode.parentElement?.closest('.sequence-line-group') : 
                endNode.closest?.('.sequence-line-group');
                
            if (startLineElement && startPos === null) {
                startPos = this.extractPositionFromLineElement(startLineElement, startNode, range.startOffset);
            }
            if (endLineElement && endPos === null) {
                endPos = this.extractPositionFromLineElement(endLineElement, endNode, range.endOffset);
            }
        }

        return {
            startPos,
            endPos,
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            startContainer: startNode,
            endContainer: endNode,
            collapsed: range.collapsed,
            timestamp: Date.now()
        };
    }

    /**
     * Extract genomic position from a DOM node
     */
    extractGenomicPositionFromNode(node, offset) {
        if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            const span = node.parentElement.closest('.sequence-bases span');
            if (span && span.onclick) {
                const match = span.onclick.toString().match(/handleSequenceClick\(event,\s*(\d+)\)/);
                if (match) {
                    return parseInt(match[1]) + offset;
                }
            }
        }
        return null;
    }

    /**
     * Extract position from line element context
     */
    extractPositionFromLineElement(lineElement, node, offset) {
        // Find the position span within the line
        const positionSpan = lineElement.querySelector('.sequence-position');
        if (!positionSpan) return null;
        
        // Extract the line start position from the position span
        const positionText = positionSpan.textContent;
        const lineStartMatch = positionText.match(/^(\d+)/);
        if (!lineStartMatch) return null;
        
        const lineStartPos = parseInt(lineStartMatch[1]) - 1; // Convert to 0-based
        
        // Calculate character offset within the line
        const sequenceBases = lineElement.querySelector('.sequence-bases');
        if (!sequenceBases) return null;
        
        // Walk through text nodes to find offset
        let charOffset = 0;
        const walker = document.createTreeWalker(
            sequenceBases,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let currentNode;
        while (currentNode = walker.nextNode()) {
            if (currentNode === node) {
                return lineStartPos + charOffset + offset;
            }
            charOffset += currentNode.textContent.length;
        }
        
        return lineStartPos + charOffset;
    }

    /**
     * Find DOM node and offset for a given genomic position
     */
    findNodeAtGenomicPosition(genomicPosition, sequenceContainer) {
        if (!sequenceContainer) return null;
        
        // Find all sequence lines
        const sequenceLines = sequenceContainer.querySelectorAll('.sequence-line-group');
        
        for (const lineElement of sequenceLines) {
            // Get the position span to find the line start position
            const positionSpan = lineElement.querySelector('.sequence-position');
            if (!positionSpan) continue;
            
            // Extract the line start position
            const positionText = positionSpan.textContent;
            const lineStartMatch = positionText.match(/^(\d+)/);
            if (!lineStartMatch) continue;
            
            const lineStartPos = parseInt(lineStartMatch[1]) - 1; // Convert to 0-based
            
            // Get the sequence bases container
            const sequenceBases = lineElement.querySelector('.sequence-bases');
            if (!sequenceBases) continue;
            
            // Calculate the total length of this line
            let lineLength = 0;
            const walker = document.createTreeWalker(
                sequenceBases,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                lineLength += node.textContent.length;
            }
            
            const lineEndPos = lineStartPos + lineLength;
            
            // Check if our genomic position falls within this line
            if (genomicPosition >= lineStartPos && genomicPosition < lineEndPos) {
                // Find the exact node and offset within this line
                const targetOffset = genomicPosition - lineStartPos;
                let currentOffset = 0;
                
                // Walk through text nodes again to find the exact position
                const nodeWalker = document.createTreeWalker(
                    sequenceBases,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                
                let textNode;
                while (textNode = nodeWalker.nextNode()) {
                    const nodeLength = textNode.textContent.length;
                    
                    if (currentOffset + nodeLength >= targetOffset) {
                        // Found the node containing our position
                        const offsetInNode = targetOffset - currentOffset;
                        return {
                            node: textNode,
                            offset: offsetInNode
                        };
                    }
                    
                    currentOffset += nodeLength;
                }
            }
        }
        
        return null;
    }

    /**
     * Restore manual text selection visual highlighting after sequence re-render
     */
    restoreManualSelection(selectionInfo) {
        if (!selectionInfo || !selectionInfo.active) {
            console.log('🔧 [SequenceUtils] No active manual selection to restore');
            return;
        }
        
        console.log('🔧 [SequenceUtils] Restoring manual selection highlighting:', selectionInfo);
        
        const sequenceContainer = document.getElementById('sequenceContent');
        if (!sequenceContainer) {
            console.warn('🔧 [SequenceUtils] Sequence container not found for manual selection restore');
            return;
        }
        
        // Find the DOM nodes for the selection range
        const startResult = this.findNodeAtGenomicPosition(selectionInfo.start, sequenceContainer);
        const endResult = this.findNodeAtGenomicPosition(selectionInfo.end, sequenceContainer);
        
        if (!startResult || !endResult) {
            console.warn('🔧 [SequenceUtils] Could not find DOM nodes for manual selection restore:', {
                startPos: selectionInfo.start,
                endPos: selectionInfo.end,
                startResult: !!startResult,
                endResult: !!endResult
            });
            return;
        }
        
        // Create and apply the selection
        const selection = window.getSelection();
        const range = document.createRange();
        
        try {
            // Set range with calculated positions
            range.setStart(startResult.node, startResult.offset);
            range.setEnd(endResult.node, endResult.offset);
            
            // Apply selection
            selection.removeAllRanges();
            selection.addRange(range);
            
            console.log('✅ [SequenceUtils] Manual selection highlighting restored successfully');
            
        } catch (error) {
            console.warn('🔧 [SequenceUtils] Error restoring manual selection highlighting:', error);
        }
    }

    /**
     * Restore text selection state after virtual scrolling
     */
    restoreSelectionState(savedSelection) {
        if (!savedSelection || savedSelection.startPos === null || savedSelection.endPos === null) {
            console.log('🔧 [SequenceUtils] No valid selection to restore');
            return;
        }

        // Find the sequence container
        const sequenceContainer = document.querySelector('.detailed-sequence-view');
        if (!sequenceContainer) {
            console.warn('🔧 [SequenceUtils] Sequence container not found');
            return;
        }

        // Use improved position finding
        const startResult = this.findNodeAtGenomicPosition(savedSelection.startPos, sequenceContainer);
        const endResult = this.findNodeAtGenomicPosition(savedSelection.endPos, sequenceContainer);
        
        if (!startResult || !endResult) {
            console.warn('🔧 [SequenceUtils] Could not find nodes for positions:', {
                startPos: savedSelection.startPos,
                endPos: savedSelection.endPos,
                startResult: !!startResult,
                endResult: !!endResult
            });
            return;
        }

        // Create new selection
        const selection = window.getSelection();
        const range = document.createRange();
        
        try {
            // Set range with calculated offsets
            range.setStart(startResult.node, startResult.offset);
            range.setEnd(endResult.node, endResult.offset);
            
            // Apply selection
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Update genome browser selection state if it exists
            if (window.genomeBrowser && window.genomeBrowser.currentSequenceSelection) {
                window.genomeBrowser.currentSequenceSelection = {
                    start: savedSelection.startPos,
                    end: savedSelection.endPos,
                    active: true,
                    length: savedSelection.endPos - savedSelection.startPos + 1
                };
            }
            
            console.log(`🔧 [SequenceUtils] Selection restored: ${savedSelection.startPos}-${savedSelection.endPos} (${savedSelection.endPos - savedSelection.startPos + 1} bp)`);
        } catch (error) {
            console.warn('🔧 [SequenceUtils] Failed to restore selection:', error);
        }
    }

    /**
     * Add search highlight range
     */
    addSearchHighlight(start, end) {
        this.searchHighlights.push({ start, end });
        this.refreshSequenceDisplay();
    }

    /**
     * Clear all search highlights
     */
    clearSearchHighlights() {
        this.searchHighlights = [];
        this.lastHighlightedMatches = [];
        this.refreshSequenceDisplay();
    }

    /**
     * Highlight search matches in the sequence display
     */
    highlightSearchMatches(matches) {
        this.clearSearchHighlights();
        matches.forEach(match => {
            if (match.type === 'sequence') {
                this.searchHighlights.push({
                    start: match.position,
                    end: match.end - 1
                });
            }
        });
        this.refreshSequenceDisplay();
        
        // Store matches for potential scrolling after render
        this.lastHighlightedMatches = matches;
    }

    /**
     * Apply search highlighting to a specific sequence line
     */
    applySearchHighlightToLine(basesDiv, lineStartPos, lineLength) {
        if (this.searchHighlights.length === 0) return;

        const lineEndPos = lineStartPos + lineLength - 1;
        
        // Find highlights that overlap with this line
        const overlappingHighlights = this.searchHighlights.filter(highlight => {
            return highlight.start <= lineEndPos && highlight.end >= lineStartPos;
        });

        if (overlappingHighlights.length === 0) return;

        // Apply highlighting by wrapping the highlighted text in spans
        let innerHTML = basesDiv.innerHTML;
        
        // Sort highlights by start position to avoid conflicts
        overlappingHighlights.sort((a, b) => a.start - b.start);
        
        // Apply highlights in reverse order to maintain character positions
        for (let i = overlappingHighlights.length - 1; i >= 0; i--) {
            const highlight = overlappingHighlights[i];
            const highlightStart = Math.max(highlight.start, lineStartPos);
            const highlightEnd = Math.min(highlight.end, lineEndPos);
            
            // Calculate positions relative to the line
            const relativeStart = highlightStart - lineStartPos;
            const relativeEnd = highlightEnd - lineStartPos;
            
            // Apply highlighting by adding background style to existing spans
            innerHTML = this.addHighlightToHTML(innerHTML, relativeStart, relativeEnd);
        }
        
        basesDiv.innerHTML = innerHTML;
    }

    /**
     * Add highlighting to HTML content at specified positions
     */
    addHighlightToHTML(html, start, end) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        let charCount = 0;
        const walker = document.createTreeWalker(
            tempDiv,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const nodesToHighlight = [];
        let node;
        
        while (node = walker.nextNode()) {
            const nodeStart = charCount;
            const nodeEnd = charCount + node.textContent.length - 1;
            
            if (nodeEnd >= start && nodeStart <= end) {
                // This text node overlaps with the highlight range
                const highlightStartInNode = Math.max(0, start - nodeStart);
                const highlightEndInNode = Math.min(node.textContent.length - 1, end - nodeStart);
                
                nodesToHighlight.push({
                    node: node,
                    startOffset: highlightStartInNode,
                    endOffset: highlightEndInNode
                });
            }
            
            charCount += node.textContent.length;
        }
        
        // Apply highlighting to identified nodes
        nodesToHighlight.forEach(({ node, startOffset, endOffset }) => {
            const parent = node.parentNode;
            const text = node.textContent;
            
            // Split the text node into three parts if needed
            const beforeText = text.substring(0, startOffset);
            const highlightText = text.substring(startOffset, endOffset + 1);
            const afterText = text.substring(endOffset + 1);
            
            // Create new nodes
            const fragment = document.createDocumentFragment();
            
            if (beforeText) {
                fragment.appendChild(document.createTextNode(beforeText));
            }
            
            if (highlightText) {
                const highlightSpan = document.createElement('span');
                highlightSpan.style.backgroundColor = this.highlightColor;
                highlightSpan.style.borderRadius = '2px';
                highlightSpan.textContent = highlightText;
                fragment.appendChild(highlightSpan);
            }
            
            if (afterText) {
                fragment.appendChild(document.createTextNode(afterText));
            }
            
            // Replace the original text node
            parent.replaceChild(fragment, node);
        });
        
        return tempDiv.innerHTML;
    }

    /**
     * Refresh the sequence display to apply highlighting
     */
    refreshSequenceDisplay() {
        // Clear the render cache to force re-rendering with highlights
        this.renderCache.clear();
        
        // Re-render the current sequence
        const currentChr = document.getElementById('chromosomeSelect')?.value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.displayEnhancedSequence(currentChr, this.genomeBrowser.currentSequence[currentChr]);
            
            // Trigger scroll after render completes if we have highlighted matches
            if (this.lastHighlightedMatches && this.lastHighlightedMatches.length > 0) {
                setTimeout(() => {
                    // Notify NavigationManager to handle scrolling
                    if (this.genomeBrowser.navigationManager) {
                        this.genomeBrowser.navigationManager.scrollToMatchPosition(this.lastHighlightedMatches[0]);
                    }
                }, 100); // Small delay to ensure rendering is complete
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SequenceUtils;
} 