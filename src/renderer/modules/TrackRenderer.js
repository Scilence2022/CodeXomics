/**
 * TrackRenderer - Handles all track creation and visualization
 */
class TrackRenderer {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
    }

    createGeneTrack(chromosome) {
        const track = document.createElement('div');
        track.className = 'gene-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'Genes & Features';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        
        // Add detailed ruler for current viewing region
        const detailedRuler = this.createDetailedRuler(chromosome);
        trackContent.appendChild(detailedRuler);
        
        // Add draggable functionality
        this.genomeBrowser.makeDraggable(trackContent, chromosome);
        
        const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const range = end - start;
        
        // Detect operons for color assignment
        const operons = this.genomeBrowser.detectOperons(annotations);
        console.log(`Detected ${operons.length} operons in chromosome ${chromosome}`);
        
        // Include all relevant gene types and features, filtered by user preferences
        const visibleGenes = annotations.filter(feature => {
            const validTypes = ['gene', 'CDS', 'mRNA', 'tRNA', 'rRNA', 'misc_feature', 
                              'regulatory', 'promoter', 'terminator', 'repeat_region'];
            return (validTypes.includes(feature.type) || feature.type.includes('RNA')) &&
                   this.genomeBrowser.shouldShowGeneType(feature.type);
        }).filter(gene => 
            gene.start && gene.end && 
            gene.start <= end && gene.end >= start
        );
        
        console.log(`Displaying ${visibleGenes.length} genes/features in region ${start}-${end}`);
        
        if (visibleGenes.length === 0) {
            const noGenesMsg = document.createElement('div');
            noGenesMsg.className = 'no-genes-message';
            noGenesMsg.textContent = 'No genes/features in this region or all filtered out';
            noGenesMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `;
            trackContent.appendChild(noGenesMsg);
            trackContent.style.height = '80px'; // Default height for empty track
            track.appendChild(trackContent);
            return track;
        }
        
        // Arrange genes into rows by type to prevent overlapping
        const geneRows = this.arrangeGenesInRows(visibleGenes, start, end);
        
        // Calculate adaptive track height based on gene arrangement
        const geneHeight = 23; // Height of each gene element
        const rowSpacing = 6; // Space between rows
        const rulerHeight = 35; // Height of the detailed ruler
        const topPadding = 10; // Top padding below ruler
        const bottomPadding = 0; // Bottom padding
        
        const trackHeight = rulerHeight + topPadding + (geneRows.length * (geneHeight + rowSpacing)) - rowSpacing + bottomPadding;
        trackContent.style.height = `${Math.max(trackHeight, 120)}px`; // Minimum 120px height to account for ruler
        
        // Create gene elements
        geneRows.forEach((rowGenes, rowIndex) => {
            rowGenes.forEach((gene) => {
                const geneElement = document.createElement('div');
                
                // Normalize gene type for CSS class
                let geneType = gene.type.toLowerCase();
                if (geneType.includes('rna') && !['mrna', 'trna', 'rrna'].includes(geneType)) {
                    geneType = 'misc_feature';
                }
                
                geneElement.className = `gene-element ${geneType}`;
                
                const geneStart = Math.max(gene.start, start);
                const geneEnd = Math.min(gene.end, end);
                const left = ((geneStart - start) / range) * 100;
                const width = ((geneEnd - geneStart) / range) * 100;
                
                geneElement.style.left = `${left}%`;
                geneElement.style.width = `${Math.max(width, 0.3)}%`;
                
                // Ensure minimum visibility
                if (width < 0.5) {
                    geneElement.style.minWidth = '8px';
                }
                
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
                
                // Position based on row arrangement instead of fixed type positions
                geneElement.style.top = `${rulerHeight + topPadding + rowIndex * (geneHeight + rowSpacing)}px`;
                
                if (gene.strand === -1) {
                    geneElement.classList.add('reverse-strand');
                }
                
                // Create comprehensive gene label
                const geneName = gene.qualifiers.gene || gene.qualifiers.locus_tag || gene.qualifiers.product || gene.type;
                const geneInfo = `${geneName} (${gene.type})`;
                const positionInfo = `${gene.start}-${gene.end} (${gene.strand === -1 ? '-' : '+'} strand)`;
                const operonInfo_display = operonInfo.isInOperon ? `\nOperon: ${operonInfo.operonName}` : '\nSingle gene';
                const rowInfo = `\nRow: ${rowIndex + 1}`;
                
                geneElement.title = `${geneInfo}\nPosition: ${positionInfo}${operonInfo_display}${rowInfo}`;
                
                // Set text content based on available space
                if (width > 2) {
                    geneElement.textContent = geneName.length > 12 ? geneName.substring(0, 12) + '...' : geneName;
                } else if (width > 0.8) {
                    geneElement.textContent = geneName.substring(0, 3);
                } else {
                    geneElement.textContent = '';
                }
                
                // Add click handler for detailed info
                geneElement.addEventListener('click', () => {
                    this.showGeneDetails(gene, operonInfo);
                });
                
                // Check if this gene should be selected (maintain selection state)
                if (this.genomeBrowser.selectedGene && this.genomeBrowser.selectedGene.gene && 
                    this.genomeBrowser.selectedGene.gene.start === gene.start && 
                    this.genomeBrowser.selectedGene.gene.end === gene.end &&
                    this.genomeBrowser.selectedGene.gene.type === gene.type) {
                    geneElement.classList.add('selected');
                }
                
                trackContent.appendChild(geneElement);
            });
        });
        
        // Add gene statistics
        const statsElement = document.createElement('div');
        statsElement.className = 'gene-stats';
        statsElement.style.cssText = `
            position: absolute;
            top: ${rulerHeight + 5}px;
            right: 10px;
            background: rgba(255,255,255,0.9);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            color: #666;
            border: 1px solid #ddd;
        `;
        statsElement.textContent = `${visibleGenes.length} features in ${geneRows.length} rows`;
        trackContent.appendChild(statsElement);
        
        // Update sidebar operons panel
        const visibleOperons = new Set();
        visibleGenes.forEach(gene => {
            const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);
            if (operonInfo.isInOperon) {
                visibleOperons.add(operonInfo.operonName);
            }
        });
        
        // Update sidebar operons panel instead of adding legend to track
        this.updateOperonsPanel(operons, visibleOperons);
        
        track.appendChild(trackContent);
        return track;
    }

    createSequenceTrack(chromosome, sequence) {
        const track = document.createElement('div');
        track.className = 'sequence-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'Sequence';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content sequence-visualization';
        
        // Add draggable functionality
        this.genomeBrowser.makeDraggable(trackContent, chromosome);
        
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const subsequence = sequence.substring(start, end);
        const range = end - start;
        
        // Create single-line sequence display with dynamic sizing
        const seqDisplay = document.createElement('div');
        seqDisplay.className = 'sequence-single-line';
        seqDisplay.style.position = 'relative';
        seqDisplay.style.height = '30px';
        seqDisplay.style.overflow = 'hidden';
        seqDisplay.style.display = 'flex';
        seqDisplay.style.alignItems = 'center';
        
        // Calculate font size based on available space and sequence length
        const containerWidth = trackContent.offsetWidth || 800; // fallback width
        const maxFontSize = 16;
        const minFontSize = 4;
        const calculatedFontSize = Math.max(minFontSize, Math.min(maxFontSize, containerWidth / range * 0.8));
        
        // Create sequence bases with dynamic positioning
        for (let i = 0; i < subsequence.length; i++) {
            const base = subsequence[i];
            const baseElement = document.createElement('span');
            baseElement.className = `base-${base.toLowerCase()} sequence-base-inline`;
            baseElement.textContent = base;
            baseElement.style.position = 'absolute';
            baseElement.style.left = `${(i / range) * 100}%`;
            baseElement.style.fontSize = `${calculatedFontSize}px`;
            baseElement.style.fontFamily = 'monospace';
            baseElement.style.fontWeight = 'bold';
            baseElement.style.textAlign = 'center';
            baseElement.style.lineHeight = '30px';
            
            // Add tooltip with position info
            const position = start + i + 1;
            baseElement.title = `Position: ${position}, Base: ${base}`;
            
            seqDisplay.appendChild(baseElement);
        }
        
        trackContent.appendChild(seqDisplay);
        track.appendChild(trackContent);
        return track;
    }

    createGCTrack(chromosome, sequence) {
        const track = document.createElement('div');
        track.className = 'gc-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'GC Content & Skew';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        trackContent.style.height = '120px'; // Increased height for dual display
        
        // Add draggable functionality
        this.genomeBrowser.makeDraggable(trackContent, chromosome);
        
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const subsequence = sequence.substring(start, end);
        
        // Create enhanced GC content and skew visualization
        const gcDisplay = this.createEnhancedGCVisualization(subsequence, start, end);
        trackContent.appendChild(gcDisplay);
        
        track.appendChild(trackContent);
        return track;
    }

    createVariantTrack(chromosome) {
        const track = document.createElement('div');
        track.className = 'variant-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'VCF Variants';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        trackContent.style.height = '60px';
        
        // Add draggable functionality
        this.genomeBrowser.makeDraggable(trackContent, chromosome);
        
        const variants = this.genomeBrowser.currentVariants[chromosome] || [];
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const range = end - start;
        
        // Check if we have any variant data at all
        if (!this.genomeBrowser.currentVariants || Object.keys(this.genomeBrowser.currentVariants).length === 0) {
            const noDataMsg = document.createElement('div');
            noDataMsg.className = 'no-variants-message';
            noDataMsg.textContent = 'No VCF file loaded. Load a VCF file to see variants.';
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
            track.appendChild(trackContent);
            return track;
        }
        
        // Filter for variants in the current region
        const visibleVariants = variants.filter(variant => 
            variant.start && variant.end && 
            variant.start <= end && variant.end >= start
        );
        
        console.log(`Displaying ${visibleVariants.length} variants in region ${start}-${end}`);
        
        visibleVariants.forEach((variant, index) => {
            const variantElement = document.createElement('div');
            variantElement.className = 'variant-element';
            
            const variantStart = Math.max(variant.start, start);
            const variantEnd = Math.min(variant.end, end);
            const left = ((variantStart - start) / range) * 100;
            const width = Math.max(((variantEnd - variantStart) / range) * 100, 0.2);
            
            variantElement.style.left = `${left}%`;
            variantElement.style.width = `${width}%`;
            variantElement.style.height = '12px';
            variantElement.style.top = '20px';
            variantElement.style.position = 'absolute';
            variantElement.style.background = '#e74c3c';
            variantElement.style.borderRadius = '2px';
            variantElement.style.cursor = 'pointer';
            
            // Create variant tooltip
            const variantInfo = `Variant: ${variant.id || 'Unknown'}\n` +
                              `Position: ${variant.start}-${variant.end}\n` +
                              `Ref: ${variant.ref || 'N/A'}\n` +
                              `Alt: ${variant.alt || 'N/A'}\n` +
                              `Quality: ${variant.quality || 'N/A'}`;
            
            variantElement.title = variantInfo;
            
            // Add click handler for detailed info
            variantElement.addEventListener('click', () => {
                alert(variantInfo);
            });
            
            trackContent.appendChild(variantElement);
        });
        
        // Add message if no variants found in this region
        if (visibleVariants.length === 0) {
            const noVariantsMsg = document.createElement('div');
            noVariantsMsg.className = 'no-variants-message';
            noVariantsMsg.textContent = 'No variants in this region';
            noVariantsMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `;
            trackContent.appendChild(noVariantsMsg);
        }
        
        track.appendChild(trackContent);
        return track;
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
        const track = document.createElement('div');
        track.className = 'protein-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'Proteins';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        trackContent.style.height = '80px';
        
        // Add draggable functionality
        this.genomeBrowser.makeDraggable(trackContent, chromosome);
        
        const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const range = end - start;
        
        // Filter for CDS features that can be translated to proteins
        const proteins = annotations.filter(feature => 
            feature.type === 'CDS' &&
            feature.start && feature.end && 
            feature.start <= end && feature.end >= start &&
            this.genomeBrowser.shouldShowGeneType('CDS')
        );
        
        console.log(`Displaying ${proteins.length} proteins in region ${start}-${end}`);
        
        proteins.forEach((protein, index) => {
            const proteinElement = document.createElement('div');
            proteinElement.className = 'protein-element';
            
            const proteinStart = Math.max(protein.start, start);
            const proteinEnd = Math.min(protein.end, end);
            const left = ((proteinStart - start) / range) * 100;
            const width = Math.max(((proteinEnd - proteinStart) / range) * 100, 0.3);
            
            proteinElement.style.left = `${left}%`;
            proteinElement.style.width = `${Math.max(width, 0.3)}%`;
            
            if (protein.strand === -1) {
                proteinElement.classList.add('reverse-strand');
            }
            
            // Create protein label
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
            
            // Add click handler for detailed info
            proteinElement.addEventListener('click', () => {
                this.showProteinDetails(protein, chromosome);
            });
            
            trackContent.appendChild(proteinElement);
        });
        
        // Add message if no proteins found
        if (proteins.length === 0) {
            const noProteinsMsg = document.createElement('div');
            noProteinsMsg.className = 'no-proteins-message';
            noProteinsMsg.textContent = 'No proteins in this region or CDS filtered out';
            noProteinsMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `;
            trackContent.appendChild(noProteinsMsg);
        }
        
        track.appendChild(trackContent);
        return track;
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
        
        // Create canvas for smooth visualization
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set up canvas dimensions
        const containerWidth = 800; // Will be adjusted dynamically
        const containerHeight = 100;
        canvas.width = containerWidth;
        canvas.height = containerHeight;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        
        // Calculate window size based on sequence length and zoom level
        const baseWindowSize = Math.max(20, Math.floor(sequence.length / 200));
        const windowSize = Math.min(baseWindowSize, 1000);
        const stepSize = Math.max(1, Math.floor(windowSize / 4));
        
        console.log(`GC analysis: sequence length=${sequence.length}, windowSize=${windowSize}, stepSize=${stepSize}`);
        
        // Calculate GC content and skew data
        const gcData = [];
        const skewData = [];
        const positions = [];
        
        for (let i = 0; i <= sequence.length - windowSize; i += stepSize) {
            const window = sequence.substring(i, i + windowSize);
            const gcAnalysis = this.analyzeGCWindow(window);
            
            gcData.push(gcAnalysis.gcPercent);
            skewData.push(gcAnalysis.gcSkew);
            positions.push(i + windowSize / 2); // Center position of window
        }
        
        if (gcData.length === 0) {
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
        
        // Find min/max values for scaling
        const gcMin = Math.min(...gcData);
        const gcMax = Math.max(...gcData);
        const skewMin = Math.min(...skewData);
        const skewMax = Math.max(...skewData);
        
        // Draw the visualization
        this.drawGCVisualization(ctx, containerWidth, containerHeight, {
            gcData,
            skewData,
            positions,
            gcMin,
            gcMax,
            skewMin,
            skewMax,
            sequenceLength: sequence.length
        });
        
        // Add legend
        const legend = this.createGCLegend();
        container.appendChild(legend);
        
        container.appendChild(canvas);
        
        // Add interactive tooltip functionality after canvas is appended
        this.addGCTooltipInteraction(canvas, container, {
            gcData,
            skewData,
            positions,
            windowSize,
            viewStart,
            viewEnd
        });
        
        return container;
    }
    
    analyzeGCWindow(window) {
        const bases = window.toUpperCase();
        const gCount = (bases.match(/G/g) || []).length;
        const cCount = (bases.match(/C/g) || []).length;
        const aCount = (bases.match(/A/g) || []).length;
        const tCount = (bases.match(/T/g) || []).length;
        const totalValidBases = gCount + cCount + aCount + tCount;
        
        if (totalValidBases === 0) {
            return { gcPercent: 0, gcSkew: 0, gCount, cCount };
        }
        
        const gcPercent = ((gCount + cCount) / totalValidBases) * 100;
        const gcSkew = (gCount + cCount) > 0 ? (gCount - cCount) / (gCount + cCount) : 0;
        
        return { gcPercent, gcSkew, gCount, cCount };
    }
    
    drawGCVisualization(ctx, width, height, data) {
        const { gcData, skewData, positions, gcMin, gcMax, skewMin, skewMax, sequenceLength } = data;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Set up coordinate system
        const padding = 10;
        const plotWidth = width - 2 * padding;
        const plotHeight = height - 2 * padding;
        const centerY = height / 2;
        
        // Draw background grid
        this.drawGCGrid(ctx, padding, plotWidth, plotHeight, centerY);
        
        // Draw GC content (upper half)
        this.drawGCContent(ctx, gcData, positions, sequenceLength, padding, plotWidth, centerY - padding, gcMin, gcMax);
        
        // Draw GC skew (lower half)
        this.drawGCSkew(ctx, skewData, positions, sequenceLength, padding, plotWidth, centerY + padding, plotHeight - padding, skewMin, skewMax);
        
        // Draw axis labels
        this.drawGCAxisLabels(ctx, width, height, gcMin, gcMax, skewMin, skewMax);
    }
    
    drawGCGrid(ctx, padding, plotWidth, plotHeight, centerY) {
        ctx.strokeStyle = '#e9ecef';
        ctx.lineWidth = 0.5;
        
        // Horizontal grid lines
        const gridLines = [0.25, 0.5, 0.75]; // 25%, 50%, 75% positions
        gridLines.forEach(ratio => {
            const y1 = padding + ratio * (centerY - padding);
            const y2 = centerY + padding + ratio * (plotHeight - centerY - padding);
            
            // Upper grid (GC content)
            ctx.beginPath();
            ctx.moveTo(padding, y1);
            ctx.lineTo(padding + plotWidth, y1);
            ctx.stroke();
            
            // Lower grid (GC skew)
            ctx.beginPath();
            ctx.moveTo(padding, y2);
            ctx.lineTo(padding + plotWidth, y2);
            ctx.stroke();
        });
        
        // Center line (zero line for GC skew)
        ctx.strokeStyle = '#6c757d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, centerY);
        ctx.lineTo(padding + plotWidth, centerY);
        ctx.stroke();
    }
    
    drawGCContent(ctx, gcData, positions, sequenceLength, padding, plotWidth, maxHeight, gcMin, gcMax) {
        if (gcData.length < 2) return;
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, padding, 0, maxHeight);
        gradient.addColorStop(0, 'rgba(40, 167, 69, 0.8)');   // Strong green at top
        gradient.addColorStop(1, 'rgba(40, 167, 69, 0.2)');   // Light green at bottom
        
        // Draw filled area
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(padding, maxHeight);
        
        for (let i = 0; i < gcData.length; i++) {
            const x = padding + (positions[i] / sequenceLength) * plotWidth;
            const normalizedGC = (gcData[i] - gcMin) / (gcMax - gcMin);
            const y = maxHeight - normalizedGC * (maxHeight - padding);
            
            if (i === 0) {
                ctx.lineTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.lineTo(padding + plotWidth, maxHeight);
        ctx.closePath();
        ctx.fill();
        
        // Draw line
        ctx.strokeStyle = '#28a745';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < gcData.length; i++) {
            const x = padding + (positions[i] / sequenceLength) * plotWidth;
            const normalizedGC = (gcData[i] - gcMin) / (gcMax - gcMin);
            const y = maxHeight - normalizedGC * (maxHeight - padding);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
    
    drawGCSkew(ctx, skewData, positions, sequenceLength, padding, plotWidth, minY, maxY, skewMin, skewMax) {
        if (skewData.length < 2) return;
        
        // Calculate zero line position
        const skewRange = skewMax - skewMin;
        const zeroRatio = skewRange !== 0 ? Math.abs(skewMin) / skewRange : 0.5;
        const zeroY = maxY - zeroRatio * (maxY - minY);
        
        // Draw positive skew (above zero)
        const positiveGradient = ctx.createLinearGradient(0, minY, 0, zeroY);
        positiveGradient.addColorStop(0, 'rgba(255, 193, 7, 0.8)');   // Strong amber
        positiveGradient.addColorStop(1, 'rgba(255, 193, 7, 0.2)');   // Light amber
        
        // Draw negative skew (below zero)
        const negativeGradient = ctx.createLinearGradient(0, zeroY, 0, maxY);
        negativeGradient.addColorStop(0, 'rgba(220, 53, 69, 0.2)');   // Light red
        negativeGradient.addColorStop(1, 'rgba(220, 53, 69, 0.8)');   // Strong red
        
        // Draw positive area
        ctx.fillStyle = positiveGradient;
        ctx.beginPath();
        ctx.moveTo(padding, zeroY);
        
        for (let i = 0; i < skewData.length; i++) {
            const x = padding + (positions[i] / sequenceLength) * plotWidth;
            const normalizedSkew = skewRange !== 0 ? (skewData[i] - skewMin) / skewRange : 0.5;
            const y = maxY - normalizedSkew * (maxY - minY);
            
            if (skewData[i] >= 0) {
                ctx.lineTo(x, Math.min(y, zeroY));
            } else {
                ctx.lineTo(x, zeroY);
            }
        }
        
        ctx.lineTo(padding + plotWidth, zeroY);
        ctx.closePath();
        ctx.fill();
        
        // Draw negative area
        ctx.fillStyle = negativeGradient;
        ctx.beginPath();
        ctx.moveTo(padding, zeroY);
        
        for (let i = 0; i < skewData.length; i++) {
            const x = padding + (positions[i] / sequenceLength) * plotWidth;
            const normalizedSkew = skewRange !== 0 ? (skewData[i] - skewMin) / skewRange : 0.5;
            const y = maxY - normalizedSkew * (maxY - minY);
            
            if (skewData[i] < 0) {
                ctx.lineTo(x, Math.max(y, zeroY));
            } else {
                ctx.lineTo(x, zeroY);
            }
        }
        
        ctx.lineTo(padding + plotWidth, zeroY);
        ctx.closePath();
        ctx.fill();
        
        // Draw skew line
        ctx.strokeStyle = '#495057';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        
        for (let i = 0; i < skewData.length; i++) {
            const x = padding + (positions[i] / sequenceLength) * plotWidth;
            const normalizedSkew = skewRange !== 0 ? (skewData[i] - skewMin) / skewRange : 0.5;
            const y = maxY - normalizedSkew * (maxY - minY);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
    
    drawGCAxisLabels(ctx, width, height, gcMin, gcMax, skewMin, skewMax) {
        ctx.fillStyle = '#495057';
        ctx.font = '10px Inter, sans-serif';
        
        // GC Content labels (left side)
        ctx.textAlign = 'right';
        ctx.fillText(`${gcMax.toFixed(1)}%`, 8, 15);
        ctx.fillText(`${((gcMin + gcMax) / 2).toFixed(1)}%`, 8, height / 4);
        ctx.fillText(`${gcMin.toFixed(1)}%`, 8, height / 2 - 5);
        
        // GC Skew labels (left side)
        ctx.fillText(`${skewMax.toFixed(3)}`, 8, height / 2 + 15);
        ctx.fillText('0.000', 8, height / 2 + 2);
        ctx.fillText(`${skewMin.toFixed(3)}`, 8, height - 5);
        
        // Track labels (right side)
        ctx.textAlign = 'left';
        ctx.fillStyle = '#28a745';
        ctx.fillText('GC%', width - 40, 15);
        ctx.fillStyle = '#495057';
        ctx.fillText('Skew', width - 40, height - 5);
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
        `;
        
        legend.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 2px;">
                <div style="width: 12px; height: 3px; background: #28a745; margin-right: 4px;"></div>
                <span>GC Content</span>
            </div>
            <div style="display: flex; align-items: center;">
                <div style="width: 12px; height: 3px; background: linear-gradient(to right, #dc3545, #495057, #ffc107); margin-right: 4px;"></div>
                <span>GC Skew</span>
            </div>
        `;
        
        return legend;
    }
    
    addGCTooltipInteraction(canvas, container, data) {
        const tooltip = document.createElement('div');
        tooltip.className = 'gc-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 6px 8px;
            border-radius: 4px;
            font-size: 11px;
            pointer-events: none;
            z-index: 1000;
            display: none;
            white-space: nowrap;
        `;
        
        container.appendChild(tooltip);
        
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const canvasX = (x / rect.width) * canvas.width;
            
            // Find closest data point
            const padding = 10;
            const plotWidth = canvas.width - 2 * padding;
            const relativeX = (canvasX - padding) / plotWidth;
            const sequencePos = Math.round(relativeX * data.sequenceLength);
            
            // Find closest index
            let closestIndex = 0;
            let closestDistance = Math.abs(data.positions[0] - sequencePos);
            
            for (let i = 1; i < data.positions.length; i++) {
                const distance = Math.abs(data.positions[i] - sequencePos);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = i;
                }
            }
            
            if (closestIndex < data.gcData.length) {
                const gcValue = data.gcData[closestIndex];
                const skewValue = data.skewData[closestIndex];
                const position = data.viewStart + data.positions[closestIndex];
                
                tooltip.innerHTML = `
                    Position: ${position.toLocaleString()}<br>
                    GC Content: ${gcValue.toFixed(2)}%<br>
                    GC Skew: ${skewValue.toFixed(4)}
                `;
                
                tooltip.style.display = 'block';
                tooltip.style.left = `${e.clientX - rect.left + 10}px`;
                tooltip.style.top = `${e.clientY - rect.top - 10}px`;
            }
        });
        
        canvas.addEventListener('mouseleave', () => {
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackRenderer;
} 