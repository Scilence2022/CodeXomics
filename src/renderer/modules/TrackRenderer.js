/**
 * TrackRenderer - Handles all track creation and visualization
 * Optimized with improved function calling structure and workflow
 */
class TrackRenderer {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        
        // Track configuration for consistent styling and behavior
        this.trackConfig = {
            genes: {
                defaultHeight: '120px',
                header: 'Genes & Features',
                className: 'gene-track',
                requiresData: true,
                dataSource: 'currentAnnotations'
            },
            sequence: {
                defaultHeight: '30px',
                header: 'Sequence',
                className: 'sequence-track',
                requiresData: true,
                dataSource: 'currentSequence'
            },
            gc: {
                defaultHeight: '140px',
                header: 'GC Content & Skew',
                className: 'gc-track',
                requiresData: true,
                dataSource: 'currentSequence'
            },
            variants: {
                defaultHeight: '60px',
                header: 'VCF Variants',
                className: 'variant-track',
                requiresData: false,
                dataSource: 'currentVariants'
            },
            reads: {
                defaultHeight: '80px',
                header: 'Aligned Reads',
                className: 'reads-track',
                requiresData: false,
                dataSource: 'readsManager'
            },
            proteins: {
                defaultHeight: '80px',
                header: 'Proteins',
                className: 'protein-track',
                requiresData: true,
                dataSource: 'currentAnnotations'
            },
            wigTracks: {
                defaultHeight: '120px',
                header: 'WIG Tracks',
                className: 'wig-track',
                requiresData: false,
                dataSource: 'currentWIGTracks'
            }
        };
        
        // Track header visibility state - survives track recreation
        this.headerStates = new Map();
        
