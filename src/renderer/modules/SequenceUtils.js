/**
 * SequenceUtils - Handles sequence processing, display, and biological utilities
 */
class SequenceUtils {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        
        // Make this instance globally accessible for click handlers
        window.sequenceUtils = this;
        this._cachedCharWidth = null; // Cache for character width measurement
        this.vscodeEditor = null;
        this.sequenceEditor = null; // Advanced editing capabilities
        
        // Sequence display mode: 'view' for traditional display, 'edit' for VS Code editor
        this.displayMode = 'view';
        
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
        
        // Cursor management for View Mode
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
        
        // Initialize cursor styles with setting
        this.loadCursorSettings();
        this.initializeCursorStyles();
        
        // Add window resize listener to handle cursor repositioning
        this.setupWindowResizeHandler();
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
        
        // Add mode toggle button if not already present
        this.addModeToggleButton();
        
        // Add sequence content mode selector if in view mode
        if (this.displayMode === 'view') {
            this.addSequenceContentModeSelector();
        } else {
            // Ensure View Mode UI elements are removed in Edit Mode
            this.removeSequenceContentModeSelector();
        }
        
        // Update CSS variables for line height
        this.updateSequenceLineHeightCSS();
        
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
     * Update CSS variables for sequence line height and spacing with enhanced verification
     */
    updateSequenceLineHeightCSS() {
        const root = document.documentElement;
        const lineHeightRatio = Math.max(1.2, this.lineHeight / 16);
        
        // Ensure line spacing doesn't go below minimum value
        const effectiveLineSpacing = Math.max(this.lineSpacing, this.minLineSpacing);
        
        // Force remove existing variables first to ensure fresh application
        root.style.removeProperty('--sequence-line-height');
        root.style.removeProperty('--sequence-line-ratio');
        root.style.removeProperty('--sequence-line-spacing');
        
        // Apply new values with forced reapplication and minimum spacing protection
        root.style.setProperty('--sequence-line-height', `${this.lineHeight}px`, 'important');
        root.style.setProperty('--sequence-line-ratio', lineHeightRatio.toString(), 'important');
        root.style.setProperty('--sequence-line-spacing', `${effectiveLineSpacing}px`, 'important');
        
        // Debug: Log the applied values
        console.log('🔧 [SequenceUtils] CSS variables updated:', {
            lineHeight: this.lineHeight + 'px',
            lineRatio: lineHeightRatio,
            lineSpacing: this.lineSpacing + 'px',
            effectiveLineSpacing: effectiveLineSpacing + 'px',
            minLineSpacing: this.minLineSpacing + 'px',
            currentMode: this.displayMode
        });
        
        // Force multiple style recalculations to ensure proper application
        document.body.offsetHeight;
        root.offsetHeight;
        
        // Verify the values were applied correctly with timeout-based verification
        setTimeout(() => {
            const appliedLineHeight = getComputedStyle(root).getPropertyValue('--sequence-line-height');
            const appliedLineRatio = getComputedStyle(root).getPropertyValue('--sequence-line-ratio');
            const appliedLineSpacing = getComputedStyle(root).getPropertyValue('--sequence-line-spacing');
            
            const verification = {
                applied: {
                    lineHeight: appliedLineHeight.trim(),
                    lineRatio: appliedLineRatio.trim(),
                    lineSpacing: appliedLineSpacing.trim()
                },
                expected: {
                    lineHeight: this.lineHeight + 'px',
                    lineRatio: lineHeightRatio.toString(),
                    lineSpacing: this.lineSpacing + 'px'
                }
            };
            
            console.log('✅ [SequenceUtils] CSS variables verification:', verification);
            
            // Check if reapplication is needed
            const heightMatch = verification.applied.lineHeight === verification.expected.lineHeight;
            const spacingMatch = verification.applied.lineSpacing === verification.expected.lineSpacing;
            
            if (!heightMatch || !spacingMatch) {
                console.warn('⚠️ [SequenceUtils] CSS variables mismatch detected - reapplying');
                root.style.setProperty('--sequence-line-height', `${this.lineHeight}px`, 'important');
                root.style.setProperty('--sequence-line-spacing', `${this.lineSpacing}px`, 'important');
                
                // Force another style recalculation
                document.body.offsetHeight;
            }
        }, 50);
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
            'Switch to traditional sequence view' : 'Switch to sequence editor with editing capabilities';
        
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
        const previousMode = this.displayMode;
        this.displayMode = this.displayMode === 'edit' ? 'view' : 'edit';
        
        console.log(`🔧 [SequenceUtils] Toggling display mode: ${previousMode} → ${this.displayMode}`);
        
        // Update button text
        const toggleButton = document.getElementById('sequenceModeToggle');
        if (toggleButton) {
            toggleButton.innerHTML = this.displayMode === 'edit' ? 
                '<i class="fas fa-eye"></i> View Mode' : '<i class="fas fa-edit"></i> Edit Mode';
            toggleButton.title = this.displayMode === 'edit' ? 
                'Switch to traditional sequence view' : 'Switch to sequence editor with editing capabilities';
        }
        
        // Handle sequence content mode selector (only remove it in edit mode)
        if (this.displayMode === 'edit') {
            this.removeSequenceContentModeSelector();
        } else {
            this.addSequenceContentModeSelector();
        }
        
        // Clean up the container to avoid style conflicts
        try {
            this.cleanupContainer();
        } catch (error) {
            console.error('❌ [SequenceUtils] Error during container cleanup:', error);
            // Try to recover by forcing a hard reset
            const container = document.getElementById('sequenceContent');
            if (container) {
                container.innerHTML = '';
                container.className = this.displayMode === 'view' ? 'sequence-content' : '';
            }
        }
        
        // Clear any pending drag operations to prevent conflicts
        if (this.dragOptimization.pendingRender) {
            console.log('🔧 [SequenceUtils] Clearing pending render due to mode switch');
            this.dragOptimization.pendingRender = null;
        }
        this.dragOptimization.isDragging = false;
        
        // Re-display sequence with new mode
        const chromosome = this.genomeBrowser.currentChromosome;
        const sequenceData = this.genomeBrowser.currentSequence;
        
        if (chromosome && sequenceData && sequenceData[chromosome]) {
            // Extract the actual sequence string from the sequence data object
            const sequence = sequenceData[chromosome];
            
            console.log(`🔧 [SequenceUtils] Re-rendering sequence in ${this.displayMode} mode`);
            
            try {
                // Force re-render by calling displayEnhancedSequence
                this.displayEnhancedSequence(chromosome, sequence);
                
                // If switching to edit mode, automatically enable editing after rendering
                if (this.displayMode === 'edit') {
                    // Use setTimeout to ensure VS Code editor is fully initialized
                    setTimeout(() => {
                        this.enableEditingModeDirectly();
                    }, 100);
                }
                
                console.log(`✅ [SequenceUtils] Successfully switched to ${this.displayMode} mode`);
            } catch (error) {
                console.error(`❌ [SequenceUtils] Error switching to ${this.displayMode} mode:`, error);
                
                // Try to recover by reverting to previous mode
                console.warn(`⚠️ [SequenceUtils] Attempting to revert to ${previousMode} mode`);
                this.displayMode = previousMode;
                
                // Update button to reflect reverted state
                if (toggleButton) {
                    toggleButton.innerHTML = this.displayMode === 'edit' ? 
                        '<i class="fas fa-eye"></i> View Mode' : '<i class="fas fa-edit"></i> Edit Mode';
                    toggleButton.title = this.displayMode === 'edit' ? 
                        'Switch to traditional sequence view' : 'Switch to sequence editor with editing capabilities';
                }
                
                // Try to render in the original mode
                try {
                    this.displayEnhancedSequence(chromosome, sequence);
                    console.log(`✅ [SequenceUtils] Successfully reverted to ${previousMode} mode`);
                } catch (revertError) {
                    console.error('❌ [SequenceUtils] Error reverting to previous mode:', revertError);
                    // Force a complete reset as last resort
                    this.forceSequenceRerender();
                }
            }
        } else {
            console.warn('⚠️ [SequenceUtils] No sequence data available for mode switch');
        }
    }
    
