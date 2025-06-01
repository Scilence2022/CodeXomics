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
            }
        };
        
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
        
        const trackHeader = this.createTrackHeader(config.header);
        track.appendChild(trackHeader);
        
        const trackContent = this.createTrackContent(config.defaultHeight, chromosome);
        track.appendChild(trackContent);
        
        return { track, trackContent, config };
    }
    
    /**
     * Create standardized track header
     */
    createTrackHeader(title) {
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = title;
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
        
        // Process and render genes
        this.renderGeneElements(trackContent, visibleGenes, viewport, operons);
        
        // Add statistics and update sidebar
        this.addGeneTrackStatistics(trackContent, visibleGenes, operons);
        
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
    renderGeneElements(trackContent, visibleGenes, viewport, operons) {
        const geneRows = this.arrangeGenesInRows(visibleGenes, viewport.start, viewport.end);
        const layout = this.calculateGeneTrackLayout(geneRows);
        
        // Set calculated height
        trackContent.style.height = `${Math.max(layout.totalHeight, 120)}px`;
        
        // Create gene elements
        geneRows.forEach((rowGenes, rowIndex) => {
            rowGenes.forEach((gene) => {
                const geneElement = this.createGeneElement(gene, viewport, operons, rowIndex, layout);
                trackContent.appendChild(geneElement);
            });
        });
    }
    
    /**
     * Calculate layout parameters for gene track
     */
    calculateGeneTrackLayout(geneRows) {
        const geneHeight = 23;
        const rowSpacing = 6;
        const rulerHeight = 35;
        const topPadding = 10;
        const bottomPadding = 0;
        
        return {
            geneHeight,
            rowSpacing,
            rulerHeight,
            topPadding,
            bottomPadding,
            totalHeight: rulerHeight + topPadding + (geneRows.length * (geneHeight + rowSpacing)) - rowSpacing + bottomPadding
        };
    }
    
    /**
     * Create individual gene element with improved structure
     */
    createGeneElement(gene, viewport, operons, rowIndex, layout) {
        const geneElement = document.createElement('div');
        
        // Configure element class and style
        this.configureGeneElementAppearance(geneElement, gene, viewport, operons);
        
        // Set position
        this.setGeneElementPosition(geneElement, gene, viewport, rowIndex, layout);
        
        // Add interaction handlers
        this.addGeneElementHandlers(geneElement, gene, operons);
        
        return geneElement;
    }
    
    /**
     * Configure gene element appearance and styling
     */
    configureGeneElementAppearance(geneElement, gene, viewport, operons) {
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
    setGeneElementPosition(geneElement, gene, viewport, rowIndex, layout) {
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
        
        // Position based on row arrangement
        geneElement.style.top = `${layout.rulerHeight + layout.topPadding + rowIndex * (layout.geneHeight + layout.rowSpacing)}px`;
        
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
    addGeneTrackStatistics(trackContent, visibleGenes, operons) {
        const geneRows = this.arrangeGenesInRows(visibleGenes, this.getCurrentViewport().start, this.getCurrentViewport().end);
        const layout = this.calculateGeneTrackLayout(geneRows);
        
        // Add gene statistics
        const statsText = `${visibleGenes.length} features in ${geneRows.length} rows`;
        const statsElement = this.createStatsElement(statsText, 'gene-stats', `top: ${layout.rulerHeight + 5}px;`);
        trackContent.appendChild(statsElement);
        
        // Update sidebar operons panel
        const visibleOperons = new Set();
        visibleGenes.forEach(gene => {
            const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);
            if (operonInfo.isInOperon) {
                visibleOperons.add(operonInfo.operonName);
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
        // Call the main genome browser's gene selection methods
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
    arrangeGenesInRows(genes, viewStart, viewEnd) {
        // Sort genes by start position
        const sortedGenes = [...genes].sort((a, b) => a.start - b.start);
        const rows = [];
        
        sortedGenes.forEach(gene => {
            let placed = false;
            
            // Try to place gene in existing rows
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
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
            
            // If couldn't place in existing row, create new row
            if (!placed) {
                rows.push([gene]);
            }
        });
        
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackRenderer;
} 