/**
 * SequenceUtils - Handles sequence processing, display, and biological utilities
 */
class SequenceUtils {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this._cachedCharWidth = null; // Cache for character width measurement
        this.vscodeEditor = null;
        
        // Sequence display mode: 'view' for traditional display, 'edit' for VS Code editor
        this.displayMode = 'view';
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
            this.displayVSCodeSequence(chromosome, sequence, start, end);
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
        toggleButton.className = 'mode-toggle-btn';
        toggleButton.innerHTML = this.displayMode === 'edit' ? 
            '📖 Switch to View Mode' : '✏️ Switch to Edit Mode';
        toggleButton.title = this.displayMode === 'edit' ? 
            'Switch to traditional sequence view' : 'Switch to VS Code-style editor';
        
        toggleButton.onclick = () => {
            this.toggleDisplayMode();
        };
        
        // Add button after the title
        sequenceTitle.parentNode.insertBefore(toggleButton, sequenceTitle.nextSibling);
        
        // Add CSS for the button if not already present
        this.addModeToggleCSS();
    }
    
    /**
     * Add CSS for mode toggle button
     */
    addModeToggleCSS() {
        if (document.getElementById('sequenceModeToggleCSS')) return;
        
        const style = document.createElement('style');
        style.id = 'sequenceModeToggleCSS';
        style.textContent = `
            .mode-toggle-btn {
                background: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 6px 12px;
                margin-left: 15px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                gap: 5px;
            }
            
            .mode-toggle-btn:hover {
                background: #0056b3;
                transform: translateY(-1px);
            }
            
            .mode-toggle-btn:active {
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
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
                '📖 Switch to View Mode' : '✏️ Switch to Edit Mode';
            toggleButton.title = this.displayMode === 'edit' ? 
                'Switch to traditional sequence view' : 'Switch to VS Code-style editor';
        }
        
        // Clean up the container to avoid style conflicts
        this.cleanupContainer();
        
        // Re-display sequence with new mode
        const chromosome = this.genomeBrowser.currentChromosome;
        const sequence = this.genomeBrowser.currentSequence;
        if (chromosome && sequence) {
            const start = this.genomeBrowser.currentPosition.start;
            const end = this.genomeBrowser.currentPosition.end;
            
            // Force re-render by calling displayEnhancedSequence
            this.displayEnhancedSequence(chromosome, sequence);
        }
    }
    
    /**
     * Clean up container styles to prevent mode interference
     */
    cleanupContainer() {
        const container = document.getElementById('sequenceContent');
        if (!container) return;
        
        // Remove any VS Code editor specific styles
        container.style.removeProperty('font-family');
        container.style.removeProperty('font-size');
        container.style.removeProperty('line-height');
        container.style.removeProperty('background');
        container.style.removeProperty('color');
        container.style.removeProperty('overflow');
        container.style.removeProperty('position');
        
        // Reset container to default state
        container.className = '';
        
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
        
        // If switching from edit mode, destroy VS Code editor instance
        if (this.displayMode === 'view' && this.vscodeEditor) {
            try {
                if (this.vscodeEditor.destroy) {
                    this.vscodeEditor.destroy();
                }
                this.vscodeEditor = null;
            } catch (error) {
                console.warn('Error destroying VS Code editor:', error);
                this.vscodeEditor = null;
            }
        }
    }
    
    /**
     * Display sequence using VS Code-style editor
     */
    displayVSCodeSequence(chromosome, sequence, start, end) {
        const container = document.getElementById('sequenceContent');
        const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
        
        // Clean container first
        container.innerHTML = '';
        
        // Initialize VS Code editor if not already done
        if (!this.vscodeEditor) {
            this.vscodeEditor = new VSCodeSequenceEditor(container, this.genomeBrowser);
        }
        
        // Update the editor with new sequence data
        this.vscodeEditor.updateSequence(chromosome, sequence, start, end, annotations);
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

        const containerWidth = container.offsetWidth || 800;
        const charWidth = this.measureCharacterWidth(container); // Use measured width instead of hardcoded 12
        const positionWidth = 100;
        const availableWidth = containerWidth - positionWidth - 30; // 40 for padding/margins
        // Ensure at least some bases are shown, e.g., 10, and remove upper cap to fill width
        const optimalLineLength = Math.max(10, Math.floor(availableWidth / charWidth));
        
        // Get sequence track settings
        const sequenceSettings = this.getSequenceTrackSettings();
        
        let html = '<div class="detailed-sequence-view">';
        html += '<div class="sequence-info"><strong>DNA Sequence (colored by features):</strong></div>';
        
        for (let i = 0; i < subsequence.length; i += optimalLineLength) {
            const lineSubsequence = subsequence.substring(i, i + optimalLineLength);
            const lineStartPos = viewStart + i;
            
            html += `<div class="sequence-line-group" style="margin-bottom: 8px;">`;
            html += `<div class="sequence-line" style="display: flex; margin-bottom: 4px; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.6;">`;
            html += `<span class="sequence-position" style="width: 100px; color: #6c757d; font-weight: 600; margin-right: 15px; text-align: right; flex-shrink: 0;">${(lineStartPos + 1).toLocaleString()}</span>`;
            html += `<div class="sequence-bases" style="flex: 1; word-break: break-all; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.6;">${this.colorizeSequenceWithFeatures(lineSubsequence, lineStartPos, annotations, operons)}</div>`;
            html += `</div>`;
            // Add gene feature indicator bar below the sequence
            html += `<div class="gene-indicator-line" style="height: 12px; margin-left: 115px; margin-bottom: 4px;">${this.createGeneIndicatorBar(lineSubsequence, lineStartPos, annotations, operons, charWidth, false, sequenceSettings)}</div>`;
            html += `</div>`;
        }
        
        // Add protein translations for CDS regions
        const cdsFeatures = annotations.filter(feature => 
            feature.type === 'CDS' &&
            feature.start <= viewEnd && feature.end >= viewStart &&
            this.genomeBrowser.shouldShowGeneType('CDS')
        );
        
        if (cdsFeatures.length > 0) {
            html += '<div class="protein-translations" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;">';
            html += '<div class="sequence-info"><strong>Protein Translations:</strong></div>';
            
            cdsFeatures.forEach(cds => {
                const cdsDnaStart = Math.max(cds.start, viewStart);
                const cdsDnaEnd = Math.min(cds.end, viewEnd);
                const dnaForTranslation = fullSequence.substring(cds.start -1, cds.end);

                const proteinSequence = this.translateDNA(dnaForTranslation, cds.strand);
                const geneName = cds.qualifiers.gene || cds.qualifiers.locus_tag || 'Unknown';
                
                html += `<div class="protein-sequence" style="margin-bottom: 15px;">`;
                html += `<div class="protein-header" style="font-weight: bold; color: #495057; margin-bottom: 5px;">${geneName} (${cds.start}-${cds.end}, ${cds.strand === -1 ? '-' : '+'} strand):</div>`;
                html += `<div class="protein-seq" style="font-family: 'Courier New', monospace; font-size: 12px; background: #f8f9fa; padding: 8px; border-radius: 4px; word-break: break-all; line-height: 1.4;">${this.colorizeProteinSequence(proteinSequence)}</div>`;
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
        
        // Get sequence track settings
        const sequenceSettings = this.getSequenceTrackSettings();
        
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
            html += `<div class="gene-indicator-line">${this.createGeneIndicatorBar(lineSubsequence, lineStartPos, annotations, operons, charWidth, false, sequenceSettings)}</div>`;
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

        // Get sequence track settings
        const sequenceSettings = this.getSequenceTrackSettings();

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
            html += `<div class="gene-indicator-line">${this.createGeneIndicatorBar(lineSubsequence, lineStartPos, annotations, operons, charWidth, true, sequenceSettings)}</div>`;
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
    createGeneIndicatorBar(sequence, lineStartAbs, annotations, operons, charWidth, simplified = false, settings = {}) {
        // Check if indicators should be shown
        if (settings.showIndicators === false) {
            return '<div style="height: 0px;"></div>';
        }
        
        const barHeight = settings.indicatorHeight || 12; // Use settings or default
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
            // Rounded rectangle for terminator
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
            // Simple rectangle for CDS and others
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
            indicatorHeight: 12,
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SequenceUtils;
} 