    /**
     * Enable editing mode directly without showing intermediate UI
     */
    enableEditingModeDirectly() {
        if (this.displayMode !== 'edit') {
            console.warn('⚠️ [SequenceUtils] Cannot enable editing mode outside of edit display mode');
            return;
        }
        
        if (!this.sequenceEditor) {
            console.warn('⚠️ [SequenceUtils] SequenceEditor not available, cannot enable editing');
            this.genomeBrowser.showNotification('Editing functionality not available', 'warning');
            return;
        }
        
        console.log('🔧 [SequenceUtils] Enabling editing mode directly');
        
        try {
            // Enable editing mode directly
            this.sequenceEditor.enableEditMode();
            console.log('✅ [SequenceUtils] Editing mode enabled successfully');
            
            // Show notification
            this.genomeBrowser.showNotification('Edit mode enabled. You can now edit the sequence directly.', 'success');
        } catch (error) {
            console.error('❌ [SequenceUtils] Error enabling editing mode:', error);
            this.genomeBrowser.showNotification('Failed to enable editing mode', 'error');
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
        
        console.log('🔧 [SequenceUtils] Cleaning up container for mode:', this.displayMode);
        
        // Store current CSS variables before cleanup to preserve View Mode settings
        const preservedVars = {
            lineHeight: getComputedStyle(document.documentElement).getPropertyValue('--sequence-line-height'),
            lineRatio: getComputedStyle(document.documentElement).getPropertyValue('--sequence-line-ratio'),
            lineSpacing: getComputedStyle(document.documentElement).getPropertyValue('--sequence-line-spacing')
        };
        
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
                console.log('✅ [SequenceUtils] VSCode editor and SequenceEditor destroyed');
            } catch (error) {
                console.warn('⚠️ [SequenceUtils] Error destroying editors:', error);
                this.vscodeEditor = null;
                this.sequenceEditor = null;
            }
        }
        