        // Common styles for reuse
        this.commonStyles = {
            noDataMessage: `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `,
            statsElement: `
                position: absolute;
                top: 5px;
                right: 10px;
                background: rgba(255,255,255,0.9);
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                color: #666;
                border: 1px solid #ddd;
            `
        };
    }
    
    // ============================================================================
    // CORE TRACK CREATION METHODS
    // ============================================================================
    
    /**
     * Generic track factory method - reduces code duplication
     */
    createTrackBase(trackType, chromosome) {
        const config = this.trackConfig[trackType];
        if (!config) {
            throw new Error(`Unknown track type: ${trackType}`);
        }
        
        const track = document.createElement('div');
        track.className = config.className;
        
        const trackHeader = this.createTrackHeader(config.header, trackType);
        track.appendChild(trackHeader);
        
        const trackContent = this.createTrackContent(config.defaultHeight, chromosome);
        track.appendChild(trackContent);
        
        return { track, trackContent, config };
    }
    
    /**
     * Create standardized track header
     */
    createTrackHeader(title, trackType) {
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        
        // Create title element
        const titleElement = document.createElement('span');
        titleElement.className = 'track-title';
        titleElement.textContent = title;
        trackHeader.appendChild(titleElement);
        
        // Create buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'track-buttons';
        
        // Settings button
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'track-btn track-settings-btn';
        settingsBtn.innerHTML = '<i class="fas fa-cog"></i>';
        settingsBtn.title = 'Track Settings';
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openTrackSettings(trackType);
        });
        
        // Toggle controls button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'track-btn track-toggle-btn';
        toggleBtn.innerHTML = '<i class="fas fa-lock-open"></i>';
        toggleBtn.title = 'Toggle Track Controls (Lock/Unlock)';
        toggleBtn.dataset.locked = 'false';
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTrackControls(trackType, toggleBtn);
        });
        
        // Hide header button (available for all tracks)
        const hideHeaderBtn = document.createElement('button');
        hideHeaderBtn.className = 'track-btn track-hide-header-btn';
        hideHeaderBtn.innerHTML = '<i class="fas fa-minus"></i>';
        hideHeaderBtn.title = 'Hide Track Header';
        hideHeaderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTrackHeader(trackType, hideHeaderBtn);
        });
        buttonsContainer.appendChild(hideHeaderBtn);
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'track-btn track-close-btn';
        closeBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        closeBtn.title = 'Hide Track';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTrack(trackType);
        });
        
        buttonsContainer.appendChild(settingsBtn);
        buttonsContainer.appendChild(toggleBtn);
        buttonsContainer.appendChild(closeBtn);
        trackHeader.appendChild(buttonsContainer);
        
        return trackHeader;
    }
    
    /**
     * Create standardized track content container
     */
    createTrackContent(height, chromosome) {
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        trackContent.style.height = height;
        
        // Add draggable functionality
        this.genomeBrowser.makeDraggable(trackContent, chromosome);
        
        return trackContent;
    }
    
    /**
     * Create standardized no-data message
     */
    createNoDataMessage(message, className = 'no-data-message') {
        const noDataMsg = document.createElement('div');
        noDataMsg.className = className;
        noDataMsg.textContent = message;
        noDataMsg.style.cssText = this.commonStyles.noDataMessage;
        return noDataMsg;
    }
    
    /**
     * Create standardized statistics element
     */
    createStatsElement(text, className = 'track-stats', additionalStyles = '') {
        const statsElement = document.createElement('div');
        statsElement.className = className;
        statsElement.style.cssText = this.commonStyles.statsElement + additionalStyles;
        statsElement.textContent = text;
        return statsElement;
    }
    
    /**
     * Get current viewport data for consistent access
     */
    getCurrentViewport() {
        return {
            start: this.genomeBrowser.currentPosition.start,
            end: this.genomeBrowser.currentPosition.end,
            range: this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start
        };
    }
    
    /**
     * Save header visibility state before track recreation
     */
    saveHeaderStates() {
        const container = document.getElementById('genomeViewer');
        if (!container) return;
        
        const existingTracks = container.querySelectorAll('[class*="-track"]');
        existingTracks.forEach(track => {
            const trackHeader = track.querySelector('.track-header');
            if (trackHeader) {
                // Determine track type from class name
                let trackType = null;
                for (const className of track.classList) {
                    if (className.endsWith('-track')) {
                        trackType = className.replace('-track', '');
                        
                        // Map specific track class names to track types
                        const typeMapping = {
                            'gene': 'genes',
                            'variant': 'variants',
                            'wig': 'wigTracks'
                        };
                        trackType = typeMapping[trackType] || trackType;
                        break;
                    }
                }
                
                if (trackType) {
                    const isHidden = trackHeader.style.display === 'none';
                    this.headerStates.set(trackType, isHidden);
                    console.log(`Saved header state for ${trackType}: ${isHidden ? 'hidden' : 'visible'}`);
                }
            }
        });
    }
    
    /**
     * Restore header visibility state after track recreation
     */
    restoreHeaderState(trackElement, trackType) {
        if (!this.headerStates.has(trackType)) return;
        
        const shouldBeHidden = this.headerStates.get(trackType);
        if (!shouldBeHidden) return; // If not hidden, no need to restore
        
        const trackHeader = trackElement.querySelector('.track-header');
        const hideHeaderBtn = trackHeader?.querySelector('.track-hide-header-btn');
        
        if (trackHeader && hideHeaderBtn) {
            // Hide the header
            trackHeader.style.display = 'none';
            hideHeaderBtn.innerHTML = '<i class="fas fa-plus"></i>';
            hideHeaderBtn.title = 'Show Track Header';
            
            // Add floating button
            this.createFloatingHeaderButton(trackElement, trackType);
            
            // Adjust track content
            const trackContent = trackElement.querySelector('.track-content');
            if (trackContent) {
                trackContent.style.marginTop = '5px';
            }
            
            console.log(`Restored hidden header state for ${trackType}`);
        }
    }
    
    /**
     * Filter features by current viewport with validation
     */
    filterFeaturesByViewport(features, viewport) {
        if (!Array.isArray(features)) return [];
        
        return features.filter(feature => 
            feature && feature.start && feature.end && 
            feature.start <= viewport.end && feature.end >= viewport.start
        );
    }
    
    // ============================================================================
    // SPECIFIC TRACK IMPLEMENTATIONS
    // ============================================================================

    createGeneTrack(chromosome) {
        const { track, trackContent } = this.createTrackBase('genes', chromosome);
        const viewport = this.getCurrentViewport();
        
        // Get track settings
        const settings = this.getTrackSettings('genes');
        console.log('Retrieved gene track settings:', settings);
        
        // Add detailed ruler for current viewing region
        const detailedRuler = this.createDetailedRuler(chromosome);
        trackContent.appendChild(detailedRuler);
        
        // Get and validate data
        const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
        const operons = this.genomeBrowser.detectOperons(annotations);
        console.log(`Detected ${operons.length} operons in chromosome ${chromosome}`);
        
        // Filter genes using the new helper method
        const visibleGenes = this.filterGeneAnnotations(annotations, viewport);
        console.log(`Displaying ${visibleGenes.length} genes/features in region ${viewport.start}-${viewport.end}`);
        
        if (visibleGenes.length === 0) {
            const noGenesMsg = this.createNoDataMessage(
                'No genes/features in this region or all filtered out',
                'no-genes-message'
            );
            trackContent.appendChild(noGenesMsg);
            trackContent.style.height = '80px';
            return track;
        }
        
        // Process and render genes with settings
        this.renderGeneElements(trackContent, visibleGenes, viewport, operons, settings);
        
        // Add statistics and update sidebar
        this.addGeneTrackStatistics(trackContent, visibleGenes, operons, settings);
        
        // Restore header state if it was previously hidden
        this.restoreHeaderState(track, 'genes');
        
        return track;
    }
    
    /**
     * Filter gene annotations with type validation
     */
    filterGeneAnnotations(annotations, viewport) {
        const validTypes = ['gene', 'CDS', 'mRNA', 'tRNA', 'rRNA', 'misc_feature', 
                          'regulatory', 'promoter', 'terminator', 'repeat_region'];
        
        return annotations.filter(feature => {
            return (validTypes.includes(feature.type) || feature.type.includes('RNA')) &&
                   this.genomeBrowser.shouldShowGeneType(feature.type);
        }).filter(gene => this.filterFeaturesByViewport([gene], viewport).length > 0);
    }
    
    /**
     * Render gene elements with improved organization
     */
    renderGeneElements(trackContent, visibleGenes, viewport, operons, settings) {
        const geneRows = this.arrangeGenesInRows(visibleGenes, viewport.start, viewport.end, operons, settings);
        const layout = this.calculateGeneTrackLayout(geneRows, settings);
        
        // Set calculated height
        trackContent.style.height = `${Math.max(layout.totalHeight, 120)}px`;
        
        // Create gene elements
        geneRows.forEach((rowGenes, rowIndex) => {
            rowGenes.forEach((gene) => {
                const geneElement = this.createGeneElement(gene, viewport, operons, rowIndex, layout, settings);
                trackContent.appendChild(geneElement);
            });
        });
    }
    
    /**
     * Calculate layout parameters for gene track
     */
    calculateGeneTrackLayout(geneRows, settings) {
        const geneHeight = settings?.geneHeight || 23;
        const rowSpacing = 6;
        const rulerHeight = 35;
        const topPadding = 10;
        const bottomPadding = 0;
        
        // Apply maximal rows setting
        const maxRows = settings?.maxRows || 6;
        const effectiveRows = Math.min(geneRows.length, maxRows);
        
        return {
            geneHeight,
            rowSpacing,
            rulerHeight,
            topPadding,
            bottomPadding,
            maxRows,
            effectiveRows,
            totalHeight: rulerHeight + topPadding + (effectiveRows * (geneHeight + rowSpacing)) - rowSpacing + bottomPadding
        };
    }
    
    /**
     * Create individual gene element with improved structure
     */
    createGeneElement(gene, viewport, operons, rowIndex, layout, settings) {
        const geneElement = document.createElement('div');
        
        // Configure element class and style
        this.configureGeneElementAppearance(geneElement, gene, viewport, operons, settings);
        
        // Set position
        this.setGeneElementPosition(geneElement, gene, viewport, rowIndex, layout, settings);
        
        // Add interaction handlers
        this.addGeneElementHandlers(geneElement, gene, operons);
        
        return geneElement;
    }
    
    /**
     * Configure gene element appearance and styling
     */
    configureGeneElementAppearance(geneElement, gene, viewport, operons, settings) {
        // Normalize gene type for CSS class
        let geneType = gene.type.toLowerCase();
        if (geneType.includes('rna') && !['mrna', 'trna', 'rrna'].includes(geneType)) {
            geneType = 'misc_feature';
        }
        
        geneElement.className = `gene-element ${geneType}`;
        
        // Get operon information and assign color
        const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);
        
        // Override CSS background with operon-based color
        geneElement.style.background = `linear-gradient(135deg, ${operonInfo.color}, ${this.lightenColor(operonInfo.color, 20)})`;
        geneElement.style.borderColor = this.darkenColor(operonInfo.color, 20);
        
        // Add operon-specific CSS classes
        if (operonInfo.isInOperon) {
            geneElement.classList.add('in-operon');
        } else {
            geneElement.classList.add('single-gene');
        }
        
        // Add user-defined feature styling
        if (gene.userDefined) {
            geneElement.classList.add('user-defined-feature');
        }
        
        if (gene.strand === -1) {
            geneElement.classList.add('reverse-strand');
        }
        
        // Check if this gene should be selected (maintain selection state)
        if (this.genomeBrowser.selectedGene && this.genomeBrowser.selectedGene.gene && 
            this.genomeBrowser.selectedGene.gene.start === gene.start && 
            this.genomeBrowser.selectedGene.gene.end === gene.end &&
            this.genomeBrowser.selectedGene.gene.type === gene.type) {
            geneElement.classList.add('selected');
        }
    }
    
    /**
     * Set gene element position and dimensions
     */
    setGeneElementPosition(geneElement, gene, viewport, rowIndex, layout, settings) {
        const geneStart = Math.max(gene.start, viewport.start);
        const geneEnd = Math.min(gene.end, viewport.end);
        const left = ((geneStart - viewport.start) / viewport.range) * 100;
        const width = ((geneEnd - geneStart) / viewport.range) * 100;
        
        geneElement.style.left = `${left}%`;
        geneElement.style.width = `${Math.max(width, 0.3)}%`;
        
        // Ensure minimum visibility
        if (width < 0.5) {
            geneElement.style.minWidth = '8px';
        }
        
        // Position based on row arrangement - only show if within maxRows
        if (rowIndex < layout.maxRows) {
            geneElement.style.top = `${layout.rulerHeight + layout.topPadding + rowIndex * (layout.geneHeight + layout.rowSpacing)}px`;
            geneElement.style.height = `${layout.geneHeight}px`;
            geneElement.style.display = 'block';
        } else {
            // Hide genes beyond maxRows
            geneElement.style.display = 'none';
            return; // Don't process text content for hidden genes
        }
        
        // Apply font settings
        const fontSize = settings?.fontSize || 11;
        const fontFamily = settings?.fontFamily || 'Arial, sans-serif';
        geneElement.style.fontSize = `${fontSize}px`;
        geneElement.style.fontFamily = fontFamily;
        geneElement.style.lineHeight = `${layout.geneHeight}px`;
        
        // Set text content based on available space
        const geneName = gene.qualifiers.gene || gene.qualifiers.locus_tag || gene.qualifiers.product || gene.type;
        if (width > 2) {
            geneElement.textContent = geneName.length > 12 ? geneName.substring(0, 12) + '...' : geneName;
        } else if (width > 0.8) {
            geneElement.textContent = geneName.substring(0, 3);
        } else {
            geneElement.textContent = '';
        }
        
        // Create comprehensive tooltip
        this.setGeneElementTooltip(geneElement, gene, geneName, rowIndex);
    }
    
    /**
     * Set comprehensive tooltip for gene element
     */
    setGeneElementTooltip(geneElement, gene, geneName, rowIndex) {
        const geneInfo = `${geneName} (${gene.type})`;
        const positionInfo = `${gene.start}-${gene.end} (${gene.strand === -1 ? '-' : '+'} strand)`;
        const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, []);
        const operonInfo_display = operonInfo.isInOperon ? `\nOperon: ${operonInfo.operonName}` : '\nSingle gene';
        const rowInfo = `\nRow: ${rowIndex + 1}`;
        
        geneElement.title = `${geneInfo}\nPosition: ${positionInfo}${operonInfo_display}${rowInfo}`;
    }
    
    /**
     * Add interaction handlers to gene element
     */
    addGeneElementHandlers(geneElement, gene, operons) {
        geneElement.addEventListener('click', () => {
            const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);
            this.showGeneDetails(gene, operonInfo);
        });
    }
    
    /**
     * Add statistics and update sidebar with improved organization
     */
    addGeneTrackStatistics(trackContent, visibleGenes, operons, settings) {
        const geneRows = this.arrangeGenesInRows(visibleGenes, this.getCurrentViewport().start, this.getCurrentViewport().end, operons, settings);
        const layout = this.calculateGeneTrackLayout(geneRows, settings);
        
        // Count visible and hidden genes
        const totalGenes = visibleGenes.length;
        let visibleGenesCount = 0;
        let hiddenGenesCount = 0;
        
        geneRows.forEach((rowGenes, rowIndex) => {
            if (rowIndex < layout.maxRows) {
                visibleGenesCount += rowGenes.length;
            } else {
                hiddenGenesCount += rowGenes.length;
            }
        });
        
        // Create statistics text
        let statsText = `${visibleGenesCount} features in ${Math.min(geneRows.length, layout.maxRows)} rows`;
        if (hiddenGenesCount > 0) {
            statsText += ` (${hiddenGenesCount} hidden)`;
        }
        
        const statsElement = this.createStatsElement(statsText, 'gene-stats', `top: ${layout.rulerHeight + 5}px;`);
        trackContent.appendChild(statsElement);
        
        // Update sidebar operons panel
        const visibleOperons = new Set();
        geneRows.forEach((rowGenes, rowIndex) => {
            if (rowIndex < layout.maxRows) {
                rowGenes.forEach(gene => {
                    const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);
                    if (operonInfo.isInOperon) {
                        visibleOperons.add(operonInfo.operonName);
                    }
                });
            }
        });
        
        this.updateOperonsPanel(operons, visibleOperons);
    }

    createSequenceTrack(chromosome, sequence) {
        const { track, trackContent } = this.createTrackBase('sequence', chromosome);
        const viewport = this.getCurrentViewport();
        
        // Get subsequence for current viewport
        const subsequence = sequence.substring(viewport.start, viewport.end);
        
        // Create single-line sequence display with dynamic sizing
        const seqDisplay = this.createSequenceDisplay(subsequence, viewport);
        trackContent.appendChild(seqDisplay);
        
        // Restore header state if it was previously hidden
        this.restoreHeaderState(track, 'sequence');
        
        return track;
    }
    
    /**
     * Create sequence display with improved organization
     */
    createSequenceDisplay(subsequence, viewport) {
        const seqDisplay = document.createElement('div');
        seqDisplay.className = 'sequence-single-line';
        seqDisplay.style.cssText = `
            position: relative;
            height: 30px;
            overflow: hidden;
            display: flex;
            align-items: center;
        `;
        
        // Calculate dynamic font size
        const containerWidth = 800; // fallback width
        const maxFontSize = 16;
        const minFontSize = 4;
        const calculatedFontSize = Math.max(minFontSize, Math.min(maxFontSize, containerWidth / viewport.range * 0.8));
        
        // Create sequence bases
        for (let i = 0; i < subsequence.length; i++) {
            const baseElement = this.createBaseElement(subsequence[i], i, viewport, calculatedFontSize);
            seqDisplay.appendChild(baseElement);
        }
        
        return seqDisplay;
    }
    
    /**
     * Create individual base element
     */
    createBaseElement(base, index, viewport, fontSize) {
        const baseElement = document.createElement('span');
        baseElement.className = `base-${base.toLowerCase()} sequence-base-inline`;
        baseElement.textContent = base;
        baseElement.style.cssText = `
            position: absolute;
            left: ${(index / viewport.range) * 100}%;
            font-size: ${fontSize}px;
            font-family: monospace;
            font-weight: bold;
            text-align: center;
            line-height: 30px;
        `;
        
        // Add tooltip with position info
        const position = viewport.start + index + 1;
        baseElement.title = `Position: ${position}, Base: ${base}`;
        
        return baseElement;
    }

    createGCTrack(chromosome, sequence) {
        const { track, trackContent } = this.createTrackBase('gc', chromosome);
        const viewport = this.getCurrentViewport();
        
        // Get subsequence for current viewport
        const subsequence = sequence.substring(viewport.start, viewport.end);
        
        // Create enhanced GC content and skew visualization
        const gcDisplay = this.createEnhancedGCVisualization(subsequence, viewport.start, viewport.end);
        trackContent.appendChild(gcDisplay);
        
        // Restore header state if it was previously hidden
        this.restoreHeaderState(track, 'gc');
        
        return track;
    }

    createVariantTrack(chromosome) {
        const { track, trackContent } = this.createTrackBase('variants', chromosome);
        const viewport = this.getCurrentViewport();
        
        // Check if we have any variant data at all
        if (!this.genomeBrowser.currentVariants || Object.keys(this.genomeBrowser.currentVariants).length === 0) {
            const noDataMsg = this.createNoDataMessage(
                'No VCF file loaded. Load a VCF file to see variants.',
                'no-variants-message'
            );
            trackContent.appendChild(noDataMsg);
            return track;
        }
        
        // Get and filter variants
        const variants = this.genomeBrowser.currentVariants[chromosome] || [];
        const visibleVariants = this.filterFeaturesByViewport(variants, viewport);
        
        console.log(`Displaying ${visibleVariants.length} variants in region ${viewport.start}-${viewport.end}`);
        
        if (visibleVariants.length === 0) {
            const noVariantsMsg = this.createNoDataMessage(
                'No variants in this region',
                'no-variants-message'
            );
            trackContent.appendChild(noVariantsMsg);
        } else {
            this.renderVariantElements(trackContent, visibleVariants, viewport);
        }
        
        // Restore header state if it was previously hidden
        this.restoreHeaderState(track, 'variants');
        
        return track;
    }
    
    /**
     * Render variant elements
     */
    renderVariantElements(trackContent, visibleVariants, viewport) {
        visibleVariants.forEach((variant, index) => {
            const variantElement = this.createVariantElement(variant, viewport);
            trackContent.appendChild(variantElement);
        });
    }
    
    /**
     * Create individual variant element
     */
    createVariantElement(variant, viewport) {
        const variantElement = document.createElement('div');
        variantElement.className = 'variant-element';
        
        // Calculate position and dimensions
        const variantStart = Math.max(variant.start, viewport.start);
        const variantEnd = Math.min(variant.end, viewport.end);
        const left = ((variantStart - viewport.start) / viewport.range) * 100;
        const width = Math.max(((variantEnd - variantStart) / viewport.range) * 100, 0.2);
        
        variantElement.style.cssText = `
            left: ${left}%;
            width: ${width}%;
            height: 12px;
            top: 20px;
            position: absolute;
            background: #e74c3c;
            border-radius: 2px;
            cursor: pointer;
        `;
        
        // Create variant tooltip and click handler
        this.addVariantInteraction(variantElement, variant);
        
        return variantElement;
    }
    
    /**
     * Add interaction handlers to variant element
     */
    addVariantInteraction(variantElement, variant) {
        const variantInfo = `Variant: ${variant.id || 'Unknown'}\n` +
                          `Position: ${variant.start}-${variant.end}\n` +
                          `Ref: ${variant.ref || 'N/A'}\n` +
                          `Alt: ${variant.alt || 'N/A'}\n` +
                          `Quality: ${variant.quality || 'N/A'}`;
        
        variantElement.title = variantInfo;
        variantElement.addEventListener('click', () => {
            alert(variantInfo);
        });
    }

    async createReadsTrack(chromosome) {
        const track = document.createElement('div');
        track.className = 'reads-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'Aligned Reads';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        
        // Add draggable functionality
        this.genomeBrowser.makeDraggable(trackContent, chromosome);
        
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const range = end - start;
        
        // Check if ReadsManager has data loaded
        if (!this.genomeBrowser.readsManager.rawReadsData) {
            const noDataMsg = document.createElement('div');
            noDataMsg.className = 'no-reads-message';
            noDataMsg.textContent = 'No SAM/BAM file loaded. Load a SAM/BAM file to see aligned reads.';
            noDataMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `;
            trackContent.appendChild(noDataMsg);
            trackContent.style.height = '80px'; // Default height for empty track
            track.appendChild(trackContent);
            return track;
        }
        
        // Show loading indicator while fetching reads
        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'reads-loading';
        loadingMsg.textContent = 'Loading reads...';
        loadingMsg.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #666;
            font-style: italic;
            font-size: 12px;
        `;
        trackContent.appendChild(loadingMsg);
        
        try {
            // Get reads for current region using ReadsManager
            const visibleReads = await this.genomeBrowser.readsManager.getReadsForRegion(chromosome, start, end);
            
            // Remove loading message
            trackContent.removeChild(loadingMsg);
            
            console.log(`Displaying ${visibleReads.length} reads in region ${start}-${end}`);
            
            if (visibleReads.length === 0) {
                const noReadsMsg = document.createElement('div');
                noReadsMsg.className = 'no-reads-message';
                noReadsMsg.textContent = 'No reads in this region';
                noReadsMsg.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #666;
                    font-style: italic;
                    font-size: 12px;
                `;
                trackContent.appendChild(noReadsMsg);
                trackContent.style.height = '80px'; // Default height for empty track
                track.appendChild(trackContent);
                return track;
            }
            
            // Arrange reads into non-overlapping rows
            const readRows = this.arrangeReadsInRows(visibleReads, start, end);
            const readHeight = 14; // Height of each read
            const rowSpacing = 4; // Space between rows
            const topPadding = 10; // Top padding
            const bottomPadding = 10; // Bottom padding
            
            // Calculate adaptive track height
            const trackHeight = topPadding + (readRows.length * (readHeight + rowSpacing)) - rowSpacing + bottomPadding;
            trackContent.style.height = `${Math.max(trackHeight, 60)}px`; // Minimum 60px height
            
            // Create read elements
            readRows.forEach((rowReads, rowIndex) => {
                rowReads.forEach((read) => {
                    const readElement = document.createElement('div');
                    readElement.className = 'read-element';
                    
                    const readStart = Math.max(read.start, start);
                    const readEnd = Math.min(read.end, end);
                    const left = ((readStart - start) / range) * 100;
                    const width = Math.max(((readEnd - readStart) / range) * 100, 0.2);
                    
                    readElement.style.left = `${left}%`;
                    readElement.style.width = `${width}%`;
                    readElement.style.height = `${readHeight}px`;
                    readElement.style.top = `${topPadding + rowIndex * (readHeight + rowSpacing)}px`;
                    readElement.style.position = 'absolute';
                    readElement.style.background = read.strand === '+' ? '#00b894' : '#f39c12';
                    readElement.style.borderRadius = '2px';
                    readElement.style.cursor = 'pointer';
                    readElement.style.border = '1px solid rgba(0,0,0,0.2)';
                    
                    // Create read tooltip
                    const readInfo = `Read: ${read.id || 'Unknown'}\n` +
                                      `Position: ${read.start}-${read.end}\n` +
                                      `Strand: ${read.strand || 'N/A'}\n` +
                                      `Mapping Quality: ${read.mappingQuality || 'N/A'}\n` +
                                      `Row: ${rowIndex + 1}`;
                    
                    readElement.title = readInfo;
                    
                    // Add click handler for detailed info
                    readElement.addEventListener('click', () => {
                        alert(readInfo);
                    });
                    
                    trackContent.appendChild(readElement);
                });
            });
            
            // Add reads statistics with cache info
            const stats = this.genomeBrowser.readsManager.getCacheStats();
            const statsElement = document.createElement('div');
            statsElement.className = 'reads-stats';
            statsElement.style.cssText = `
                position: absolute;
                top: 5px;
                right: 10px;
                background: rgba(255,255,255,0.9);
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                color: #666;
                border: 1px solid #ddd;
            `;
            statsElement.textContent = `${visibleReads.length} reads | Cache: ${stats.cacheSize}/${stats.maxCacheSize} (${Math.round(stats.hitRate * 100)}% hit rate)`;
            trackContent.appendChild(statsElement);
            
            track.appendChild(trackContent);
            return track;
            
        } catch (error) {
            // Remove loading message
            if (trackContent.contains(loadingMsg)) {
                trackContent.removeChild(loadingMsg);
            }
            
            // Show error message
            const errorMsg = document.createElement('div');
            errorMsg.className = 'reads-error';
            errorMsg.textContent = `Error loading reads: ${error.message}`;
            errorMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #d32f2f;
                font-style: italic;
                font-size: 12px;
            `;
            trackContent.appendChild(errorMsg);
            trackContent.style.height = '80px'; // Default height for error track
            track.appendChild(trackContent);
            
            // Restore header state if it was previously hidden
            this.restoreHeaderState(track, 'reads');
            
            return track;
        }
    }

    // New method to arrange reads into non-overlapping rows
    arrangeReadsInRows(reads, viewStart, viewEnd) {
        // Sort reads by start position
        const sortedReads = [...reads].sort((a, b) => a.start - b.start);
        const rows = [];
        
        sortedReads.forEach(read => {
            let placed = false;
            
            // Try to place read in existing rows
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];
                let canPlace = true;
                
                // Check if read overlaps with any read in this row
                for (const existingRead of row) {
                    if (this.readsOverlap(read, existingRead)) {
                        canPlace = false;
                        break;
                    }
                }
                
                if (canPlace) {
                    row.push(read);
                    placed = true;
                    break;
                }
            }
            
            // If couldn't place in existing row, create new row
            if (!placed) {
                rows.push([read]);
            }
        });
        
        return rows;
    }

    // Helper method to check if two reads overlap
    readsOverlap(read1, read2) {
        return !(read1.end < read2.start || read2.end < read1.start);
    }

    createProteinTrack(chromosome) {
        const { track, trackContent } = this.createTrackBase('proteins', chromosome);
        const viewport = this.getCurrentViewport();
        
        // Get and filter proteins
        const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
        const proteins = this.filterProteinAnnotations(annotations, viewport);
        
        console.log(`Displaying ${proteins.length} proteins in region ${viewport.start}-${viewport.end}`);
        
        if (proteins.length === 0) {
            const noProteinsMsg = this.createNoDataMessage(
                'No proteins in this region or CDS filtered out',
                'no-proteins-message'
            );
            trackContent.appendChild(noProteinsMsg);
        } else {
            this.renderProteinElements(trackContent, proteins, viewport);
        }
        
        // Restore header state if it was previously hidden
        this.restoreHeaderState(track, 'proteins');
        
        return track;
    }
    
    /**
     * Filter protein annotations (CDS features)
     */
    filterProteinAnnotations(annotations, viewport) {
        return annotations.filter(feature => 
            feature.type === 'CDS' &&
            this.genomeBrowser.shouldShowGeneType('CDS')
        ).filter(protein => this.filterFeaturesByViewport([protein], viewport).length > 0);
    }
    
    /**
     * Render protein elements
     */
    renderProteinElements(trackContent, proteins, viewport) {
        proteins.forEach((protein, index) => {
            const proteinElement = this.createProteinElement(protein, viewport);
            trackContent.appendChild(proteinElement);
        });
    }
    
    /**
     * Create individual protein element
     */
    createProteinElement(protein, viewport) {
        const proteinElement = document.createElement('div');
        proteinElement.className = 'protein-element';
        
        // Calculate position and dimensions
        const proteinStart = Math.max(protein.start, viewport.start);
        const proteinEnd = Math.min(protein.end, viewport.end);
        const left = ((proteinStart - viewport.start) / viewport.range) * 100;
        const width = Math.max(((proteinEnd - proteinStart) / viewport.range) * 100, 0.3);
        
        proteinElement.style.left = `${left}%`;
        proteinElement.style.width = `${Math.max(width, 0.3)}%`;
        
        if (protein.strand === -1) {
            proteinElement.classList.add('reverse-strand');
        }
        
        // Set protein label and tooltip
        this.setProteinElementContent(proteinElement, protein, width);
        
        // Add interaction handlers
        this.addProteinElementHandlers(proteinElement, protein);
        
        return proteinElement;
    }
    
    /**
     * Set protein element content and tooltip
     */
    setProteinElementContent(proteinElement, protein, width) {
        const proteinName = protein.qualifiers.product || protein.qualifiers.gene || protein.qualifiers.locus_tag || 'Protein';
        const proteinInfo = `${proteinName} (CDS)`;
        const positionInfo = `${protein.start}-${protein.end} (${protein.strand === -1 ? '-' : '+'} strand)`;
        
        proteinElement.title = `${proteinInfo}\nPosition: ${positionInfo}`;
        
        // Set text content based on available space
        if (width > 2) {
            proteinElement.textContent = proteinName.length > 10 ? proteinName.substring(0, 10) + '...' : proteinName;
        } else if (width > 0.8) {
            proteinElement.textContent = proteinName.substring(0, 3);
        } else {
            proteinElement.textContent = '';
        }
    }
    
    /**
     * Add interaction handlers to protein element
     */
    addProteinElementHandlers(proteinElement, protein) {
        proteinElement.addEventListener('click', () => {
            this.showProteinDetails(protein, this.genomeBrowser.currentChromosome);
        });
    }

    createEnhancedGCVisualization(sequence, viewStart, viewEnd) {
        const container = document.createElement('div');
        container.className = 'gc-content-skew-display';
        container.style.cssText = `
            position: relative;
            height: 100px;
            background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 50%, #f8f9fa 100%);
            border: 1px solid #dee2e6;
            border-radius: 6px;
            overflow: hidden;
        `;
        
        // Create SVG for crisp, scalable visualization
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', '0 0 800 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            cursor: crosshair;
        `;
        
        // Calculate dynamic window size based on sequence length and current zoom level
        const currentRange = viewEnd - viewStart;
        const basePairsPerPixel = currentRange / 800; // Assuming 800px width
        
        // Adaptive window size: smaller for zoomed-in views, larger for zoomed-out views
        let windowSize;
        if (basePairsPerPixel <= 1) {
            // Very zoomed in - use small windows for high resolution
            windowSize = Math.max(10, Math.floor(currentRange / 200));
        } else if (basePairsPerPixel <= 10) {
            // Moderately zoomed in
            windowSize = Math.max(50, Math.floor(currentRange / 100));
        } else {
            // Zoomed out - use larger windows
            windowSize = Math.max(100, Math.floor(currentRange / 50));
        }
        
        // Ensure window size doesn't exceed sequence length
        windowSize = Math.min(windowSize, sequence.length);
        
        // Calculate step size for smooth visualization
        const stepSize = Math.max(1, Math.floor(windowSize / 4));
        
        console.log(`Dynamic GC analysis: range=${currentRange}, bpPerPixel=${basePairsPerPixel.toFixed(2)}, windowSize=${windowSize}, stepSize=${stepSize}`);
        
        // Calculate GC content and skew data with dynamic parameters
        const analysisData = this.calculateDynamicGCData(sequence, windowSize, stepSize);
        
        if (!analysisData || analysisData.positions.length === 0) {
            // No data to display
            const noDataMsg = document.createElement('div');
            noDataMsg.textContent = 'Sequence too short for GC analysis';
            noDataMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #6c757d;
                font-size: 12px;
                font-style: italic;
            `;
            container.appendChild(noDataMsg);
            return container;
        }
        
        // Create SVG visualization
        this.renderSVGGCVisualization(svg, analysisData);
        
        // Add interactive tooltip
        this.addSVGGCTooltip(container, svg, analysisData, viewStart, windowSize);
        
        // Add legend
        const legend = this.createGCLegend();
        container.appendChild(legend);
        
        container.appendChild(svg);
        
        return container;
    }
    
    calculateDynamicGCData(sequence, windowSize, stepSize) {
        const gcData = [];
        const skewData = [];
        const positions = [];
        const detailedData = []; // Store detailed composition data
        
        // Process sequence in windows with specified step size
        for (let i = 0; i <= sequence.length - windowSize; i += stepSize) {
            const window = sequence.substring(i, i + windowSize);
            const analysis = this.analyzeGCWindow(window);
            
            if (analysis.totalValidBases > 0) {
                gcData.push(analysis.gcPercent);
                skewData.push(analysis.gcSkew);
                positions.push(i + windowSize / 2); // Center position of window
                detailedData.push({
                    position: i + windowSize / 2,
                    windowStart: i,
                    windowEnd: i + windowSize,
                    ...analysis
                });
            }
        }
        
        if (gcData.length === 0) {
            return null;
        }
        
        // Calculate statistics for scaling
        const gcMin = Math.min(...gcData);
        const gcMax = Math.max(...gcData);
        const skewMin = Math.min(...skewData);
        const skewMax = Math.max(...skewData);
        
        // Add some padding to the ranges for better visualization
        const gcRange = gcMax - gcMin;
        const skewRange = skewMax - skewMin;
        const gcPadding = Math.max(1, gcRange * 0.1);
        const skewPadding = Math.max(0.01, skewRange * 0.1);
        
        return {
            gcData,
            skewData,
            positions,
            detailedData,
            gcMin: gcMin - gcPadding,
            gcMax: gcMax + gcPadding,
            skewMin: skewMin - skewPadding,
            skewMax: skewMax + skewPadding,
            sequenceLength: sequence.length,
            windowSize,
            stepSize
        };
    }
    
    analyzeGCWindow(window) {
        const bases = window.toUpperCase();
        const gCount = (bases.match(/G/g) || []).length;
        const cCount = (bases.match(/C/g) || []).length;
        const aCount = (bases.match(/A/g) || []).length;
        const tCount = (bases.match(/T/g) || []).length;
        const nCount = (bases.match(/N/g) || []).length;
        const totalValidBases = gCount + cCount + aCount + tCount;
        const totalBases = totalValidBases + nCount;
        
        if (totalValidBases === 0) {
            return { 
                gcPercent: 0, 
                gcSkew: 0, 
                atSkew: 0,
                gCount, 
                cCount, 
                aCount, 
                tCount, 
                nCount,
                totalValidBases,
                totalBases
            };
        }
        
        const gcPercent = ((gCount + cCount) / totalValidBases) * 100;
        const gcSkew = (gCount + cCount) > 0 ? (gCount - cCount) / (gCount + cCount) : 0;
        const atSkew = (aCount + tCount) > 0 ? (aCount - tCount) / (aCount + tCount) : 0;
        
        return { 
            gcPercent, 
            gcSkew, 
            atSkew,
            gCount, 
            cCount, 
            aCount, 
            tCount, 
            nCount,
            totalValidBases,
            totalBases
        };
    }
    
    renderSVGGCVisualization(svg, data) {
        const { gcData, skewData, positions, gcMin, gcMax, skewMin, skewMax, sequenceLength } = data;
        
        // Clear any existing content
        svg.innerHTML = '';
        
        // Define dimensions and layout with minimal padding
        const viewWidth = 800;
        const viewHeight = 100;
        const padding = 2; // Reduced from 20 to 2 for minimal padding
        const plotWidth = viewWidth - 2 * padding;
        const plotHeight = viewHeight - 2 * padding;
        const centerY = viewHeight / 2;
        const gcHeight = centerY - padding;
        const skewHeight = centerY - padding;
        
        // Create gradient definitions
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        // GC content gradient
        const gcGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        gcGradient.setAttribute('id', 'gcGradient');
        gcGradient.setAttribute('x1', '0%');
        gcGradient.setAttribute('y1', '0%');
        gcGradient.setAttribute('x2', '0%');
        gcGradient.setAttribute('y2', '100%');
        
        const gcStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        gcStop1.setAttribute('offset', '0%');
        gcStop1.setAttribute('stop-color', '#28a745');
        gcStop1.setAttribute('stop-opacity', '0.8');
        
        const gcStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        gcStop2.setAttribute('offset', '100%');
        gcStop2.setAttribute('stop-color', '#28a745');
        gcStop2.setAttribute('stop-opacity', '0.2');
        
        gcGradient.appendChild(gcStop1);
        gcGradient.appendChild(gcStop2);
        
        // GC skew gradients (positive and negative)
        const skewPosGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        skewPosGradient.setAttribute('id', 'skewPosGradient');
        skewPosGradient.setAttribute('x1', '0%');
        skewPosGradient.setAttribute('y1', '0%');
        skewPosGradient.setAttribute('x2', '0%');
        skewPosGradient.setAttribute('y2', '100%');
        
        const skewPosStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        skewPosStop1.setAttribute('offset', '0%');
        skewPosStop1.setAttribute('stop-color', '#ffc107');
        skewPosStop1.setAttribute('stop-opacity', '0.8');
        
        const skewPosStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        skewPosStop2.setAttribute('offset', '100%');
        skewPosStop2.setAttribute('stop-color', '#ffc107');
        skewPosStop2.setAttribute('stop-opacity', '0.2');
        
        skewPosGradient.appendChild(skewPosStop1);
        skewPosGradient.appendChild(skewPosStop2);
        
        const skewNegGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        skewNegGradient.setAttribute('id', 'skewNegGradient');
        skewNegGradient.setAttribute('x1', '0%');
        skewNegGradient.setAttribute('y1', '0%');
        skewNegGradient.setAttribute('x2', '0%');
        skewNegGradient.setAttribute('y2', '100%');
        
        const skewNegStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        skewNegStop1.setAttribute('offset', '0%');
        skewNegStop1.setAttribute('stop-color', '#dc3545');
        skewNegStop1.setAttribute('stop-opacity', '0.2');
        
        const skewNegStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        skewNegStop2.setAttribute('offset', '100%');
        skewNegStop2.setAttribute('stop-color', '#dc3545');
        skewNegStop2.setAttribute('stop-opacity', '0.8');
        
        skewNegGradient.appendChild(skewNegStop1);
        skewNegGradient.appendChild(skewNegStop2);
        
        defs.appendChild(gcGradient);
        defs.appendChild(skewPosGradient);
        defs.appendChild(skewNegGradient);
        svg.appendChild(defs);
        
        // Draw background grid
        this.drawSVGGrid(svg, padding, plotWidth, plotHeight, centerY);
        
        // Draw GC content area and line
        this.drawSVGGCContent(svg, gcData, positions, sequenceLength, padding, plotWidth, gcHeight, gcMin, gcMax);
        
        // Draw GC skew areas and line
        this.drawSVGGCSkew(svg, skewData, positions, sequenceLength, padding, plotWidth, centerY, plotHeight, skewMin, skewMax);
        
        // Draw axis labels
        this.drawSVGAxisLabels(svg, viewWidth, viewHeight, gcMin, gcMax, skewMin, skewMax);
    }
    
    drawSVGGrid(svg, padding, plotWidth, plotHeight, centerY) {
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gridGroup.setAttribute('class', 'grid-lines');
        
        // Grid line style
        const gridStyle = 'stroke: #e9ecef; stroke-width: 0.5; stroke-dasharray: 2,2; opacity: 0.6;';
        
        // Horizontal grid lines for GC content (upper half)
        for (let i = 1; i <= 3; i++) {
            const y = padding + (i * (centerY - padding) / 4);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding);
            line.setAttribute('y1', y);
            line.setAttribute('x2', padding + plotWidth);
            line.setAttribute('y2', y);
            line.setAttribute('style', gridStyle);
            gridGroup.appendChild(line);
        }
        
        // Horizontal grid lines for GC skew (lower half)
        for (let i = 1; i <= 3; i++) {
            const y = centerY + padding + (i * (plotHeight - centerY - padding) / 4);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding);
            line.setAttribute('y1', y);
            line.setAttribute('x2', padding + plotWidth);
            line.setAttribute('y2', y);
            line.setAttribute('style', gridStyle);
            gridGroup.appendChild(line);
        }
        
        // Center line (zero line for GC skew)
        const centerLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        centerLine.setAttribute('x1', padding);
        centerLine.setAttribute('y1', centerY);
        centerLine.setAttribute('x2', padding + plotWidth);
        centerLine.setAttribute('y2', centerY);
        centerLine.setAttribute('style', 'stroke: #6c757d; stroke-width: 1; opacity: 0.8;');
        gridGroup.appendChild(centerLine);
        
        svg.appendChild(gridGroup);
    }
    
    drawSVGGCContent(svg, gcData, positions, sequenceLength, padding, plotWidth, maxHeight, gcMin, gcMax) {
        if (gcData.length < 2) return;
        
        const gcRange = gcMax - gcMin;
        
        // Create path for filled area
        const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let pathData = `M ${padding} ${maxHeight}`;
        
        // Add points for the area
        for (let i = 0; i < gcData.length; i++) {
            const x = padding + (positions[i] / sequenceLength) * plotWidth;
            const normalizedGC = gcRange > 0 ? (gcData[i] - gcMin) / gcRange : 0.5;
            const y = maxHeight - normalizedGC * (maxHeight - padding);
            pathData += ` L ${x} ${y}`;
        }
        
        pathData += ` L ${padding + plotWidth} ${maxHeight} Z`;
        
        areaPath.setAttribute('d', pathData);
        areaPath.setAttribute('fill', 'url(#gcGradient)');
        areaPath.setAttribute('stroke', 'none');
        svg.appendChild(areaPath);
        
        // Create path for line
        const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let lineData = '';
        
        for (let i = 0; i < gcData.length; i++) {
            const x = padding + (positions[i] / sequenceLength) * plotWidth;
            const normalizedGC = gcRange > 0 ? (gcData[i] - gcMin) / gcRange : 0.5;
            const y = maxHeight - normalizedGC * (maxHeight - padding);
            
            if (i === 0) {
                lineData = `M ${x} ${y}`;
            } else {
                lineData += ` L ${x} ${y}`;
            }
        }
        
        linePath.setAttribute('d', lineData);
        linePath.setAttribute('fill', 'none');
        linePath.setAttribute('stroke', '#28a745');
        linePath.setAttribute('stroke-width', '2');
        linePath.setAttribute('stroke-linecap', 'round');
        linePath.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(linePath);
    }
    
    drawSVGGCSkew(svg, skewData, positions, sequenceLength, padding, plotWidth, centerY, plotHeight, skewMin, skewMax) {
        if (skewData.length < 2) return;
        
        const skewRange = skewMax - skewMin;
        
        // Calculate zero line position in the lower half
        const skewHalfHeight = (plotHeight - centerY);
        const zeroRatio = skewRange > 0 ? Math.abs(skewMin) / skewRange : 0.5;
        const zeroY = centerY + zeroRatio * skewHalfHeight;
        
        // Create continuous area paths for positive and negative regions
        let posAreaData = '';
        let negAreaData = '';
        let hasPositive = false;
        let hasNegative = false;
        
        // Build continuous area paths
        for (let i = 0; i < skewData.length; i++) {
            const x = padding + (positions[i] / sequenceLength) * plotWidth;
            const normalizedSkew = skewRange > 0 ? (skewData[i] - skewMin) / skewRange : 0.5;
            const y = centerY + (1 - normalizedSkew) * skewHalfHeight;
            
            if (skewData[i] >= 0) {
                if (!hasPositive) {
                    posAreaData = `M ${x} ${zeroY}`;
                    hasPositive = true;
                }
                posAreaData += ` L ${x} ${Math.min(y, zeroY)}`;
            }
            
            if (skewData[i] <= 0) {
                if (!hasNegative) {
                    negAreaData = `M ${x} ${zeroY}`;
                    hasNegative = true;
                }
                negAreaData += ` L ${x} ${Math.max(y, zeroY)}`;
            }
        }
        
        // Close positive area path
        if (hasPositive && posAreaData) {
            posAreaData += ` L ${padding + plotWidth} ${zeroY} L ${padding} ${zeroY} Z`;
            const posPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            posPath.setAttribute('d', posAreaData);
            posPath.setAttribute('fill', 'url(#skewPosGradient)');
            posPath.setAttribute('stroke', 'none');
            svg.appendChild(posPath);
        }
        
        // Close negative area path
        if (hasNegative && negAreaData) {
            negAreaData += ` L ${padding + plotWidth} ${zeroY} L ${padding} ${zeroY} Z`;
            const negPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            negPath.setAttribute('d', negAreaData);
            negPath.setAttribute('fill', 'url(#skewNegGradient)');
            negPath.setAttribute('stroke', 'none');
            svg.appendChild(negPath);
        }
        
        // Create path for skew line
        const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let lineData = '';
        
        for (let i = 0; i < skewData.length; i++) {
            const x = padding + (positions[i] / sequenceLength) * plotWidth;
            const normalizedSkew = skewRange > 0 ? (skewData[i] - skewMin) / skewRange : 0.5;
            const y = centerY + (1 - normalizedSkew) * skewHalfHeight;
            
            if (i === 0) {
                lineData = `M ${x} ${y}`;
            } else {
                lineData += ` L ${x} ${y}`;
            }
        }
        
        linePath.setAttribute('d', lineData);
        linePath.setAttribute('fill', 'none');
        linePath.setAttribute('stroke', '#495057');
        linePath.setAttribute('stroke-width', '1.5');
        linePath.setAttribute('stroke-linecap', 'round');
        linePath.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(linePath);
    }
    
    drawSVGAxisLabels(svg, viewWidth, viewHeight, gcMin, gcMax, skewMin, skewMax) {
        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        labelGroup.setAttribute('class', 'axis-labels');
        
        const labelStyle = 'font-family: Inter, sans-serif; font-size: 10px; fill: #495057;';
        
        // Track labels (right side) - adjusted for reduced padding
        const gcLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        gcLabel.setAttribute('x', viewWidth - 25); // Moved further right to account for reduced padding
        gcLabel.setAttribute('y', '15');
        gcLabel.setAttribute('text-anchor', 'start');
        gcLabel.setAttribute('style', labelStyle + ' fill: #28a745; font-weight: 600;');
        gcLabel.textContent = 'GC%';
        
        const skewLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        skewLabel.setAttribute('x', viewWidth - 25); // Moved further right to account for reduced padding
        skewLabel.setAttribute('y', viewHeight - 5);
        skewLabel.setAttribute('text-anchor', 'start');
        skewLabel.setAttribute('style', labelStyle + ' font-weight: 600;');
        skewLabel.textContent = 'Skew';
        
        labelGroup.appendChild(gcLabel);
        labelGroup.appendChild(skewLabel);
        
        svg.appendChild(labelGroup);
    }
    
    addSVGGCTooltip(container, svg, data, viewStart, windowSize) {
        const tooltip = document.createElement('div');
        tooltip.className = 'gc-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            line-height: 1.4;
            pointer-events: none;
            z-index: 1000;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 200px;
            white-space: nowrap;
        `;
        container.appendChild(tooltip);
        
        svg.addEventListener('mousemove', (e) => {
            const rect = svg.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            
            // Find closest data point
            const sequencePos = x * data.sequenceLength;
            let closestIndex = 0;
            let minDistance = Math.abs(data.positions[0] - sequencePos);
            
            for (let i = 1; i < data.positions.length; i++) {
                const distance = Math.abs(data.positions[i] - sequencePos);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = i;
                }
            }
            
            if (closestIndex < data.detailedData.length) {
                const detail = data.detailedData[closestIndex];
                const absolutePos = viewStart + detail.position;
                const windowStart = viewStart + detail.windowStart;
                const windowEnd = viewStart + detail.windowEnd;
                
                tooltip.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 4px; color: #ffc107;">Position: ${Math.round(absolutePos).toLocaleString()}</div>
                    <div style="color: #28a745;">GC Content: ${detail.gcPercent.toFixed(2)}%</div>
                    <div style="color: #495057;">GC Skew: ${detail.gcSkew.toFixed(4)}</div>
                    <div style="color: #17a2b8;">AT Skew: ${detail.atSkew.toFixed(4)}</div>
                    <div style="margin-top: 4px; color: #6c757d; font-size: 10px;">
                        Window: ${windowStart.toLocaleString()}-${windowEnd.toLocaleString()}<br>
                        G:${detail.gCount} C:${detail.cCount} A:${detail.aCount} T:${detail.tCount}
                    </div>
                `;
                
                tooltip.style.display = 'block';
                
                // Position tooltip near cursor but keep it within container bounds
                const containerRect = container.getBoundingClientRect();
                const tooltipX = Math.min(e.clientX - containerRect.left + 10, containerRect.width - 220);
                const tooltipY = Math.max(e.clientY - containerRect.top - 60, 10);
                
                tooltip.style.left = `${tooltipX}px`;
                tooltip.style.top = `${tooltipY}px`;
            }
        });
        
        svg.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    }

    showGeneDetails(gene, operonInfo) {
        // Call the main Genome AI Studio's gene selection methods
        this.genomeBrowser.selectGene(gene, operonInfo);
        this.genomeBrowser.showGeneDetailsPanel();
        this.genomeBrowser.populateGeneDetails(gene, operonInfo);
        this.genomeBrowser.highlightGeneSequence(gene);
    }

    showProteinDetails(protein, chromosome) {
        const sequence = this.genomeBrowser.currentSequence[chromosome];
        const dnaSequence = sequence.substring(protein.start - 1, protein.end);
        const proteinSequence = this.genomeBrowser.translateDNA(dnaSequence, protein.strand);
        
        const details = [];
        details.push(`Type: Protein (CDS)`);
        details.push(`Position: ${protein.start}-${protein.end}`);
        details.push(`Strand: ${protein.strand === -1 ? 'Reverse (-)' : 'Forward (+)'}`);
        details.push(`Length: ${protein.end - protein.start + 1} bp (${Math.floor((protein.end - protein.start + 1) / 3)} aa)`);
        details.push(`DNA Sequence: ${dnaSequence.substring(0, 60)}${dnaSequence.length > 60 ? '...' : ''}`);
        details.push(`Protein Sequence: ${proteinSequence.substring(0, 20)}${proteinSequence.length > 20 ? '...' : ''}`);
        
        if (protein.qualifiers) {
            Object.entries(protein.qualifiers).forEach(([key, value]) => {
                // Convert value to string and check if it's meaningful
                const stringValue = value != null ? String(value) : '';
                if (stringValue && stringValue !== 'Unknown') {
                    details.push(`${key}: ${stringValue}`);
                }
            });
        }
        
        alert(details.join('\n'));
    }

    lightenColor(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R : 255) * 0x10000 + (G < 255 ? G : 255) * 0x100 + (B < 255 ? B : 255)).toString(16).slice(1);
    }

    darkenColor(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R < 0 ? 0 : R) * 0x10000 + (G < 0 ? 0 : G) * 0x100 + (B < 0 ? 0 : B)).toString(16).slice(1);
    }

    updateOperonsPanel(operons, visibleOperons) {
        const operonsList = document.getElementById('operonsList');
        
        if (!operonsList) return;
        
        // Clear existing content
        operonsList.innerHTML = '';
        
        if (visibleOperons.size === 0) {
            const noOperons = document.createElement('p');
            noOperons.className = 'no-operons';
            noOperons.textContent = 'No operons detected in current view';
            operonsList.appendChild(noOperons);
            return;
        }
        
        // Create operon items for visible operons
        Array.from(visibleOperons).forEach(operonName => {
            // Find the operon data
            const operonData = operons.find(op => op.name === operonName);
            if (!operonData) return;
            
            const color = this.genomeBrowser.assignOperonColor(operonName);
            
            const operonItem = document.createElement('div');
            operonItem.className = 'operon-item';
            
            // Color indicator
            const colorIndicator = document.createElement('div');
            colorIndicator.className = 'operon-color-indicator';
            colorIndicator.style.background = `linear-gradient(135deg, ${color}, ${this.lightenColor(color, 20)})`;
            colorIndicator.style.borderColor = this.darkenColor(color, 20);
            
            // Operon info
            const operonInfo = document.createElement('div');
            operonInfo.className = 'operon-info';
            
            const operonNameEl = document.createElement('div');
            operonNameEl.className = 'operon-name';
            operonNameEl.textContent = operonName.replace('_operon', '');
            
            const operonDetails = document.createElement('div');
            operonDetails.className = 'operon-details';
            operonDetails.textContent = `${operonData.start.toLocaleString()}-${operonData.end.toLocaleString()} (${operonData.strand === -1 ? '-' : '+'})`;
            
            operonInfo.appendChild(operonNameEl);
            operonInfo.appendChild(operonDetails);
            
            // Gene count badge
            const geneCount = document.createElement('div');
            geneCount.className = 'operon-gene-count';
            geneCount.textContent = operonData.genes.length.toString();
            geneCount.title = `${operonData.genes.length} genes in this operon`;
            
            // Add click handler to navigate to operon
            operonItem.addEventListener('click', () => {
                this.navigateToOperon(operonData);
            });
            
            operonItem.appendChild(colorIndicator);
            operonItem.appendChild(operonInfo);
            operonItem.appendChild(geneCount);
            
            operonsList.appendChild(operonItem);
        });
    }
    
    navigateToOperon(operonData) {
        // Navigate to the operon location
        const padding = Math.max(1000, (operonData.end - operonData.start) * 0.2);
        const newStart = Math.max(0, operonData.start - padding);
        const newEnd = operonData.end + padding;
        
        this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
        
        // Refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
        }
        
        // Update statistics
        this.genomeBrowser.updateStatistics(currentChr, this.genomeBrowser.currentSequence[currentChr]);
    }

    // New method to arrange genes into non-overlapping rows
    arrangeGenesInRows(genes, viewStart, viewEnd, operons, settings) {
        // Get settings with defaults
        const maxRows = settings?.maxRows || 6;
        const showOperonsSameRow = settings?.showOperonsSameRow || false;
        
        console.log(`arrangeGenesInRows: maxRows=${maxRows}, showOperonsSameRow=${showOperonsSameRow}, totalGenes=${genes.length}`);
        
        // Sort genes by start position
        const sortedGenes = [...genes].sort((a, b) => a.start - b.start);
        const rows = [];
        
        if (showOperonsSameRow && operons && operons.length > 0) {
            // Group genes by operons first
            const operonGroups = new Map();
            const singleGenes = [];
            
            sortedGenes.forEach(gene => {
                const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);
                if (operonInfo.isInOperon) {
                    if (!operonGroups.has(operonInfo.operonName)) {
                        operonGroups.set(operonInfo.operonName, []);
                    }
                    operonGroups.get(operonInfo.operonName).push(gene);
                } else {
                    singleGenes.push(gene);
                }
            });
            
            // Process operon groups first (try to place all genes of an operon in the same row)
            for (const [operonName, operonGenes] of operonGroups) {
                // Sort operon genes by position
                operonGenes.sort((a, b) => a.start - b.start);
                
                // Try to find a row that can fit all operon genes
                let placedInExistingRow = false;
                
                for (let rowIndex = 0; rowIndex < rows.length && rowIndex < maxRows; rowIndex++) {
                    const row = rows[rowIndex];
                    let canPlaceAll = true;
                    
                    // Check if all operon genes can fit in this row
                    for (const operonGene of operonGenes) {
                        let conflicts = false;
                        for (const existingGene of row) {
                            if (this.genesOverlap(operonGene, existingGene)) {
                                conflicts = true;
                                break;
                            }
                        }
                        if (conflicts) {
                            canPlaceAll = false;
                            break;
                        }
                    }
                    
                    if (canPlaceAll) {
                        // Add all operon genes to this row
                        row.push(...operonGenes);
                        placedInExistingRow = true;
                        break;
                    }
                }
                
                // If couldn't place in existing row and we haven't reached max rows, create new row
                if (!placedInExistingRow && rows.length < maxRows) {
                    rows.push([...operonGenes]);
                } else if (!placedInExistingRow) {
                    // If we've reached max rows, place operon genes in available rows with space
                    operonGenes.forEach(gene => {
                        let placed = false;
                        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                            const row = rows[rowIndex];
                            let canPlace = true;
                            
                            for (const existingGene of row) {
                                if (this.genesOverlap(gene, existingGene)) {
                                    canPlace = false;
                                    break;
                                }
                            }
                            
                            if (canPlace) {
                                row.push(gene);
                                placed = true;
                                break;
                            }
                        }
                        
                        // If still can't place, add to the last row (genes will overlap)
                        if (!placed && rows.length > 0) {
                            rows[rows.length - 1].push(gene);
                        }
                    });
                }
            }
            
            // Process single genes
            singleGenes.forEach(gene => {
                let placed = false;
                
                // Try to place in existing rows
                for (let rowIndex = 0; rowIndex < rows.length && rowIndex < maxRows; rowIndex++) {
                    const row = rows[rowIndex];
                    let canPlace = true;
                    
                    for (const existingGene of row) {
                        if (this.genesOverlap(gene, existingGene)) {
                            canPlace = false;
                            break;
                        }
                    }
                    
                    if (canPlace) {
                        row.push(gene);
                        placed = true;
                        break;
                    }
                }
                
                // If couldn't place in existing row and we haven't reached max rows, create new row
                if (!placed && rows.length < maxRows) {
                    rows.push([gene]);
                } else if (!placed && rows.length > 0) {
                    // If we've reached max rows, add to the last row (genes will overlap)
                    rows[rows.length - 1].push(gene);
                }
            });
            
        } else {
            // Original algorithm: place genes without operon grouping
            sortedGenes.forEach(gene => {
                let placed = false;
                
                // Try to place gene in existing rows (up to maxRows)
                for (let rowIndex = 0; rowIndex < rows.length && rowIndex < maxRows; rowIndex++) {
                    const row = rows[rowIndex];
                    let canPlace = true;
                    
                    // Check if gene overlaps with any gene in this row
                    for (const existingGene of row) {
                        if (this.genesOverlap(gene, existingGene)) {
                            canPlace = false;
                            break;
                        }
                    }
                    
                    if (canPlace) {
                        row.push(gene);
                        placed = true;
                        break;
                    }
                }
                
                // If couldn't place in existing row and we haven't reached max rows, create new row
                if (!placed && rows.length < maxRows) {
                    rows.push([gene]);
                } else if (!placed && rows.length > 0) {
                    // If we've reached max rows, add to the last row (genes will overlap)
                    rows[rows.length - 1].push(gene);
                }
            });
        }
        
        console.log(`arrangeGenesInRows result: created ${rows.length} rows`);
        return rows;
    }

    // Helper to check if two genes overlap with a buffer
    genesOverlap(gene1, gene2) {
        const buffer = 10; // Reduced buffer from 50bp to 10bp for tighter packing
        return (gene1.start < gene2.end + buffer && gene1.end + buffer > gene2.start);
    }

    // Create detailed ruler for current viewing region
    createDetailedRuler(chromosome) {
        const rulerContainer = document.createElement('div');
        rulerContainer.className = 'detailed-ruler-container';
        rulerContainer.style.cssText = `
            position: relative;
            height: 30px;
            background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
            border-bottom: 1px solid #dee2e6;
            margin-bottom: 5px;
            z-index: 10;
            overflow: hidden;
        `;

        const canvas = document.createElement('canvas');
        canvas.className = 'detailed-ruler-canvas';
        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 11;
        `;

        rulerContainer.appendChild(canvas);

        // Setup canvas for high-DPI displays
        const setupCanvas = () => {
            const rect = rulerContainer.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            canvas.width = rect.width * dpr;
            canvas.height = 30 * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = '30px';
            
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            
            this.drawDetailedRuler(ctx, rect.width, chromosome);
        };

        // Initial setup
        setTimeout(setupCanvas, 100);

        // Redraw on window resize
        const resizeObserver = new ResizeObserver(setupCanvas);
        resizeObserver.observe(rulerContainer);

        // Store reference for updates
        rulerContainer._setupCanvas = setupCanvas;

        return rulerContainer;
    }

    // Draw the detailed ruler
    drawDetailedRuler(ctx, width, chromosome) {
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const range = end - start;
        
        if (range <= 0 || width <= 0) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, 30);

        // Fill background
        const gradient = ctx.createLinearGradient(0, 0, 0, 30);
        gradient.addColorStop(0, '#f8f9fa');
        gradient.addColorStop(1, '#e9ecef');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, 30);

        // Calculate intelligent tick spacing
        const { majorInterval, minorInterval } = this.calculateDetailedTickSpacing(range, width);

        // Draw ticks and labels
        ctx.strokeStyle = '#6c757d';
        ctx.fillStyle = '#495057';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Major ticks - ensure we don't draw overlapping labels
        const firstMajorTick = Math.ceil(start / majorInterval) * majorInterval;
        const drawnPositions = new Set(); // Track drawn positions to avoid duplicates
        
        for (let pos = firstMajorTick; pos <= end; pos += majorInterval) {
            const x = ((pos - start) / range) * width;
            
            if (x >= 0 && x <= width && !drawnPositions.has(pos)) {
                drawnPositions.add(pos);
                
                // Draw major tick
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 20);
                ctx.stroke();

                // Draw label with minimum spacing check
                const label = this.formatDetailedPosition(pos);
                const labelWidth = ctx.measureText(label).width;
                
                // Check if there's enough space for this label
                let canDrawLabel = true;
                for (const drawnPos of drawnPositions) {
                    if (drawnPos !== pos) {
                        const drawnX = ((drawnPos - start) / range) * width;
                        if (Math.abs(x - drawnX) < labelWidth + 10) { // 10px minimum spacing
                            canDrawLabel = false;
                            break;
                        }
                    }
                }
                
                if (canDrawLabel) {
                    ctx.fillText(label, x, 28);
                }
            }
        }

        // Minor ticks (if there's enough space)
        if (width / (range / minorInterval) > 8) { // Only show if ticks are spaced enough
            ctx.strokeStyle = '#adb5bd';
            const firstMinorTick = Math.ceil(start / minorInterval) * minorInterval;
            for (let pos = firstMinorTick; pos <= end; pos += minorInterval) {
                if (pos % majorInterval !== 0) { // Skip positions that have major ticks
                    const x = ((pos - start) / range) * width;
                    
                    if (x >= 0 && x <= width) {
                        ctx.beginPath();
                        ctx.moveTo(x, 0);
                        ctx.lineTo(x, 10);
                        ctx.stroke();
                    }
                }
            }
        }

        // Draw border
        ctx.strokeStyle = '#dee2e6';
        ctx.beginPath();
        ctx.moveTo(0, 29.5);
        ctx.lineTo(width, 29.5);
        ctx.stroke();
    }

    // Calculate intelligent tick spacing for detailed view
    calculateDetailedTickSpacing(range, width) {
        const targetMajorTicks = Math.max(3, Math.min(8, width / 100));
        const targetMinorTicks = targetMajorTicks * 5;

        // Base intervals to choose from
        const baseIntervals = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000];

        // Find best major interval
        let majorInterval = baseIntervals[0];
        for (const interval of baseIntervals) {
            const tickCount = range / interval;
            if (tickCount <= targetMajorTicks) {
                majorInterval = interval;
                break;
            }
        }

        // Minor interval is typically 1/5 or 1/10 of major
        let minorInterval = majorInterval / 5;
        if (majorInterval % 10 === 0) {
            minorInterval = majorInterval / 10;
        } else if (majorInterval % 4 === 0) {
            minorInterval = majorInterval / 4;
        }

        return { majorInterval, minorInterval };
    }

    // Format position for detailed ruler
    formatDetailedPosition(position) {
        if (position >= 1000) {
            return Math.round(position / 1000) + 'K';
        } else {
            return position.toString();
        }
    }

    createGCLegend() {
        const legend = document.createElement('div');
        legend.className = 'gc-legend';
        legend.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 6px 8px;
            font-size: 10px;
            line-height: 1.2;
            color: #495057;
            pointer-events: none;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        `;
        
        legend.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 2px;">
                <div style="width: 12px; height: 3px; background: #28a745; margin-right: 4px; border-radius: 1px;"></div>
                <span>GC Content</span>
            </div>
            <div style="display: flex; align-items: center;">
                <div style="width: 12px; height: 3px; background: linear-gradient(to right, #dc3545, #495057, #ffc107); margin-right: 4px; border-radius: 1px;"></div>
                <span>GC Skew</span>
            </div>
        `;
        
        return legend;
    }

    createWIGTrack(chromosome) {
        const { track, trackContent } = this.createTrackBase('wigTracks', chromosome);
        const viewport = this.getCurrentViewport();
        
        // Get WIG tracks data
        const wigTracks = this.genomeBrowser.currentWIGTracks || {};
        
        // Check if we have any WIG data at all
        if (!wigTracks || Object.keys(wigTracks).length === 0) {
            const noDataMsg = this.createNoDataMessage(
                'No WIG file loaded. Load a WIG file to see track data.',
                'no-wig-message'
            );
            trackContent.appendChild(noDataMsg);
            return track;
        }
        
        // Create WIG track management header
        const managementHeader = this.createWIGManagementHeader(wigTracks);
        trackContent.appendChild(managementHeader);
        
        // Create container for all WIG tracks
        const wigContainer = document.createElement('div');
        wigContainer.className = 'wig-tracks-container';
        wigContainer.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
        `;
        
        let trackOffset = 0;
        const trackHeight = 30;
        const trackSpacing = 5;
        
        // Render each WIG track
        Object.entries(wigTracks).forEach(([trackName, wigTrack], index) => {
            // Skip hidden tracks
            if (wigTrack.hidden) return;
            
            const trackData = wigTrack.data[chromosome] || [];
            
            // Filter data points in current viewport
            const visibleData = trackData.filter(point => 
                point.start <= viewport.end && point.end >= viewport.start
            );
            
            if (visibleData.length === 0) {
                // Create empty track placeholder
                const emptyTrack = document.createElement('div');
                emptyTrack.className = 'wig-track-empty';
                emptyTrack.style.cssText = `
                    position: absolute;
                    top: ${trackOffset}px;
                    left: 0;
                    right: 0;
                    height: ${trackHeight}px;
                    border: 1px solid #e0e0e0;
                    border-radius: 3px;
                    background: #f9f9f9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    color: #999;
                `;
                emptyTrack.textContent = `${trackName}: No data in this region`;
                wigContainer.appendChild(emptyTrack);
                trackOffset += trackHeight + trackSpacing;
                return;
            }
            
            // Calculate value range for scaling
            const values = visibleData.map(point => point.value);
            const minValue = Math.min(...values);
            const maxValue = Math.max(...values);
            const valueRange = maxValue - minValue;
            
            // Create track element
            const trackElement = document.createElement('div');
            trackElement.className = 'wig-track-data';
            trackElement.setAttribute('data-track-name', trackName);
            trackElement.style.cssText = `
                position: absolute;
                top: ${trackOffset}px;
                left: 0;
                right: 0;
                height: ${trackHeight}px;
                border: 1px solid #ccc;
                border-radius: 3px;
                background: white;
                overflow: hidden;
            `;
            
            // Create SVG for data visualization
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.style.cssText = `
                width: 100%;
                height: 100%;
                display: block;
            `;
            
            // Parse track color
            const trackColor = this.parseWIGColor(wigTrack.color);
            
            // Create data visualization
            if (visibleData.length > 0) {
                // Create area chart or bar chart based on data density
                const dataPointsPerPixel = visibleData.length / (trackElement.offsetWidth || 800);
                
                if (dataPointsPerPixel > 2) {
                    // High density - use area chart
                    this.createWIGAreaChart(svg, visibleData, viewport, minValue, maxValue, trackColor);
                } else {
                    // Low density - use bar chart
                    this.createWIGBarChart(svg, visibleData, viewport, minValue, maxValue, trackColor);
                }
            }
            
            // Add track label
            const label = document.createElement('div');
            label.className = 'wig-track-label';
            label.style.cssText = `
                position: absolute;
                top: 1px;
                left: 3px;
                font-size: 10px;
                font-weight: bold;
                color: #333;
                background: rgba(255,255,255,0.8);
                padding: 1px 3px;
                border-radius: 2px;
                pointer-events: none;
                z-index: 10;
            `;
            label.textContent = trackName;
            
            // Add value range indicator
            const rangeIndicator = document.createElement('div');
            rangeIndicator.className = 'wig-value-range';
            rangeIndicator.style.cssText = `
                position: absolute;
                top: 1px;
                right: 3px;
                font-size: 9px;
                color: #666;
                background: rgba(255,255,255,0.8);
                padding: 1px 3px;
                border-radius: 2px;
                pointer-events: none;
                z-index: 10;
            `;
            rangeIndicator.textContent = `${minValue.toFixed(2)} - ${maxValue.toFixed(2)}`;
            
            trackElement.appendChild(svg);
            trackElement.appendChild(label);
            trackElement.appendChild(rangeIndicator);
            
            // Add interaction
            this.addWIGTrackInteraction(trackElement, wigTrack, visibleData, trackName);
            
            wigContainer.appendChild(trackElement);
            trackOffset += trackHeight + trackSpacing;
        });
        
        // Update track content height based on number of visible tracks
        const visibleTracks = Object.values(wigTracks).filter(track => !track.hidden);
        const totalHeight = Math.max(100, trackOffset);
        trackContent.style.height = `${totalHeight + 40}px`; // Add space for management header
        
        trackContent.appendChild(wigContainer);
        
        // Add summary statistics
        const totalTracks = Object.keys(wigTracks).length;
        const visibleTracksCount = visibleTracks.length;
        const tracksWithData = visibleTracks.filter(track => 
            track.data[chromosome] && track.data[chromosome].length > 0
        ).length;
        
        const statsText = `${tracksWithData}/${visibleTracksCount} visible tracks with data (${totalTracks} total)`;
        const statsElement = this.createStatsElement(statsText, 'wig-track-stats');
        trackContent.appendChild(statsElement);
        
        // Restore header state if it was previously hidden
        this.restoreHeaderState(track, 'wigTracks');
        
        return track;
    }
    
    createWIGAreaChart(svg, data, viewport, minValue, maxValue, color) {
        const svgWidth = 800; // Default width, will be scaled by CSS
        const svgHeight = 30;
        const padding = 2;
        
        svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        
        // Create area path
        let pathData = `M 0,${svgHeight - padding}`;
        
        data.forEach((point, index) => {
            const x = ((point.start - viewport.start) / viewport.range) * svgWidth;
            const normalizedValue = (point.value - minValue) / (maxValue - minValue);
            const y = svgHeight - padding - (normalizedValue * (svgHeight - 2 * padding));
            
            if (index === 0) {
                pathData += ` L ${x},${y}`;
            } else {
                pathData += ` L ${x},${y}`;
            }
        });
        
        pathData += ` L ${svgWidth},${svgHeight - padding} Z`;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', color);
        path.setAttribute('fill-opacity', '0.6');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '0.5');
        
        svg.appendChild(path);
    }
    
    createWIGBarChart(svg, data, viewport, minValue, maxValue, color) {
        const svgWidth = 800;
        const svgHeight = 30;
        const padding = 2;
        
        svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        
        data.forEach(point => {
            const x = ((point.start - viewport.start) / viewport.range) * svgWidth;
            const width = Math.max(1, ((point.end - point.start) / viewport.range) * svgWidth);
            const normalizedValue = (point.value - minValue) / (maxValue - minValue);
            const height = normalizedValue * (svgHeight - 2 * padding);
            const y = svgHeight - padding - height;
            
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
            rect.setAttribute('fill', color);
            rect.setAttribute('stroke', 'none');
            
            svg.appendChild(rect);
        });
    }
    
    parseWIGColor(colorString) {
        // Parse WIG color format (R,G,B) to CSS color
        if (!colorString || colorString === '0,0,0') {
            return '#2196F3'; // Default blue
        }
        
        const parts = colorString.split(',');
        if (parts.length === 3) {
            const r = parseInt(parts[0]) || 0;
            const g = parseInt(parts[1]) || 0;
            const b = parseInt(parts[2]) || 0;
            return `rgb(${r},${g},${b})`;
        }
        
        return '#2196F3'; // Fallback to blue
    }
    
    addWIGTrackInteraction(trackElement, wigTrack, visibleData, trackName) {
        // Add tooltip on hover
        trackElement.addEventListener('mouseover', (e) => {
            const rect = trackElement.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const relativeX = x / rect.width;
            
            const viewport = this.getCurrentViewport();
            const genomicPosition = viewport.start + (relativeX * viewport.range);
            
            // Find closest data point
            const closestPoint = visibleData.reduce((closest, point) => {
                const pointCenter = (point.start + point.end) / 2;
                const currentDistance = Math.abs(genomicPosition - pointCenter);
                const closestDistance = Math.abs(genomicPosition - ((closest.start + closest.end) / 2));
                return currentDistance < closestDistance ? point : closest;
            });
            
            if (closestPoint) {
                const tooltip = document.createElement('div');
                tooltip.className = 'wig-tooltip';
                tooltip.style.cssText = `
                    position: fixed;
                    background: rgba(0,0,0,0.8);
                    color: white;
                    padding: 5px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    pointer-events: none;
                    z-index: 1000;
                    white-space: nowrap;
                `;
                tooltip.innerHTML = `
                    <div><strong>${trackName}</strong></div>
                    <div>Position: ${closestPoint.start.toLocaleString()}-${closestPoint.end.toLocaleString()}</div>
                    <div>Value: ${closestPoint.value.toFixed(3)}</div>
                `;
                tooltip.style.left = `${e.clientX + 10}px`;
                tooltip.style.top = `${e.clientY - 10}px`;
                
                document.body.appendChild(tooltip);
                
                trackElement._tooltip = tooltip;
            }
        });
        
        trackElement.addEventListener('mousemove', (e) => {
            if (trackElement._tooltip) {
                trackElement._tooltip.style.left = `${e.clientX + 10}px`;
                trackElement._tooltip.style.top = `${e.clientY - 10}px`;
            }
        });
        
        trackElement.addEventListener('mouseleave', () => {
            if (trackElement._tooltip) {
                document.body.removeChild(trackElement._tooltip);
                trackElement._tooltip = null;
            }
        });
    }

    createWIGManagementHeader(wigTracks) {
        const header = document.createElement('div');
        header.className = 'wig-management-header';
        header.style.cssText = `
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 10px;
            font-size: 12px;
        `;
        
        const title = document.createElement('div');
        title.style.cssText = `
            font-weight: bold;
            margin-bottom: 8px;
            color: #495057;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        title.innerHTML = `
            <span><i class="fas fa-chart-line"></i> WIG Track Management</span>
            <button class="clear-all-wig-btn" style="
                background: #dc3545;
                color: white;
                border: none;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                cursor: pointer;
            " title="Remove all WIG tracks">
                <i class="fas fa-trash"></i> Clear All
            </button>
        `;
        
        const tracksList = document.createElement('div');
        tracksList.className = 'wig-tracks-list';
        tracksList.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        `;
        
        Object.entries(wigTracks).forEach(([trackName, wigTrack]) => {
            const trackItem = document.createElement('div');
            trackItem.className = 'wig-track-item';
            trackItem.style.cssText = `
                display: flex;
                align-items: center;
                background: white;
                border: 1px solid #ced4da;
                border-radius: 3px;
                padding: 3px 6px;
                font-size: 11px;
                ${wigTrack.hidden ? 'opacity: 0.5;' : ''}
            `;
            
            const colorDot = document.createElement('div');
            colorDot.style.cssText = `
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${this.parseWIGColor(wigTrack.color)};
                margin-right: 4px;
                flex-shrink: 0;
            `;
            
            const trackNameSpan = document.createElement('span');
            trackNameSpan.textContent = trackName;
            trackNameSpan.style.cssText = `
                margin-right: 6px;
                max-width: 120px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            `;
            trackNameSpan.title = trackName; // Full name on hover
            
            const toggleBtn = document.createElement('button');
            toggleBtn.innerHTML = wigTrack.hidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
            toggleBtn.style.cssText = `
                background: none;
                border: none;
                color: #6c757d;
                cursor: pointer;
                padding: 1px 3px;
                margin-right: 3px;
                font-size: 10px;
            `;
            toggleBtn.title = wigTrack.hidden ? 'Show track' : 'Hide track';
            toggleBtn.addEventListener('click', () => this.toggleWIGTrack(trackName));
            
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.style.cssText = `
                background: none;
                border: none;
                color: #dc3545;
                cursor: pointer;
                padding: 1px 3px;
                font-size: 10px;
            `;
            removeBtn.title = 'Remove track';
            removeBtn.addEventListener('click', () => this.removeWIGTrack(trackName));
            
            trackItem.appendChild(colorDot);
            trackItem.appendChild(trackNameSpan);
            trackItem.appendChild(toggleBtn);
            trackItem.appendChild(removeBtn);
            tracksList.appendChild(trackItem);
        });
        
        // Add clear all functionality
        const clearAllBtn = title.querySelector('.clear-all-wig-btn');
        clearAllBtn.addEventListener('click', () => this.clearAllWIGTracks());
        
        header.appendChild(title);
        header.appendChild(tracksList);
        
        return header;
    }
    
    toggleWIGTrack(trackName) {
        const wigTracks = this.genomeBrowser.currentWIGTracks;
        if (wigTracks && wigTracks[trackName]) {
            wigTracks[trackName].hidden = !wigTracks[trackName].hidden;
            this.genomeBrowser.updateStatus(`${wigTracks[trackName].hidden ? 'Hidden' : 'Shown'} WIG track: ${trackName}`);
            this.refreshCurrentView();
        }
    }
    
    removeWIGTrack(trackName) {
        const wigTracks = this.genomeBrowser.currentWIGTracks;
        if (wigTracks && wigTracks[trackName]) {
            // Confirm removal
            if (confirm(`Remove WIG track "${trackName}"? This action cannot be undone.`)) {
                delete wigTracks[trackName];
                this.genomeBrowser.updateStatus(`Removed WIG track: ${trackName}`);
                this.refreshCurrentView();
            }
        }
    }
    
    clearAllWIGTracks() {
        const wigTracks = this.genomeBrowser.currentWIGTracks;
        if (wigTracks && Object.keys(wigTracks).length > 0) {
            const count = Object.keys(wigTracks).length;
            if (confirm(`Remove all ${count} WIG tracks? This action cannot be undone.`)) {
                this.genomeBrowser.currentWIGTracks = {};
                this.genomeBrowser.updateStatus(`Removed all ${count} WIG tracks`);
                this.refreshCurrentView();
            }
        }
    }
    
    refreshCurrentView() {
        // Refresh the current genome view to reflect changes
        console.log('refreshCurrentView called');
        const currentChr = document.getElementById('chromosomeSelect').value;
        console.log('Current chromosome:', currentChr);
        
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            console.log('Calling displayGenomeView to refresh tracks...');
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
        } else {
            console.warn('Cannot refresh view - missing chromosome or sequence data');
        }
    }

    // ============================================================================
    // TRACK BUTTON FUNCTIONALITY METHODS
    // ============================================================================
    
    /**
     * Open track-specific settings modal
     */
    openTrackSettings(trackType) {
        console.log(`Opening settings for track: ${trackType}`);
        
        // Create modal if it doesn't exist
        let modal = document.getElementById('trackSettingsModal');
        if (!modal) {
            modal = this.createTrackSettingsModal();
            document.body.appendChild(modal);
        }
        
        // Load track-specific settings
        this.loadTrackSpecificSettings(trackType, modal);
        
        // Show modal
        modal.classList.add('show');
    }
    
    /**
     * Toggle track controls (resize, reorder, close)
     */
    toggleTrackControls(trackType, button) {
        const isLocked = button.dataset.locked === 'true';
        const newLocked = !isLocked;
        
        button.dataset.locked = newLocked.toString();
        button.innerHTML = newLocked ? '<i class="fas fa-lock"></i>' : '<i class="fas fa-lock-open"></i>';
        button.title = newLocked ? 'Unlock Track Controls' : 'Lock Track Controls';
        
        // Find the track element
        const trackElement = button.closest('[class*="-track"]');
        if (trackElement) {
            if (newLocked) {
                trackElement.classList.add('controls-locked');
                // Disable dragging and resizing
                trackElement.draggable = false;
            } else {
                trackElement.classList.remove('controls-locked');
                // Enable dragging and resizing
                trackElement.draggable = true;
            }
        }
        
        console.log(`Track ${trackType} controls ${newLocked ? 'locked' : 'unlocked'}`);
    }
    
    /**
     * Toggle track header visibility
     */
    toggleTrackHeader(trackType, button) {
        console.log(`Toggling header for track: ${trackType}`);
        
        // Find the track element
        const trackElement = button.closest('[class*="-track"]');
        if (!trackElement) return;
        
        const trackHeader = trackElement.querySelector('.track-header');
        if (!trackHeader) return;
        
        const isHidden = trackHeader.style.display === 'none';
        
        if (isHidden) {
            // Show header
            trackHeader.style.display = '';
            button.innerHTML = '<i class="fas fa-minus"></i>';
            button.title = 'Hide Track Header';
            
            // Update state
            this.headerStates.set(trackType, false);
            
            // Adjust track content top position
            const trackContent = trackElement.querySelector('.track-content');
            if (trackContent) {
                trackContent.style.marginTop = '';
            }
        } else {
            // Hide header
            trackHeader.style.display = 'none';
            button.innerHTML = '<i class="fas fa-plus"></i>';
            button.title = 'Show Track Header';
            
            // Update state
            this.headerStates.set(trackType, true);
            
            // Add a small floating button to show header again
            this.createFloatingHeaderButton(trackElement, trackType);
            
            // Adjust track content to fill the space
            const trackContent = trackElement.querySelector('.track-content');
            if (trackContent) {
                trackContent.style.marginTop = '5px';
            }
        }
    }
    
    /**
     * Create floating button to restore hidden header
     */
    createFloatingHeaderButton(trackElement, trackType) {
        // Remove existing floating button if any
        const existingBtn = trackElement.querySelector('.floating-header-btn');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        const floatingBtn = document.createElement('button');
        floatingBtn.className = 'floating-header-btn';
        floatingBtn.innerHTML = '<i class="fas fa-plus"></i>';
        floatingBtn.title = 'Show Track Header';
        floatingBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            z-index: 100;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border: none;
            border-radius: 3px;
            width: 20px;
            height: 20px;
            font-size: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.6;
            transition: opacity 0.2s;
        `;
        
        floatingBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const trackHeader = trackElement.querySelector('.track-header');
            if (trackHeader) {
                trackHeader.style.display = '';
                
                // Update state
                this.headerStates.set(trackType, false);
                
                // Update the hide header button
                const hideHeaderBtn = trackHeader.querySelector('.track-hide-header-btn');
                if (hideHeaderBtn) {
                    hideHeaderBtn.innerHTML = '<i class="fas fa-minus"></i>';
                    hideHeaderBtn.title = 'Hide Track Header';
                }
                
                // Adjust track content
                const trackContent = trackElement.querySelector('.track-content');
                if (trackContent) {
                    trackContent.style.marginTop = '';
                }
            }
            floatingBtn.remove();
        });
        
        floatingBtn.addEventListener('mouseenter', () => {
            floatingBtn.style.opacity = '1';
        });
        
        floatingBtn.addEventListener('mouseleave', () => {
            floatingBtn.style.opacity = '0.6';
        });
        
        trackElement.appendChild(floatingBtn);
    }
    
    /**
     * Close/hide track
     */
    closeTrack(trackType) {
        console.log(`Closing track: ${trackType}`);
        
        // Map trackType to checkbox IDs
        const trackMapping = {
            'genes': 'trackGenes',
            'gc': 'trackGC', 
            'variants': 'trackVariants',
            'reads': 'trackReads',
            'proteins': 'trackProteins',
            'wigTracks': 'trackWIG',
            'sequence': 'trackSequence'
        };
        
        const checkboxId = trackMapping[trackType];
        if (checkboxId) {
            const checkbox = document.getElementById(checkboxId);
            const sidebarCheckbox = document.getElementById('sidebar' + checkboxId.charAt(0).toUpperCase() + checkboxId.slice(1));
            
            if (checkbox) {
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event('change'));
            }
            
            if (sidebarCheckbox) {
                sidebarCheckbox.checked = false;
                sidebarCheckbox.dispatchEvent(new Event('change'));
            }
        }
    }
    
    /**
     * Create track settings modal
     */
    createTrackSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'trackSettingsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="trackSettingsTitle">Track Settings</h3>
                    <button class="modal-close" id="closeTrackSettingsModal">&times;</button>
                </div>
                <div class="modal-body" id="trackSettingsBody">
                    <!-- Settings will be loaded here -->
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-close">Cancel</button>
                    <button class="btn btn-primary" id="applyTrackSettings">Apply</button>
                </div>
            </div>
        `;
        
        // Add event listeners
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-close')) {
                modal.classList.remove('show');
            }
        });
        
        modal.querySelector('#applyTrackSettings').addEventListener('click', () => {
            this.applyTrackSettings();
        });
        
        return modal;
    }
    
    /**
     * Load track-specific settings content
     */
    loadTrackSpecificSettings(trackType, modal) {
        const titleElement = modal.querySelector('#trackSettingsTitle');
        const bodyElement = modal.querySelector('#trackSettingsBody');
        
        // Get current settings for this track
        const currentSettings = this.getTrackSettings(trackType);
        
        switch (trackType) {
            case 'genes':
                titleElement.textContent = 'Genes & Features Track Settings';
                bodyElement.innerHTML = this.createGenesSettingsContent(currentSettings);
                break;
                
            case 'gc':
                titleElement.textContent = 'GC Content & Skew Track Settings';
                bodyElement.innerHTML = this.createGCSettingsContent(currentSettings);
                break;
                
            case 'reads':
                titleElement.textContent = 'Aligned Reads Track Settings';
                bodyElement.innerHTML = this.createReadsSettingsContent(currentSettings);
                break;
                
            default:
                titleElement.textContent = `${trackType} Track Settings`;
                bodyElement.innerHTML = this.createDefaultSettingsContent(trackType, currentSettings);
                break;
        }
        
        // Store current track type for applying settings
        modal.dataset.trackType = trackType;
    }
    
    /**
     * Create genes track settings content
     */
    createGenesSettingsContent(settings) {
        return `
            <div class="settings-section">
                <h4>Display Options</h4>
                <div class="form-group">
                    <label for="genesMaxRows">Maximal rows for displaying features:</label>
                    <input type="number" id="genesMaxRows" min="1" max="20" value="${settings.maxRows || 6}">
                    <div class="help-text">Limits the number of rows shown. Features beyond this limit will be hidden to reduce visual clutter.</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="genesShowOperonsSameRow" ${settings.showOperonsSameRow ? 'checked' : ''}>
                        Show operon genes in one row
                    </label>
                    <div class="help-text">When enabled, genes belonging to the same operon will be grouped together in the same row when possible.</div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Visual Settings</h4>
                <div class="form-group">
                    <label for="genesTrackHeight">Track Height (px):</label>
                    <input type="number" id="genesTrackHeight" min="60" max="400" value="${settings.height || 120}">
                </div>
                <div class="form-group">
                    <label for="genesGeneHeight">Gene Element Height (px):</label>
                    <input type="number" id="genesGeneHeight" min="12" max="40" value="${settings.geneHeight || 23}">
                    <div class="help-text">Height of individual gene elements. Affects spacing between gene rows.</div>
                </div>
                <div class="form-group">
                    <label for="genesFontSize">Gene Name Font Size (px):</label>
                    <input type="number" id="genesFontSize" min="8" max="16" value="${settings.fontSize || 11}">
                    <div class="help-text">Font size for gene names and labels.</div>
                </div>
                <div class="form-group">
                    <label for="genesFontFamily">Gene Name Font Family:</label>
                    <select id="genesFontFamily">
                        <option value="Arial, sans-serif" ${(settings.fontFamily || 'Arial, sans-serif') === 'Arial, sans-serif' ? 'selected' : ''}>Arial</option>
                        <option value="Inter, sans-serif" ${(settings.fontFamily || 'Arial, sans-serif') === 'Inter, sans-serif' ? 'selected' : ''}>Inter</option>
                        <option value="Helvetica, sans-serif" ${(settings.fontFamily || 'Arial, sans-serif') === 'Helvetica, sans-serif' ? 'selected' : ''}>Helvetica</option>
                        <option value="monospace" ${(settings.fontFamily || 'Arial, sans-serif') === 'monospace' ? 'selected' : ''}>Monospace</option>
                        <option value="Georgia, serif" ${(settings.fontFamily || 'Arial, sans-serif') === 'Georgia, serif' ? 'selected' : ''}>Georgia</option>
                    </select>
                </div>
            </div>
        `;
    }
    
    /**
     * Create GC track settings content
     */
    createGCSettingsContent(settings) {
        return `
            <div class="settings-section">
                <h4>Colors & Styles</h4>
                <div class="form-group">
                    <label for="gcContentColor">GC Content Color:</label>
                    <input type="color" id="gcContentColor" value="${settings.contentColor || '#3b82f6'}">
                </div>
                <div class="form-group">
                    <label for="gcSkewPositiveColor">GC Skew Positive Color:</label>
                    <input type="color" id="gcSkewPositiveColor" value="${settings.skewPositiveColor || '#10b981'}">
                </div>
                <div class="form-group">
                    <label for="gcSkewNegativeColor">GC Skew Negative Color:</label>
                    <input type="color" id="gcSkewNegativeColor" value="${settings.skewNegativeColor || '#ef4444'}">
                </div>
                <div class="form-group">
                    <label for="gcLineWidth">Line Width:</label>
                    <input type="number" id="gcLineWidth" min="1" max="5" step="0.5" value="${settings.lineWidth || 2}">
                </div>
                <div class="form-group">
                    <label for="gcTrackHeight">Track Height (px):</label>
                    <input type="number" id="gcTrackHeight" min="80" max="300" value="${settings.height || 140}">
                </div>
            </div>
        `;
    }
    
    /**
     * Create reads track settings content
     */
    createReadsSettingsContent(settings) {
        return `
            <div class="settings-section">
                <h4>Read Display</h4>
                <div class="form-group">
                    <label for="readsHeight">Height of each read (px):</label>
                    <input type="number" id="readsHeight" min="5" max="30" value="${settings.readHeight || 14}">
                </div>
                <div class="form-group">
                    <label for="readsSpacing">Spacing between reads (px):</label>
                    <input type="number" id="readsSpacing" min="1" max="10" value="${settings.readSpacing || 2}">
                </div>
            </div>
            <div class="settings-section">
                <h4>Colors & Styles</h4>
                <div class="form-group">
                    <label for="readsForwardColor">Forward reads color:</label>
                    <input type="color" id="readsForwardColor" value="${settings.forwardColor || '#3b82f6'}">
                </div>
                <div class="form-group">
                    <label for="readsReverseColor">Reverse reads color:</label>
                    <input type="color" id="readsReverseColor" value="${settings.reverseColor || '#ef4444'}">
                </div>
                <div class="form-group">
                    <label for="readsPairedColor">Paired reads color:</label>
                    <input type="color" id="readsPairedColor" value="${settings.pairedColor || '#10b981'}">
                </div>
                <div class="form-group">
                    <label for="readsTrackHeight">Track Height (px):</label>
                    <input type="number" id="readsTrackHeight" min="100" max="500" value="${settings.height || 150}">
                </div>
            </div>
        `;
    }
    
    /**
     * Create default settings content for other tracks
     */
    createDefaultSettingsContent(trackType, settings) {
        return `
            <div class="settings-section">
                <h4>Basic Settings</h4>
                <div class="form-group">
                    <label for="defaultTrackHeight">Track Height (px):</label>
                    <input type="number" id="defaultTrackHeight" min="50" max="300" value="${settings.height || 80}">
                </div>
                <p>More settings for ${trackType} track can be added here.</p>
            </div>
        `;
    }
    
    /**
     * Get current settings for a track
     */
    getTrackSettings(trackType) {
        // Get settings from ConfigManager or default values
        const defaultSettings = {
            genes: {
                maxRows: 6,
                showOperonsSameRow: false,
                height: 120,
                geneHeight: 23,
                fontSize: 11,
                fontFamily: 'Arial, sans-serif'
            },
            gc: {
                contentColor: '#3b82f6',
                skewPositiveColor: '#10b981',
                skewNegativeColor: '#ef4444',
                lineWidth: 2,
                height: 140
            },
            reads: {
                readHeight: 14,
                readSpacing: 2,
                forwardColor: '#3b82f6',
                reverseColor: '#ef4444',
                pairedColor: '#10b981',
                height: 150
            }
        };
        
        // Try to get saved settings
        let savedSettings = {};
        if (this.genomeBrowser.configManager) {
            savedSettings = this.genomeBrowser.configManager.get(`tracks.${trackType}.settings`) || {};
            console.log(`ConfigManager retrieved settings for ${trackType}:`, savedSettings);
        } else {
            const stored = localStorage.getItem(`trackSettings_${trackType}`);
            console.log(`LocalStorage raw data for trackSettings_${trackType}:`, stored);
            if (stored) {
                try {
                    savedSettings = JSON.parse(stored);
                    console.log(`LocalStorage parsed settings for ${trackType}:`, savedSettings);
                } catch (e) {
                    console.warn('Failed to parse saved track settings:', e);
                }
            }
        }
        
        const finalSettings = { ...defaultSettings[trackType] || {}, ...savedSettings };
        console.log(`Final merged settings for ${trackType}:`, finalSettings);
        return finalSettings;
    }
    
    /**
     * Apply track settings
     */
    applyTrackSettings() {
        console.log('applyTrackSettings called');
        const modal = document.getElementById('trackSettingsModal');
        const trackType = modal.dataset.trackType;
        
        console.log('Track type:', trackType);
        if (!trackType) return;
        
        const settings = this.collectSettingsFromModal(trackType, modal);
        console.log('Collected settings:', settings);
        
        this.saveTrackSettings(trackType, settings);
        
        // Apply settings immediately
        this.applySettingsToTrack(trackType, settings);
        
        // Close modal
        modal.classList.remove('show');
        
        // Refresh the current view
        console.log('About to call refreshCurrentView...');
        this.refreshCurrentView();
    }
    
    /**
     * Collect settings from modal inputs
     */
    collectSettingsFromModal(trackType, modal) {
        const settings = {};
        
        switch (trackType) {
            case 'genes':
                const maxRowsElement = modal.querySelector('#genesMaxRows');
                const showOperonsElement = modal.querySelector('#genesShowOperonsSameRow');
                const heightElement = modal.querySelector('#genesTrackHeight');
                const geneHeightElement = modal.querySelector('#genesGeneHeight');
                const fontSizeElement = modal.querySelector('#genesFontSize');
                const fontFamilyElement = modal.querySelector('#genesFontFamily');
                
                console.log('Form elements found:', {
                    maxRowsElement: !!maxRowsElement,
                    showOperonsElement: !!showOperonsElement,
                    heightElement: !!heightElement,
                    geneHeightElement: !!geneHeightElement,
                    fontSizeElement: !!fontSizeElement,
                    fontFamilyElement: !!fontFamilyElement
                });
                
                settings.maxRows = parseInt(maxRowsElement?.value) || 6;
                settings.showOperonsSameRow = showOperonsElement?.checked || false;
                settings.height = parseInt(heightElement?.value) || 120;
                settings.geneHeight = parseInt(geneHeightElement?.value) || 23;
                settings.fontSize = parseInt(fontSizeElement?.value) || 11;
                settings.fontFamily = fontFamilyElement?.value || 'Arial, sans-serif';
                
                console.log('Collected gene settings from form:', settings);
                break;
                
            case 'gc':
                settings.contentColor = modal.querySelector('#gcContentColor').value;
                settings.skewPositiveColor = modal.querySelector('#gcSkewPositiveColor').value;
                settings.skewNegativeColor = modal.querySelector('#gcSkewNegativeColor').value;
                settings.lineWidth = parseFloat(modal.querySelector('#gcLineWidth').value) || 2;
                settings.height = parseInt(modal.querySelector('#gcTrackHeight').value) || 140;
                break;
                
            case 'reads':
                settings.readHeight = parseInt(modal.querySelector('#readsHeight').value) || 14;
                settings.readSpacing = parseInt(modal.querySelector('#readsSpacing').value) || 2;
                settings.forwardColor = modal.querySelector('#readsForwardColor').value;
                settings.reverseColor = modal.querySelector('#readsReverseColor').value;
                settings.pairedColor = modal.querySelector('#readsPairedColor').value;
                settings.height = parseInt(modal.querySelector('#readsTrackHeight').value) || 150;
                break;
                
            default:
                settings.height = parseInt(modal.querySelector('#defaultTrackHeight').value) || 80;
                break;
        }
        
        return settings;
    }
    
    /**
     * Save track settings
     */
    saveTrackSettings(trackType, settings) {
        if (this.genomeBrowser.configManager) {
            this.genomeBrowser.configManager.set(`tracks.${trackType}.settings`, settings);
            this.genomeBrowser.configManager.saveConfig();
        } else {
            localStorage.setItem(`trackSettings_${trackType}`, JSON.stringify(settings));
        }
        
        console.log(`Saved settings for ${trackType}:`, settings);
    }
    
    /**
     * Apply settings to track immediately
     */
    applySettingsToTrack(trackType, settings) {
        console.log(`applySettingsToTrack called for ${trackType} with settings:`, settings);
        
        // Store settings for use during rendering
        if (!this.trackSettings) {
            this.trackSettings = {};
        }
        this.trackSettings[trackType] = settings;
        
        // Find the track element
        const trackElement = document.querySelector(`.${trackType}-track`);
        if (trackElement) {
            const trackContent = trackElement.querySelector('.track-content');
            if (trackContent) {
                // Adjust height immediately if applicable
                if (settings.height) {
                    trackContent.style.height = `${settings.height}px`;
                }
                
                // For gene track, re-render elements to apply all settings including height and font
                if (trackType === 'genes') {
                    console.log('Re-rendering gene elements due to settings change...', settings);
                    // Clear existing gene elements before re-rendering
                    const geneElements = trackContent.querySelectorAll('.gene-element, .no-genes-message, .gene-stats, .detailed-ruler-container');
                    geneElements.forEach(el => el.remove());
                    
                    // Re-add detailed ruler
                    const currentChr = document.getElementById('chromosomeSelect').value;
                    const detailedRuler = this.createDetailedRuler(currentChr);
                    trackContent.appendChild(detailedRuler);
                    
                    // Re-fetch data and re-render with new settings
                    const viewport = this.getCurrentViewport();
                    const annotations = this.genomeBrowser.currentAnnotations[currentChr] || [];
                    const operons = this.genomeBrowser.detectOperons(annotations);
                    const visibleGenes = this.filterGeneAnnotations(annotations, viewport);
                    
                    if (visibleGenes.length > 0) {
                        // Re-render with updated settings
                        this.renderGeneElements(trackContent, visibleGenes, viewport, operons, settings);
                        this.addGeneTrackStatistics(trackContent, visibleGenes, operons, settings);
                        
                        // Update track height based on new gene heights
                        const geneRows = this.arrangeGenesInRows(visibleGenes, viewport.start, viewport.end, operons, settings);
                        const layout = this.calculateGeneTrackLayout(geneRows, settings);
                        trackContent.style.height = `${Math.max(layout.totalHeight, 120)}px`;
                    } else {
                        const noGenesMsg = this.createNoDataMessage(
                            'No genes/features in this region or all filtered out',
                            'no-genes-message'
                        );
                        trackContent.appendChild(noGenesMsg);
                    }
                }
            }
        } else {
            console.warn(`Track element not found for ${trackType}`);
        }
        
        // Ensure the entire view is refreshed to reflect layout changes
        console.log('Calling refreshCurrentView after applying settings to track...');
        this.refreshCurrentView(); 
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackRenderer;
} 