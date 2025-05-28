/**
 * TrackRenderer - Handles all track creation and visualization
 */
class TrackRenderer {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
    }

    createRuler() {
        const ruler = document.createElement('div');
        ruler.className = 'genome-ruler';
        
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const range = end - start;
        const tickInterval = Math.max(1, Math.floor(range / 10));
        
        for (let pos = start; pos <= end; pos += tickInterval) {
            const tick = document.createElement('div');
            tick.className = 'ruler-tick';
            tick.style.left = `${((pos - start) / range) * 100}%`;
            tick.textContent = pos.toLocaleString();
            ruler.appendChild(tick);
        }
        
        return ruler;
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
        
        // Add draggable functionality
        this.genomeBrowser.makeDraggable(trackContent, chromosome);
        
        const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const range = end - start;
        
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
        
        visibleGenes.forEach((gene, index) => {
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
            
            if (gene.strand === -1) {
                geneElement.classList.add('reverse-strand');
            }
            
            // Create comprehensive gene label
            const geneName = gene.qualifiers.gene || gene.qualifiers.locus_tag || gene.qualifiers.product || gene.type;
            const geneInfo = `${geneName} (${gene.type})`;
            const positionInfo = `${gene.start}-${gene.end} (${gene.strand === -1 ? '-' : '+'} strand)`;
            
            geneElement.title = `${geneInfo}\nPosition: ${positionInfo}`;
            
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
                this.showGeneDetails(gene);
            });
            
            trackContent.appendChild(geneElement);
        });
        
        // Add message if no genes found
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
        }
        
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
            baseElement.style.userSelect = 'text';
            baseElement.style.cursor = 'text';
            
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
        trackHeader.textContent = 'GC Content';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        trackContent.style.height = '80px';
        
        // Add draggable functionality
        this.genomeBrowser.makeDraggable(trackContent, chromosome);
        
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const subsequence = sequence.substring(start, end);
        
        // Create GC content visualization
        const gcDisplay = this.createGCContentVisualization(subsequence);
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

    createReadsTrack(chromosome) {
        const track = document.createElement('div');
        track.className = 'reads-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'Aligned Reads';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        trackContent.style.height = '120px';
        
        const reads = this.genomeBrowser.currentReads[chromosome] || [];
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const range = end - start;
        
        // Check if we have any reads data at all
        if (!this.genomeBrowser.currentReads || Object.keys(this.genomeBrowser.currentReads).length === 0) {
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
            track.appendChild(trackContent);
            return track;
        }
        
        // Filter reads that overlap with current region
        const visibleReads = reads.filter(read => 
            read.start && read.end && 
            read.start <= end && read.end >= start
        );
        
        console.log(`Displaying ${visibleReads.length} reads in region ${start}-${end}`);
        
        visibleReads.forEach((read, index) => {
            const readElement = document.createElement('div');
            readElement.className = 'read-element';
            
            const readStart = Math.max(read.start, start);
            const readEnd = Math.min(read.end, end);
            const left = ((readStart - start) / range) * 100;
            const width = Math.max(((readEnd - readStart) / range) * 100, 0.2);
            
            readElement.style.left = `${left}%`;
            readElement.style.width = `${width}%`;
            readElement.style.height = '12px';
            readElement.style.top = '20px';
            readElement.style.position = 'absolute';
            readElement.style.background = read.strand === '+' ? '#00b894' : '#f39c12';
            readElement.style.borderRadius = '2px';
            readElement.style.cursor = 'pointer';
            
            // Create read tooltip
            const readInfo = `Read: ${read.id || 'Unknown'}\n` +
                              `Position: ${read.start}-${read.end}\n` +
                              `Strand: ${read.strand || 'N/A'}\n` +
                              `Mapping Quality: ${read.mappingQuality || 'N/A'}`;
            
            readElement.title = readInfo;
            
            // Add click handler for detailed info
            readElement.addEventListener('click', () => {
                alert(readInfo);
            });
            
            trackContent.appendChild(readElement);
        });
        
        // Add message if no reads found in this region
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
        }
        
        track.appendChild(trackContent);
        return track;
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

    createGCContentVisualization(sequence) {
        const gcDisplay = document.createElement('div');
        gcDisplay.className = 'gc-content-display';
        gcDisplay.style.position = 'relative';
        gcDisplay.style.height = '60px';
        gcDisplay.style.background = 'rgba(255, 255, 255, 0.1)';
        gcDisplay.style.border = '1px solid rgba(0, 0, 0, 0.1)';
        gcDisplay.style.borderRadius = '4px';
        
        const windowSize = Math.max(10, Math.floor(sequence.length / 50));
        
        for (let i = 0; i < sequence.length - windowSize; i += windowSize) {
            const window = sequence.substring(i, i + windowSize);
            const gcCount = (window.match(/[GC]/g) || []).length;
            const gcPercent = (gcCount / windowSize) * 100;
            
            const bar = document.createElement('div');
            bar.className = 'gc-bar';
            bar.style.position = 'absolute';
            bar.style.left = `${(i / sequence.length) * 100}%`;
            bar.style.width = `${(windowSize / sequence.length) * 100}%`;
            bar.style.height = `${(gcPercent / 100) * 50}px`;
            bar.style.bottom = '5px';
            bar.style.background = `hsl(${120 - (gcPercent * 1.2)}, 70%, 50%)`;
            bar.style.borderRadius = '2px';
            bar.title = `GC Content: ${gcPercent.toFixed(1)}%`;
            
            gcDisplay.appendChild(bar);
        }
        
        return gcDisplay;
    }

    showGeneDetails(gene) {
        const details = [];
        details.push(`Type: ${gene.type}`);
        details.push(`Position: ${gene.start}-${gene.end}`);
        details.push(`Strand: ${gene.strand === -1 ? 'Reverse (-)' : 'Forward (+)'}`);
        details.push(`Length: ${gene.end - gene.start + 1} bp`);
        
        if (gene.qualifiers) {
            Object.entries(gene.qualifiers).forEach(([key, value]) => {
                if (value && value !== 'Unknown') {
                    details.push(`${key}: ${value}`);
                }
            });
        }
        
        alert(details.join('\n'));
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
                if (value && value !== 'Unknown') {
                    details.push(`${key}: ${value}`);
                }
            });
        }
        
        alert(details.join('\n'));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackRenderer;
} 