        // Clear container content
        container.innerHTML = '';
        
        // Mode-specific cleanup with better style preservation
        if (this.displayMode === 'view') {
            // For Edit Mode -> View Mode: Remove only Edit Mode specific styles
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
            
        } else if (this.displayMode === 'edit') {
            // For View Mode -> Edit Mode: Clean all styles to prepare for VS Code editor
            const allModeStyles = [
                'font-family', 'font-size', 'line-height', 'background', 
                'color', 'overflow', 'position', 'min-height', 'height'
            ];
            
            allModeStyles.forEach(prop => {
                container.style.removeProperty(prop);
            });
            
            // Reset container to neutral state for VS Code editor
            container.className = '';
        }
        
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
        
        console.log('✅ [SequenceUtils] Container cleanup completed for', this.displayMode, 'mode');
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
                    
                    // Ensure editing mode is maintained if SequenceEditor exists
                    if (this.sequenceEditor && this.sequenceEditor.isEditMode) {
                        console.log('🔧 [SequenceUtils] Maintaining editing mode after sequence update');
                        // Re-enable editing mode to ensure proper state
                        this.sequenceEditor.enableEditMode();
                    }
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
        
        // Save existing UI elements before cleaning container
        const existingToolbar = document.getElementById('sequenceEditingToolbar');
        const existingStatusBar = document.getElementById('sequenceEditingStatusBar');
        const existingTextArea = document.getElementById('sequenceEditingTextArea');
        
        // Clean container
        container.innerHTML = '';
        
        // Restore UI elements if they existed
        if (existingToolbar) {
            container.parentNode.insertBefore(existingToolbar, container);
        }
        if (existingStatusBar) {
            container.parentNode.insertBefore(existingStatusBar, container.nextSibling);
        }
        if (existingTextArea) {
            const editingContainer = document.getElementById('sequenceEditingContainer');
            if (editingContainer) {
                editingContainer.appendChild(existingTextArea);
            }
        }
        
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
                    
                    // If we were in edit mode before, automatically enable editing
                    if (this.displayMode === 'edit') {
                        console.log('🔧 [SequenceUtils] Auto-enabling editing mode for new editor');
                        this.sequenceEditor.enableEditMode();
                    }
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
        // Keep overflow styles to maintain scrollbar behavior
        // container.style.removeProperty('overflow');
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
        lineGroup.style.marginBottom = `${this.lineSpacing}px`;
        
        // Create sequence line with configurable height to prevent compression
        const sequenceLine = document.createElement('div');
        sequenceLine.className = 'sequence-line';
        // Use configurable line height with appropriate line-height ratio
        const lineHeightRatio = Math.max(1.2, this.lineHeight / 16); // Ensure minimum ratio of 1.2
        sequenceLine.style.cssText = `display: flex; margin-bottom: 8px; font-family: "Courier New", monospace; font-size: 14px; line-height: ${lineHeightRatio}; min-height: ${this.lineHeight}px; padding: 4px 0;`;
        
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
        
        // Gene indicator line - calculate precise alignment with corrections
        const indicatorLine = document.createElement('div');
        indicatorLine.className = 'gene-indicator-line';
        // Calculate exact left margin to align with sequence bases
        const positionWidth = 100; // position span width
        const marginRight = 15;    // margin-right of position span
        const alignmentOffset = positionWidth + marginRight;
        // Add horizontal offset to compensate for character centering (~0.8 characters)
        const horizontalAdjustment = charWidth * 0.8;
        
        // Apply position and size corrections from settings
        const horizontalOffset = sequenceSettings.horizontalOffset || 0;
        const verticalOffset = sequenceSettings.verticalOffset || 0;
        const heightCorrection = (sequenceSettings.heightCorrection || 100) / 100;
        
        const finalLeftMargin = alignmentOffset - horizontalAdjustment + horizontalOffset;
        const correctedHeight = 12 * heightCorrection;
        const correctedMarginTop = -2 + verticalOffset;
        const correctedMarginBottom = 2 - verticalOffset;
        
