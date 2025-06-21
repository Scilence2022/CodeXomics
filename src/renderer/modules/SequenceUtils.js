/**
 * SequenceUtils - Handles sequence processing, display, and biological utilities
 */
class SequenceUtils {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this._cachedCharWidth = null; // Cache for character width measurement
    }

    // Sequence display methods
    displayEnhancedSequence(chromosome, sequence) {
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const windowSize = end - start;
        
        // Choose display method based on window size
        if (windowSize <= 500) {
            this.displayDetailedSequence(chromosome, sequence, start, end);
        } else if (windowSize <= 2000) {
            this.displaySequenceWithAnnotations(chromosome, sequence, start, end);
        } else {
            this.displaySequence(chromosome, sequence, start, end);
        }
        
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
        
        // Re-highlight selected gene sequence if there is one
        if (this.genomeBrowser.selectedGene && this.genomeBrowser.selectedGene.gene) {
            // Use setTimeout to ensure the DOM is updated before highlighting
            setTimeout(() => {
                this.genomeBrowser.highlightGeneSequence(this.genomeBrowser.selectedGene.gene);
            }, 100);
        }
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
        const container = document.getElementById('sequenceContent');
        const subsequence = fullSequence.substring(viewStart, viewEnd);
        const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
        const operons = this.genomeBrowser.detectOperons ? this.genomeBrowser.detectOperons(annotations) : [];

        const containerWidth = container.offsetWidth || 800;
        const charWidth = this.measureCharacterWidth(container); // Use measured width instead of hardcoded 12
        const positionWidth = 100;
        const availableWidth = containerWidth - positionWidth - 30; // 40 for padding/margins
        // Ensure at least some bases are shown, e.g., 10, and remove upper cap to fill width
        const optimalLineLength = Math.max(10, Math.floor(availableWidth / charWidth));
        
        let html = '<div class="detailed-sequence-view">';
        html += '<div class="sequence-info"><strong>DNA Sequence (colored by features):</strong></div>';
        
        for (let i = 0; i < subsequence.length; i += optimalLineLength) {
            const lineSubsequence = subsequence.substring(i, i + optimalLineLength);
            const lineStartPos = viewStart + i;
            
            html += `<div class="sequence-line-group">`;
            html += `<div class="sequence-line">`;
            html += `<span class="sequence-position">${(lineStartPos + 1).toLocaleString()}</span>`;
            html += `<div class="sequence-bases" style="font-family: 'Courier New', monospace; font-size: 14px;">${this.colorizeSequenceWithFeatures(lineSubsequence, lineStartPos, annotations, operons)}</div>`;
            html += `</div>`;
            // Add gene feature indicator bar below the sequence
            html += `<div class="gene-indicator-line">${this.createGeneIndicatorBar(lineSubsequence, lineStartPos, annotations, operons, charWidth)}</div>`;
            html += `</div>`;
        }
        
        // Add protein translations for CDS regions
        const cdsFeatures = annotations.filter(feature => 
            feature.type === 'CDS' &&
            feature.start <= viewEnd && feature.end >= viewStart &&
            this.genomeBrowser.shouldShowGeneType('CDS')
        );
        
        if (cdsFeatures.length > 0) {
            html += '<div class="protein-translations">';
            html += '<div class="sequence-info"><strong>Protein Translations:</strong></div>';
            
            cdsFeatures.forEach(cds => {
                const cdsDnaStart = Math.max(cds.start, viewStart);
                const cdsDnaEnd = Math.min(cds.end, viewEnd);
                const dnaForTranslation = fullSequence.substring(cds.start -1, cds.end);

                const proteinSequence = this.translateDNA(dnaForTranslation, cds.strand);
                const geneName = cds.qualifiers.gene || cds.qualifiers.locus_tag || 'Unknown';
                
                html += `<div class="protein-sequence">`;
                html += `<div class="protein-header">${geneName} (${cds.start}-${cds.end}, ${cds.strand === -1 ? '-' : '+'} strand):</div>`;
                html += `<div class="protein-seq">${this.colorizeProteinSequence(proteinSequence)}</div>`;
                html += `</div>`;
            });
            html += '</div>';
        }
        html += '</div>';
        container.innerHTML = html;
    }

    displaySequenceWithAnnotations(chromosome, fullSequence, viewStart, viewEnd) {
        const container = document.getElementById('sequenceContent');
        const subsequence = fullSequence.substring(viewStart, viewEnd);
        const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
        const operons = this.genomeBrowser.detectOperons ? this.genomeBrowser.detectOperons(annotations) : [];

        const containerWidth = container.offsetWidth || 800;
        const charWidth = this.measureCharacterWidth(container); // Use measured width instead of hardcoded 12
        const positionWidth = 100;
        const availableWidth = containerWidth - positionWidth - 30;
        // Remove upper cap to fill width
        const optimalLineLength = Math.max(10, Math.floor(availableWidth / charWidth));
        
        let html = '';
        for (let i = 0; i < subsequence.length; i += optimalLineLength) {
            const lineSubsequence = subsequence.substring(i, i + optimalLineLength);
            const lineStartPos = viewStart + i;
            html += `<div class="sequence-line-group">`;
            html += `<div class="sequence-line">`;
            html += `<span class="sequence-position">${(lineStartPos + 1).toLocaleString()}</span>`;
            html += `<div class="sequence-bases" style="font-family: 'Courier New', monospace; font-size: 14px;">${this.colorizeSequenceWithFeatures(lineSubsequence, lineStartPos, annotations, operons)}</div>`;
            html += `</div>`;
            // Add gene feature indicator bar below the sequence
            html += `<div class="gene-indicator-line">${this.createGeneIndicatorBar(lineSubsequence, lineStartPos, annotations, operons, charWidth)}</div>`;
            html += `</div>`;
        }
        container.innerHTML = html;
    }

    displaySequence(chromosome, fullSequence, viewStart, viewEnd) {
        const container = document.getElementById('sequenceContent');
        const subsequence = fullSequence.substring(viewStart, viewEnd);
        const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
        const operons = this.genomeBrowser.detectOperons ? this.genomeBrowser.detectOperons(annotations) : [];

        const containerWidth = container.offsetWidth || 800;
        const charWidth = this.measureCharacterWidth(container); // Use measured width instead of hardcoded 12
        const positionWidth = 100;
        const availableWidth = containerWidth - positionWidth - 30;
        // Remove upper cap to fill width
        const optimalLineLength = Math.max(10, Math.floor(availableWidth / charWidth));

        let html = '';
        for (let i = 0; i < subsequence.length; i += optimalLineLength) {
            const lineSubsequence = subsequence.substring(i, i + optimalLineLength);
            const lineStartPos = viewStart + i;
            html += `<div class="sequence-line-group">`;
            html += `<div class="sequence-line">`;
            html += `<span class="sequence-position">${(lineStartPos + 1).toLocaleString()}</span>`;
            html += `<div class="sequence-bases" style="font-family: 'Courier New', monospace; font-size: 14px;">${this.colorizeSequenceWithFeatures(lineSubsequence, lineStartPos, annotations, operons, true)}</div>`;
            html += `</div>`;
            // Add gene feature indicator bar below the sequence
            html += `<div class="gene-indicator-line">${this.createGeneIndicatorBar(lineSubsequence, lineStartPos, annotations, operons, charWidth, true)}</div>`;
            html += `</div>`;
        }
        container.innerHTML = html;
    }

    /**
     * Create SVG-enhanced sequence display with professional gene feature backgrounds
     */
    createSVGEnhancedSequence(sequence, lineStartAbs, annotations, operons, charWidth, lineLength, simplified = false) {
        const baseFontSize = 14;
        const lineHeight = 20; // Height for the SVG background layer
        const lineWidth = sequence.length * charWidth;
        
        // Create SVG background layer
        let svgLayer = `<svg class="sequence-svg-background" style="position: absolute; top: 0; left: 0; width: ${lineWidth}px; height: ${lineHeight}px; z-index: 1; pointer-events: none;">`;
        
        // Add definitions for gradients
        svgLayer += '<defs>';
        svgLayer += this.createSequenceSVGGradients();
        svgLayer += '</defs>';
        
        // Group features by position to create proper layering
        const featureSegments = this.createFeatureSegments(sequence, lineStartAbs, annotations, operons, simplified);
        
        // Draw feature backgrounds as SVG shapes
        featureSegments.forEach(segment => {
            if (segment.feature) {
                const x = segment.startIndex * charWidth;
                const width = (segment.endIndex - segment.startIndex + 1) * charWidth;
                svgLayer += this.createSequenceFeatureSVG(segment.feature, x, width, lineHeight, operons);
            }
        });
        
        svgLayer += '</svg>';
        
        // Create text layer with sequence bases
        let textLayer = `<div class="sequence-text-layer" style="position: relative; z-index: 2; font-size: 0;">`;
        
        for (let i = 0; i < sequence.length; i++) {
            const base = sequence[i];
            const baseTextColor = this.getBaseColor(base);
            
            const style = `color: ${baseTextColor}; font-size: ${baseFontSize}px; display: inline-block; padding: 0; margin: 0; vertical-align: top; width: ${charWidth}px; text-align: center;`;
            textLayer += `<span class="base-${base.toLowerCase()}" style="${style}">${base}</span>`;
        }
        
        textLayer += '</div>';
        
        return svgLayer + textLayer;
    }

    /**
     * Create feature segments for a sequence line
     */
    createFeatureSegments(sequence, lineStartAbs, annotations, operons, simplified = false) {
        const segments = [];
        
        for (let i = 0; i < sequence.length; i++) {
            const absPos = lineStartAbs + i + 1;
            let feature = null;
            
            if (!simplified) {
                const overlappingFeatures = annotations.filter(f => 
                    absPos >= f.start && absPos <= f.end && 
                    this.genomeBrowser.shouldShowGeneType(f.type)
                );
                
                if (overlappingFeatures.length > 0) {
                    // Sort by priority
                    const sortedFeatures = overlappingFeatures.sort((a, b) => {
                        const typeOrder = { 'CDS': 1, 'mRNA': 2, 'tRNA': 2, 'rRNA': 2, 'promoter': 3, 'terminator': 3, 'regulatory': 3, 'gene': 4 };
                        return (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5);
                    });
                    feature = sortedFeatures[0];
                }
            } else {
                const overlapping = annotations.find(f => absPos >= f.start && absPos <= f.end);
                if (overlapping) feature = { type: 'simplified', ...overlapping };
            }
            
            segments.push({
                startIndex: i,
                endIndex: i,
                feature: feature
            });
        }
        
        // Merge consecutive segments with the same feature
        const mergedSegments = [];
        let currentSegment = null;
        
        segments.forEach(segment => {
            if (!currentSegment || !this.featuresEqual(currentSegment.feature, segment.feature)) {
                if (currentSegment) mergedSegments.push(currentSegment);
                currentSegment = { ...segment };
            } else {
                currentSegment.endIndex = segment.endIndex;
            }
        });
        
        if (currentSegment) mergedSegments.push(currentSegment);
        
        return mergedSegments;
    }

    /**
     * Check if two features are equal for merging purposes
     */
    featuresEqual(feature1, feature2) {
        if (!feature1 && !feature2) return true;
        if (!feature1 || !feature2) return false;
        return feature1.start === feature2.start && 
               feature1.end === feature2.end && 
               feature1.type === feature2.type;
    }

    /**
     * Create SVG gradients for sequence features
     */
    createSequenceSVGGradients() {
        const gradients = [
            { id: 'seq-cds-gradient', color1: '#8e44ad', color2: '#a569bd' },
            { id: 'seq-mrna-gradient', color1: '#16a085', color2: '#48c9b0' },
            { id: 'seq-trna-gradient', color1: '#27ae60', color2: '#58d68d' },
            { id: 'seq-rrna-gradient', color1: '#2980b9', color2: '#5dade2' },
            { id: 'seq-promoter-gradient', color1: '#f1c40f', color2: '#f7dc6f' },
            { id: 'seq-terminator-gradient', color1: '#d35400', color2: '#ec7063' },
            { id: 'seq-regulatory-gradient', color1: '#c0392b', color2: '#e74c3c' },
            { id: 'seq-simplified-gradient', color1: '#95a5a6', color2: '#bdc3c7' }
        ];

        let defsContent = '';
        gradients.forEach(gradientDef => {
            defsContent += `<linearGradient id="${gradientDef.id}" x1="0%" y1="0%" x2="100%" y2="100%">`;
            defsContent += `<stop offset="0%" stop-color="${gradientDef.color1}" />`;
            defsContent += `<stop offset="100%" stop-color="${gradientDef.color2}" />`;
            defsContent += `</linearGradient>`;
        });
        
        return defsContent;
    }

    /**
     * Create SVG feature shape for sequence background
     */
    createSequenceFeatureSVG(feature, x, width, height, operons) {
        const operonInfo = this.genomeBrowser.getGeneOperonInfo(feature, operons);
        const isForward = feature.strand !== -1;
        const geneType = feature.type.toLowerCase();
        
        // Use operon color if available, otherwise use type-specific gradient
        let fillColor = `url(#seq-${geneType}-gradient)`;
        if (operonInfo && operonInfo.color) {
            // Create a subtle background with operon color
            fillColor = this.hexToRgba(operonInfo.color, 0.3);
        }
        
        let shape = '';
        const margin = 1; // Small margin to prevent overlap
        
        if (geneType === 'promoter') {
            // Arrow shape for promoters
            const arrowSize = Math.min(height * 0.3, 4);
            const direction = isForward ? 1 : -1;
            shape = `<path d="M ${x + margin} ${margin} 
                            L ${x + width - arrowSize - margin} ${margin} 
                            L ${x + width - margin} ${height/2} 
                            L ${x + width - arrowSize - margin} ${height - margin} 
                            L ${x + margin} ${height - margin} Z" 
                            fill="${fillColor}" 
                            stroke="${this.darkenHexColor(operonInfo?.color || '#f1c40f', 20)}" 
                            stroke-width="0.5" 
                            opacity="0.7"/>`;
        } else if (geneType === 'terminator') {
            // Rectangle with rounded ends for terminators
            shape = `<rect x="${x + margin}" y="${margin}" 
                           width="${width - 2*margin}" height="${height - 2*margin}" 
                           rx="3" ry="3" 
                           fill="${fillColor}" 
                           stroke="${this.darkenHexColor(operonInfo?.color || '#d35400', 20)}" 
                           stroke-width="0.5" 
                           opacity="0.7"/>`;
        } else if (['trna', 'rrna', 'mrna'].includes(geneType)) {
            // Wavy-edged rectangle for RNA types
            const waveHeight = 2;
            shape = `<path d="M ${x + margin} ${margin + waveHeight} 
                            Q ${x + width/4} ${margin} ${x + width/2} ${margin + waveHeight/2}
                            Q ${x + 3*width/4} ${margin} ${x + width - margin} ${margin + waveHeight}
                            L ${x + width - margin} ${height - margin - waveHeight}
                            Q ${x + 3*width/4} ${height - margin} ${x + width/2} ${height - margin - waveHeight/2}
                            Q ${x + width/4} ${height - margin} ${x + margin} ${height - margin - waveHeight} Z" 
                            fill="${fillColor}" 
                            stroke="${this.darkenHexColor(operonInfo?.color || this.getFeatureTypeColor(feature.type), 20)}" 
                            stroke-width="0.5" 
                            opacity="0.7"/>`;
        } else {
            // Default rectangle for CDS and other features
            shape = `<rect x="${x + margin}" y="${margin}" 
                           width="${width - 2*margin}" height="${height - 2*margin}" 
                           fill="${fillColor}" 
                           stroke="${this.darkenHexColor(operonInfo?.color || this.getFeatureTypeColor(feature.type), 20)}" 
                           stroke-width="0.5" 
                           opacity="0.6"/>`;
        }
        
        // Add feature tooltip
        const featureTitle = `${feature.qualifiers?.gene || feature.qualifiers?.locus_tag || feature.type} (${feature.start}-${feature.end})`;
        return `<g title="${featureTitle}">${shape}</g>`;
    }

    /**
     * Darken a hex color by a percentage
     */
    darkenHexColor(hex, percent) {
        if (!hex || hex === 'transparent') return '#666666';
        if (!hex.startsWith('#')) return hex;
        
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        
        const factor = (100 - percent) / 100;
        const newR = Math.round(r * factor);
        const newG = Math.round(g * factor);
        const newB = Math.round(b * factor);
        
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }

    colorizeSequence(sequence, lineStartAbs, annotations, operons, simplified = false) { // old method, to be replaced by colorizeSequenceWithFeatures
        return sequence.split('').map((base, index) => {
            const absPos = lineStartAbs + index + 1; // 1-based absolute position
            let bgColor = 'transparent';
            let featureTitle = '';

            if (!simplified) {
                for (const feature of annotations) {
                    if (this.genomeBrowser.shouldShowGeneType(feature.type) && absPos >= feature.start && absPos <= feature.end) {
                        const operonInfo = operons ? this.genomeBrowser.getGeneOperonInfo(feature, operons) : null;
                        bgColor = operonInfo ? operonInfo.color : '#dddddd'; // Default feature color if no operon
                        featureTitle = `${feature.qualifiers.gene || feature.qualifiers.locus_tag || feature.type} (${feature.start}-${feature.end})`;
                        break; 
                    }
                }
            } else {
                 for (const feature of annotations) {
                    if (absPos >= feature.start && absPos <= feature.end) {
                        bgColor = '#e0e0e0'; // Simplified grey for any feature
                        break;
                    }
                }
            }

            const className = `base-${base.toLowerCase()}`;
            const style = bgColor !== 'transparent' ? `style="background-color: ${bgColor}; color: ${this.getContrastingTextColor(bgColor)};"` : '';
            const titleAttr = featureTitle ? `title="${featureTitle}"` : '';
            return `<span class="${className}" ${style} ${titleAttr}>${base}</span>`;
        }).join('');
    }

    colorizeSequenceWithFeatures(sequence, lineStartAbs, annotations, operons, simplified = false) {
        let html = '';
        const baseFontSize = '14px'; // Define a base font size to be applied to individual bases

        for (let i = 0; i < sequence.length; i++) {
            const base = sequence[i];
            const absPos = lineStartAbs + i + 1; // 1-based absolute position
            let featureHexColor = null; 
            let featureTitle = '';
            const baseTextColor = this.getBaseColor(base); 

            const overlappingFeatures = annotations.filter(f => absPos >= f.start && absPos <= f.end && this.genomeBrowser.shouldShowGeneType(f.type));

            if (overlappingFeatures.length > 0) {
                const sortedFeatures = overlappingFeatures.sort((a,b) => {
                    const typeOrder = { 'CDS': 1, 'mRNA': 2, 'tRNA': 2, 'rRNA': 2, 'promoter': 3, 'terminator': 3, 'regulatory': 3, 'gene': 4 };
                    return (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5);
                });
                const mainFeature = sortedFeatures[0];
                const operonInfo = operons && mainFeature.type !== 'promoter' && mainFeature.type !== 'terminator' ? this.genomeBrowser.getGeneOperonInfo(mainFeature, operons) : null;
                featureHexColor = operonInfo ? operonInfo.color : this.getFeatureTypeColor(mainFeature.type);
                featureTitle = `${mainFeature.qualifiers.gene || mainFeature.qualifiers.locus_tag || mainFeature.type} (${mainFeature.start}-${mainFeature.end})`;
            }

            let style = `color: ${baseTextColor}; font-size: ${baseFontSize}; display: inline-block; padding: 0; margin: 0; vertical-align: top;`; // Reset font-size, ensure no gaps
            if (featureHexColor) {
                const backgroundColorRgba = this.hexToRgba(featureHexColor, 0.1);
                style += ` background-color: ${backgroundColorRgba};`;
            } else {
                style += ` background-color: transparent;`;
            }

            const className = `base-${base.toLowerCase()}`;
            const titleAttr = featureTitle ? `title="${featureTitle}"` : '';
            html += `<span class="${className}" style="${style}" ${titleAttr}>${base}</span>`;
        }
        return html;
    }

    getBaseColor(base) {
        switch (base.toUpperCase()) {
            case 'A': return '#2ecc71'; // Green
            case 'T': return '#e74c3c'; // Red
            case 'G': return '#f39c12'; // Orange
            case 'C': return '#3498db'; // Blue
            default: return '#7f8c8d'; // Grey for N etc.
        }
    }

    getFeatureTypeColor(type) {
        // Provide default colors for feature types if not in operon
        switch (type) {
            case 'CDS': return '#8e44ad'; // Purple
            case 'mRNA': return '#16a085'; // Teal
            case 'tRNA': return '#27ae60'; // Green variant
            case 'rRNA': return '#2980b9'; // Blue variant
            case 'promoter': return '#f1c40f'; // Yellow
            case 'terminator': return '#d35400'; // Orange-Red
            case 'regulatory': return '#c0392b'; // Dark Red
            case 'gene': return '#bdc3c7'; // Light grey for general gene features
            default: return '#95a5a6'; // Default grey for other features
        }
    }

    getContrastingTextColor(backgroundColor) {
        if (!backgroundColor || backgroundColor === 'transparent') return '#333333'; // Default text color if no background
        const color = (backgroundColor.charAt(0) === '#') ? backgroundColor.substring(1, 7) : backgroundColor;
        const r = parseInt(color.substring(0, 2), 16); // hexToR
        const g = parseInt(color.substring(2, 4), 16); // hexToG
        const b = parseInt(color.substring(4, 6), 16); // hexToB
        const uicolors = [r / 255, g / 255, b / 255];
        const c = uicolors.map((col) => {
            if (col <= 0.03928) {
                return col / 12.92;
            }
            return Math.pow((col + 0.055) / 1.055, 2.4);
        });
        const L = (0.2126 * c[0]) + (0.7152 * c[1]) + (0.0722 * c[2]);
        return (L > 0.179) ? '#000000' : '#FFFFFF';
    }

    // Add back the colorizeProteinSequence method
    colorizeProteinSequence(sequence) {
        const aaColors = {
            'A': '#ff6b6b', 'R': '#4ecdc4', 'N': '#45b7d1', 'D': '#f9ca24',
            'C': '#f0932b', 'Q': '#eb4d4b', 'E': '#6c5ce7', 'G': '#a29bfe',
            'H': '#fd79a8', 'I': '#00b894', 'L': '#00cec9', 'K': '#0984e3',
            'M': '#e17055', 'F': '#81ecec', 'P': '#fab1a0', 'S': '#00b894',
            'T': '#55a3ff', 'W': '#fd79a8', 'Y': '#fdcb6e', 'V': '#6c5ce7',
            '*': '#2d3436'
        };
        
        return sequence.split('').map(aa => {
            const color = aaColors[aa] || '#74b9ff';
            return `<span style="color: ${color}; font-weight: bold;">${aa}</span>`;
        }).join('');
    }

    // Helper function to convert hex color to RGBA
    hexToRgba(hex, alpha) {
        if (!hex) return 'transparent'; // Fallback for safety
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        if (typeof alpha === 'number' && alpha >= 0 && alpha <= 1) {
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return `rgb(${r}, ${g}, ${b})`; // Fallback to RGB if alpha is invalid
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
    createGeneIndicatorBar(sequence, lineStartAbs, annotations, operons, charWidth, simplified = false) {
        const barHeight = 6; // Very narrow indicator bar
        const lineWidth = sequence.length * charWidth;
        
        // Create SVG for the indicator bar
        let svg = `<svg class="gene-indicator-svg" style="width: ${lineWidth}px; height: ${barHeight}px; margin-left: 0;">`;
        
        // Get feature segments for this sequence line
        const featureSegments = this.createFeatureSegments(sequence, lineStartAbs, annotations, operons, simplified);
        
        // Draw simple indicator shapes
        featureSegments.forEach(segment => {
            if (segment.feature) {
                const x = segment.startIndex * charWidth;
                const width = (segment.endIndex - segment.startIndex + 1) * charWidth;
                svg += this.createSimpleIndicatorShape(segment.feature, x, width, barHeight, operons);
            }
        });
        
        svg += '</svg>';
        return svg;
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SequenceUtils;
} 