        indicatorLine.style.cssText = `height: ${correctedHeight}px; margin-left: ${finalLeftMargin}px; margin-bottom: ${correctedMarginBottom}px; margin-top: ${correctedMarginTop}px;`;
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
            const clickHandler = ` onclick="window.sequenceUtils?.handleSequenceClick(event, ${absPos})"`;
            fragments.push(`<span class="${className}" style="${style}"${titleAttr}${clickHandler}>${base}</span>`);
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
        
        // Calculate actual available height instead of using fixed 600px
        const parentContainer = document.getElementById('sequenceContent');
        const sequenceDisplaySection = document.getElementById('sequenceDisplaySection');
        let availableHeight = 400; // Default fallback
        
        if (sequenceDisplaySection) {
            const sectionRect = sequenceDisplaySection.getBoundingClientRect();
            const sequenceHeader = document.querySelector('.sequence-header');
            const headerHeight = sequenceHeader ? sequenceHeader.offsetHeight : 60;
            availableHeight = Math.max(200, sectionRect.height - headerHeight - 40); // Reserve space for padding
        }
        
        // Calculate optimal container height
        const maxPossibleHeight = totalLines * this.virtualScrolling.lineHeight;
        const containerHeight = Math.min(availableHeight, maxPossibleHeight);
        
        // Update virtual scrolling parameters based on actual container size
        const dynamicVisibleLines = Math.floor(containerHeight / this.virtualScrolling.lineHeight);
        const needsScrolling = totalLines > dynamicVisibleLines;
        
        console.log(`🔧 [SequenceUtils] Container sizing: available=${availableHeight}px, calculated=${containerHeight}px, lines=${totalLines}, visible=${dynamicVisibleLines}, needsScrolling=${needsScrolling}`);
        
        // Create virtualized container
        const virtualContainer = document.createElement('div');
        virtualContainer.className = 'detailed-sequence-view virtualized';
        virtualContainer.style.cssText = `
            height: ${containerHeight}px;
            max-height: ${availableHeight}px;
            overflow-y: scroll;
            overflow-x: hidden;
            position: relative;
            box-sizing: border-box;
        `;
        
        // Viewport for visible lines
        const viewport = document.createElement('div');
        viewport.className = 'virtual-viewport';
        viewport.style.cssText = `
            height: ${maxPossibleHeight}px;
            position: relative;
            min-height: ${containerHeight}px;
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
     * Update virtualized content based on scroll position
     */
    updateVirtualizedContent(visibleContent, scrollTop, chromosome, subsequence, viewStart, annotations, operons, charWidth, optimalLineLength, sequenceSettings, featureLookup, totalLines, virtualScrollingParams = null) {
        // Use dynamic parameters if provided, otherwise fall back to instance parameters
        const params = virtualScrollingParams || this.virtualScrolling;
        const lineHeight = params.lineHeight;
        const visibleLines = params.visibleLines;
        const bufferLines = params.bufferLines;
        
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
        
        console.log(`🔧 [SequenceUtils] Virtual scroll update: lines ${startLine}-${endLine} of ${totalLines}, scrollTop=${scrollTop}px`);
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
            if (this.genomeBrowser && this.genomeBrowser.uiManager) {
                this.genomeBrowser.uiManager.updateStatus(copyMessage);
            } else {
                // Fallback to status bar update if uiManager is not available
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = copyMessage;
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
            
            // End marker (arrow) - only if gene actually ends in this line and enabled
            if (settings.showEndArrows !== false && geneEnd1Based >= lineStart1Based && geneEnd1Based <= lineEnd1Based) {
                // For reverse genes, the end arrow should be at the LEFT end (transcription direction)
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
     repositionCursor() {
         if (this.cursor.position >= 0) {
             console.log('🔄 [SequenceUtils] Force repositioning cursor at position:', this.cursor.position);
             this.positionCursorInView();
         }
     }
     
     /**
      * Create and position cursor in the view
      */
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
         
         // Calculate horizontal position (relative to container)
         const left = elementRect.left - containerRect.left;
         
         // Calculate vertical position with improved accuracy
         let top;
         if (lineRect) {
             // Use the line's top position for better vertical alignment
             top = lineRect.top - containerRect.top;
         } else {
             // Fallback to element's top position
             top = elementRect.top - containerRect.top;
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
     updateCursorStatus(position) {
         const cursorStatusElement = document.getElementById('cursorStatus');
         if (cursorStatusElement && position >= 0) {
             cursorStatusElement.textContent = `Cursor: ${position + 1}`;
         }
     }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SequenceUtils;
} 