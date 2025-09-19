/**
 * ExportManager - Handles exporting genome data in various formats
 */
class ExportManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        // Export configuration settings
        this.exportConfig = {
            includeProteinSequences: false  // Default: don't export protein sequences
        };
        
        // Load saved configuration
        this.loadExportConfig();
    }

    // Export current genome as FASTA
    exportAsFasta() {
        if (!this.genomeBrowser.currentSequence) {
            alert('No genome data loaded to export.');
            return;
        }

        const chromosomes = Object.keys(this.genomeBrowser.currentSequence);
        let fastaContent = '';

        chromosomes.forEach(chr => {
            const sequence = this.genomeBrowser.currentSequence[chr];
            fastaContent += `>${chr}\n`;
            
            // Split sequence into lines of 80 characters
            for (let i = 0; i < sequence.length; i += 80) {
                fastaContent += sequence.substring(i, i + 80) + '\n';
            }
        });

        this.downloadFile(fastaContent, 'genome.fasta', 'text/plain');
    }

    // Export current genome as GenBank format with complete qualifier support
    exportAsGenBank() {
        if (!this.genomeBrowser.currentSequence) {
            alert('No genome data loaded to export.');
            return;
        }

        const chromosomes = Object.keys(this.genomeBrowser.currentSequence);
        let genbankContent = '';

        chromosomes.forEach(chr => {
            const sequence = this.genomeBrowser.currentSequence[chr];
            const features = this.genomeBrowser.currentAnnotations[chr] || [];
            
            // GenBank header
            genbankContent += `LOCUS       ${chr.padEnd(16)} ${sequence.length} bp    DNA     linear   UNK ${new Date().toISOString().slice(0, 10).replace(/-/g, '-')}\n`;
            genbankContent += `DEFINITION  ${chr}\n`;
            genbankContent += `ACCESSION   ${chr}\n`;
            genbankContent += `VERSION     ${chr}\n`;
            genbankContent += `KEYWORDS    .\n`;
            genbankContent += `SOURCE      .\n`;
            genbankContent += `  ORGANISM  .\n`;
            genbankContent += `FEATURES             Location/Qualifiers\n`;
            genbankContent += `     source          1..${sequence.length}\n`;
            
            // Add features with comprehensive qualifier support
            features.forEach(feature => {
                const location = feature.strand === '-' ? 
                    `complement(${feature.start}..${feature.end})` : 
                    `${feature.start}..${feature.end}`;
                
                genbankContent += `     ${feature.type.padEnd(15)} ${location}\n`;
                
                // Export all qualifiers using the comprehensive method
                genbankContent += this.exportFeatureQualifiers(feature);
            });
            
            genbankContent += `ORIGIN\n`;
            
            // Add sequence in GenBank format (60 chars per line, numbered)
            for (let i = 0; i < sequence.length; i += 60) {
                const lineNum = (i + 1).toString().padStart(9);
                const seqLine = sequence.substring(i, i + 60).toLowerCase();
                const formattedSeq = seqLine.match(/.{1,10}/g)?.join(' ') || seqLine;
                genbankContent += `${lineNum} ${formattedSeq}\n`;
            }
            
            genbankContent += `//\n\n`;
        });

        this.downloadFile(genbankContent, 'genome.gbk', 'text/plain');
    }

    // Comprehensive qualifier export method
    exportFeatureQualifiers(feature) {
        let qualifierContent = '';
        const qualifiers = feature.qualifiers || {};
        
        // Standard qualifier order for GenBank format
        const standardOrder = [
            'gene', 'locus_tag', 'product', 'note', 'protein_id', 'translation',
            'codon_start', 'transl_table', 'EC_number', 'go_process', 'go_function', 
            'go_component', 'db_xref', 'inference'
        ];
        
        // Export standard qualifiers first in proper order
        standardOrder.forEach(key => {
            if (qualifiers[key]) {
                const values = this.genomeBrowser.getAllQualifierValues(qualifiers, key);
                values.forEach(value => {
                    if (value === true) {
                        qualifierContent += `                     /${key}\n`;
                    } else if (value && value !== '' && value !== 'Unknown') {
                        // Handle special cases
                        let cleanValue = String(value);
                        
                        // Handle translation sequences properly
                        if (key === 'translation') {
                            if (this.exportConfig.includeProteinSequences) {
                                // Use the correct protein sequence from the existing algorithm
                                cleanValue = this.getCorrectProteinSequence(feature);
                            } else {
                                // Skip translation export if not configured
                                return;
                            }
                        }
                        
                        // Format multi-line qualifiers properly
                        if (cleanValue.length > 60) {
                            const lines = this.wrapQualifierValue(cleanValue, 60);
                            lines.forEach((line, index) => {
                                if (index === 0) {
                                    qualifierContent += `                     /${key}="${line}"\n`;
                                } else {
                                    qualifierContent += `                     "${line}"\n`;
                                }
                            });
                        } else {
                            qualifierContent += `                     /${key}="${cleanValue}"\n`;
                        }
                    }
                });
            }
        });
        
        // Export any remaining qualifiers not in standard order
        Object.keys(qualifiers).forEach(key => {
            if (!standardOrder.includes(key)) {
                const values = this.genomeBrowser.getAllQualifierValues(qualifiers, key);
                values.forEach(value => {
                    if (value === true) {
                        qualifierContent += `                     /${key}\n`;
                    } else if (value && value !== '' && value !== 'Unknown') {
                        let cleanValue = String(value);
                        
                        // Format multi-line qualifiers properly
                        if (cleanValue.length > 60) {
                            const lines = this.wrapQualifierValue(cleanValue, 60);
                            lines.forEach((line, index) => {
                                if (index === 0) {
                                    qualifierContent += `                     /${key}="${line}"\n`;
                                } else {
                                    qualifierContent += `                     "${line}"\n`;
                                }
                            });
                        } else {
                            qualifierContent += `                     /${key}="${cleanValue}"\n`;
                        }
                    }
                });
            }
        });
        
        // Fallback to basic feature properties if no qualifiers
        if (!qualifierContent) {
            if (feature.name) {
                qualifierContent += `                     /gene="${feature.name}"\n`;
            }
            if (feature.product) {
                qualifierContent += `                     /product="${feature.product}"\n`;
            }
            if (feature.note) {
                qualifierContent += `                     /note="${feature.note}"\n`;
            }
        }
        
        return qualifierContent;
    }

    // Get correct protein sequence using the same algorithm as Protein FASTA export
    getCorrectProteinSequence(feature) {
        try {
            // Find the chromosome this feature belongs to
            let chromosome = null;
            let sequence = null;
            
            for (const [chr, chrSequence] of Object.entries(this.genomeBrowser.currentSequence)) {
                const features = this.genomeBrowser.currentAnnotations[chr] || [];
                if (features.includes(feature)) {
                    chromosome = chr;
                    sequence = chrSequence;
                    break;
                }
            }
            
            if (!sequence) {
                console.warn('Could not find chromosome for feature, using stored translation');
                return this.genomeBrowser.getQualifierValue(feature.qualifiers, 'translation') || '';
            }
            
            // Use the same algorithm as exportProteinAsFasta
            const cdsSequence = this.extractFeatureSequence(sequence, feature);
            const proteinSequence = this.translateDNA(cdsSequence);
            
            // Remove trailing asterisks (stop codons) from protein sequence
            const cleanProteinSequence = proteinSequence.replace(/\*+$/, '');
            
            return cleanProteinSequence;
        } catch (error) {
            console.warn('Error generating protein sequence:', error);
            // Fallback to stored translation
            const storedTranslation = this.genomeBrowser.getQualifierValue(feature.qualifiers, 'translation');
            return storedTranslation ? storedTranslation.replace(/\*+$/, '') : '';
        }
    }

    // Helper method to wrap long qualifier values
    wrapQualifierValue(value, maxLength) {
        const words = value.split(' ');
        const lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            if ((currentLine + ' ' + word).length <= maxLength) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = word;
            }
        });
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines.length > 0 ? lines : [value];
    }

    // Show export configuration dialog
    showExportConfigDialog() {
        console.log('🔧 Opening export configuration dialog...');
        
        // Remove existing dialog if any
        const existingDialog = document.getElementById('exportConfigDialog');
        if (existingDialog) {
            console.log('Removing existing dialog');
            existingDialog.remove();
        }

        // Create dialog HTML
        const dialogHTML = `
            <div id="exportConfigDialog" class="modal-overlay" style="display: flex; z-index: 15000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5);">
                <div class="modal-content export-config-modal">
                    <div class="modal-header">
                        <h3><i class="fas fa-cog"></i> Export Configuration</h3>
                        <button class="modal-close-btn" onclick="document.getElementById('exportConfigDialog').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="config-section">
                            <h4>GenBank Export Options</h4>
                            <div class="config-option">
                                <label class="config-checkbox">
                                    <input type="checkbox" id="includeProteinSequences" ${this.exportConfig.includeProteinSequences ? 'checked' : ''}>
                                    <span class="checkmark"></span>
                                    <div class="config-option-content">
                                        <strong>Include Protein Sequences</strong>
                                        <p>Export translated protein sequences in /translation qualifiers</p>
                                        <small class="config-note">⚠️ This will significantly increase file size</small>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <div class="config-section">
                            <h4>File Size Impact</h4>
                            <div class="size-impact-info">
                                <div class="size-item">
                                    <span class="size-label">Without proteins:</span>
                                    <span class="size-value">~12-15 MB</span>
                                </div>
                                <div class="size-item">
                                    <span class="size-label">With proteins:</span>
                                    <span class="size-value">~20-26 MB</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('exportConfigDialog').remove()">
                            Cancel
                        </button>
                        <button class="btn btn-primary" onclick="window.genomeBrowser.exportManager.saveExportConfig()">
                            <i class="fas fa-save"></i> Save Configuration
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add dialog to page
        console.log('Adding dialog to page...');
        document.body.insertAdjacentHTML('beforeend', dialogHTML);
        
        // Add styles if not already present
        this.addExportConfigStyles();
        
        console.log('✅ Export configuration dialog opened successfully');
        
        // Verify dialog is visible
        setTimeout(() => {
            const dialog = document.getElementById('exportConfigDialog');
            if (dialog) {
                const rect = dialog.getBoundingClientRect();
                const isVisible = dialog.style.display !== 'none' && 
                                dialog.offsetWidth > 0 && 
                                dialog.offsetHeight > 0;
                console.log(`Dialog visibility check: ${isVisible ? 'VISIBLE' : 'HIDDEN'}`);
                console.log(`Dialog position: top=${rect.top}, left=${rect.left}, width=${rect.width}, height=${rect.height}`);
                console.log(`Dialog z-index: ${window.getComputedStyle(dialog).zIndex}`);
                
                if (!isVisible) {
                    console.warn('⚠️ Dialog created but not visible - checking for issues...');
                    
                    // Force visibility
                    dialog.style.display = 'flex';
                    dialog.style.position = 'fixed';
                    dialog.style.top = '0';
                    dialog.style.left = '0';
                    dialog.style.width = '100vw';
                    dialog.style.height = '100vh';
                    dialog.style.zIndex = '20000';
                    dialog.style.background = 'rgba(0,0,0,0.5)';
                    
                    console.log('🔧 Forced dialog visibility');
                }
            } else {
                console.error('❌ Dialog element not found after creation');
            }
        }, 100);
    }

    // Global function for debugging - can be called from console
    static openExportConfig() {
        if (window.genomeBrowser && window.genomeBrowser.exportManager) {
            window.genomeBrowser.exportManager.showExportConfigDialog();
        } else {
            console.error('GenomeBrowser or ExportManager not available');
        }
    }

    // Save export configuration
    saveExportConfig() {
        const includeProteinCheckbox = document.getElementById('includeProteinSequences');
        
        if (includeProteinCheckbox) {
            this.exportConfig.includeProteinSequences = includeProteinCheckbox.checked;
            
            // Store in localStorage for persistence
            localStorage.setItem('genomeExplorerExportConfig', JSON.stringify(this.exportConfig));
            
            // Show confirmation
            this.genomeBrowser.showNotification(
                `Export configuration saved. Protein sequences: ${this.exportConfig.includeProteinSequences ? 'Enabled' : 'Disabled'}`,
                'success'
            );
        }
        
        // Close dialog
        const dialog = document.getElementById('exportConfigDialog');
        if (dialog) {
            dialog.remove();
        }
    }

    // Load export configuration from localStorage
    loadExportConfig() {
        try {
            const saved = localStorage.getItem('genomeExplorerExportConfig');
            if (saved) {
                this.exportConfig = { ...this.exportConfig, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('Could not load export configuration:', error);
        }
    }

    // Add styles for export config dialog
    addExportConfigStyles() {
        const styleId = 'exportConfigStyles';
        if (document.getElementById(styleId)) return;

        const styles = `
            <style id="${styleId}">
                .modal-overlay {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    background: rgba(0, 0, 0, 0.5) !important;
                    display: flex !important;
                    justify-content: center !important;
                    align-items: center !important;
                    z-index: 15000 !important;
                }
                
                .export-config-modal {
                    max-width: 500px;
                    width: 90%;
                    background: white !important;
                    border-radius: 8px !important;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
                    position: relative !important;
                    z-index: 15001 !important;
                }
                
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #dee2e6;
                    background: #f8f9fa;
                }
                
                .modal-body {
                    padding: 20px;
                }
                
                .modal-footer {
                    padding: 15px 20px;
                    border-top: 1px solid #dee2e6;
                    background: #f8f9fa;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                
                .modal-close-btn {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #666;
                    padding: 5px;
                    border-radius: 4px;
                }
                
                .modal-close-btn:hover {
                    background: rgba(0,0,0,0.1);
                }
                
                .config-section {
                    margin: 20px 0;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border-left: 4px solid #007bff;
                }
                
                .config-section h4 {
                    margin: 0 0 15px 0;
                    color: #333;
                    font-size: 16px;
                }
                
                .config-option {
                    margin: 10px 0;
                }
                
                .config-checkbox {
                    display: flex;
                    align-items: flex-start;
                    cursor: pointer;
                    gap: 12px;
                }
                
                .config-checkbox input[type="checkbox"] {
                    display: none;
                }
                
                .checkmark {
                    width: 20px;
                    height: 20px;
                    background: white;
                    border: 2px solid #ddd;
                    border-radius: 4px;
                    position: relative;
                    flex-shrink: 0;
                    margin-top: 2px;
                }
                
                .config-checkbox input[type="checkbox"]:checked + .checkmark {
                    background: #007bff;
                    border-color: #007bff;
                }
                
                .config-checkbox input[type="checkbox"]:checked + .checkmark::after {
                    content: "✓";
                    position: absolute;
                    color: white;
                    font-size: 14px;
                    top: -2px;
                    left: 3px;
                }
                
                .config-option-content strong {
                    display: block;
                    margin-bottom: 4px;
                    color: #333;
                }
                
                .config-option-content p {
                    margin: 0 0 4px 0;
                    color: #666;
                    font-size: 14px;
                }
                
                .config-note {
                    color: #856404;
                    font-style: italic;
                }
                
                .size-impact-info {
                    background: white;
                    padding: 12px;
                    border-radius: 4px;
                    border: 1px solid #dee2e6;
                }
                
                .size-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                }
                
                .size-label {
                    color: #666;
                }
                
                .size-value {
                    font-weight: bold;
                    color: #333;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    // Export CDS sequences as FASTA
    exportCDSAsFasta() {
        if (!this.genomeBrowser.currentSequence || !this.genomeBrowser.currentAnnotations) {
            alert('No genome data or features loaded to export CDS.');
            return;
        }

        let cdsContent = '';
        const chromosomes = Object.keys(this.genomeBrowser.currentAnnotations);
        const processedFeatures = new Set(); // Track processed features to avoid duplicates

        chromosomes.forEach(chr => {
            const sequence = this.genomeBrowser.currentSequence[chr];
            const features = this.genomeBrowser.currentAnnotations[chr] || [];
            
            features.forEach(feature => {
                // Only process CDS features to avoid duplicates with gene features
                if (feature.type === 'CDS') {
                    // Create unique identifier to avoid duplicates
                    const featureId = `${chr}_${feature.start}_${feature.end}_${feature.strand}`;
                    
                    if (!processedFeatures.has(featureId)) {
                        processedFeatures.add(featureId);
                        
                        const cdsSequence = this.extractFeatureSequence(sequence, feature);
                        const header = `${feature.name || feature.id || 'unknown'}_${chr}_${feature.start}-${feature.end}`;
                        
                        cdsContent += `>${header}\n`;
                        
                        // Split sequence into lines of 80 characters
                        for (let i = 0; i < cdsSequence.length; i += 80) {
                            cdsContent += cdsSequence.substring(i, i + 80) + '\n';
                        }
                    }
                }
            });
        });

        if (!cdsContent) {
            alert('No CDS features found to export.');
            return;
        }

        this.downloadFile(cdsContent, 'cds_sequences.fasta', 'text/plain');
    }

    // Export protein sequences as FASTA
    exportProteinAsFasta() {
        if (!this.genomeBrowser.currentSequence || !this.genomeBrowser.currentAnnotations) {
            alert('No genome data or features loaded to export proteins.');
            return;
        }

        let proteinContent = '';
        const chromosomes = Object.keys(this.genomeBrowser.currentAnnotations);
        const processedFeatures = new Set(); // Track processed features to avoid duplicates

        chromosomes.forEach(chr => {
            const sequence = this.genomeBrowser.currentSequence[chr];
            const features = this.genomeBrowser.currentAnnotations[chr] || [];
            
            features.forEach(feature => {
                // Only process CDS features, skip gene features to avoid duplication
                if (feature.type === 'CDS') {
                    // Create unique identifier to avoid duplicates
                    const featureId = `${chr}_${feature.start}_${feature.end}_${feature.strand}`;
                    
                    if (!processedFeatures.has(featureId)) {
                        processedFeatures.add(featureId);
                        
                        const cdsSequence = this.extractFeatureSequence(sequence, feature);
                        // ExtractFeatureSequence already handles reverse complement, so translate directly
                        const proteinSequence = this.translateDNA(cdsSequence);
                        
                        // Remove trailing asterisks (stop codons) from protein sequence
                        const cleanProteinSequence = proteinSequence.replace(/\*+$/, '');
                        
                        const header = `${feature.name || feature.id || 'unknown'}_${chr}_${feature.start}-${feature.end}`;
                        
                        proteinContent += `>${header}\n`;
                        
                        // Split sequence into lines of 80 characters
                        for (let i = 0; i < cleanProteinSequence.length; i += 80) {
                            proteinContent += cleanProteinSequence.substring(i, i + 80) + '\n';
                        }
                    }
                }
            });
        });

        if (!proteinContent) {
            alert('No protein-coding features found to export.');
            return;
        }

        this.downloadFile(proteinContent, 'protein_sequences.fasta', 'text/plain');
    }

    // Export features as GFF format
    exportAsGFF() {
        if (!this.genomeBrowser.currentAnnotations) {
            alert('No features loaded to export as GFF.');
            return;
        }

        let gffContent = '##gff-version 3\n';
        const chromosomes = Object.keys(this.genomeBrowser.currentAnnotations);

        chromosomes.forEach(chr => {
            const features = this.genomeBrowser.currentAnnotations[chr] || [];
            
            features.forEach((feature, index) => {
                const id = feature.id || feature.name || `feature_${index + 1}`;
                const name = feature.name || id;
                const type = feature.type || 'misc_feature';
                const strand = feature.strand || '+';
                const score = feature.score || '.';
                const phase = feature.phase || '.';
                
                let attributes = `ID=${id}`;
                if (feature.name && feature.name !== id) {
                    attributes += `;Name=${feature.name}`;
                }
                if (feature.product) {
                    attributes += `;product=${feature.product}`;
                }
                if (feature.note) {
                    attributes += `;Note=${feature.note}`;
                }
                
                gffContent += `${chr}\t.\t${type}\t${feature.start}\t${feature.end}\t${score}\t${strand}\t${phase}\t${attributes}\n`;
            });
        });

        this.downloadFile(gffContent, 'features.gff3', 'text/plain');
    }

    // Export features as BED format
    exportAsBED() {
        if (!this.genomeBrowser.currentAnnotations) {
            alert('No features loaded to export as BED.');
            return;
        }

        let bedContent = 'track name="Genome Features" description="Exported genome features"\n';
        const chromosomes = Object.keys(this.genomeBrowser.currentAnnotations);

        chromosomes.forEach(chr => {
            const features = this.genomeBrowser.currentAnnotations[chr] || [];
            
            features.forEach(feature => {
                const name = feature.name || feature.id || 'feature';
                const score = feature.score || 1000;
                const strand = feature.strand || '+';
                
                // BED format: chrom, chromStart (0-based), chromEnd, name, score, strand
                bedContent += `${chr}\t${feature.start - 1}\t${feature.end}\t${name}\t${score}\t${strand}\n`;
            });
        });

        this.downloadFile(bedContent, 'features.bed', 'text/plain');
    }

    // Export current view as FASTA
    exportCurrentViewAsFasta() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
            alert('No chromosome selected or sequence loaded.');
            return;
        }

        const sequence = this.genomeBrowser.currentSequence[currentChr];
        const start = this.genomeBrowser.currentStart || 1;
        const end = this.genomeBrowser.currentEnd || sequence.length;
        
        const viewSequence = sequence.substring(start - 1, end);
        const header = `${currentChr}:${start}-${end}`;
        
        let fastaContent = `>${header}\n`;
        
        // Split sequence into lines of 80 characters
        for (let i = 0; i < viewSequence.length; i += 80) {
            fastaContent += viewSequence.substring(i, i + 80) + '\n';
        }

        this.downloadFile(fastaContent, `${currentChr}_${start}-${end}.fasta`, 'text/plain');
    }

    // Helper method to extract feature sequence
    extractFeatureSequence(sequence, feature) {
        let featureSeq = sequence.substring(feature.start - 1, feature.end);
        
        // Reverse complement if on negative strand
        // Handle both string ('-') and numeric (-1) strand values
        if (feature.strand === '-' || feature.strand === -1) {
            featureSeq = this.reverseComplement(featureSeq);
        }
        
        return featureSeq;
    }

    // Helper method to reverse complement DNA sequence
    reverseComplement(sequence) {
        // Use unified sequence processing implementation
        if (window.UnifiedSequenceProcessing) {
            const result = window.UnifiedSequenceProcessing.legacyReverseComplement(sequence);
            return result;
        }
        
        // Fallback to original implementation if unified module not available
        const complement = {
            'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G',
            'a': 't', 't': 'a', 'g': 'c', 'c': 'g',
            'N': 'N', 'n': 'n'
        };
        
        return sequence
            .split('')
            .reverse()
            .map(base => complement[base] || base)
            .join('');
    }

    // Helper method to translate DNA to protein
    translateDNA(dnaSequence, strand = null) {
        // Use unified translation implementation
        if (window.UnifiedDNATranslation) {
            const result = window.UnifiedDNATranslation.strandBasedTranslateDNA(dnaSequence, strand || 1);
            return result;
        }
        
        // Fallback to original implementation if unified module not available
        const codonTable = {
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
        
        let protein = '';
        for (let i = 0; i < sequence.length - 2; i += 3) {
            const codon = sequence.substring(i, i + 3);
            if (codon.length === 3) {
                protein += codonTable[codon] || 'X';
            }
        }
        
        return protein;
    }

    // Helper method to download file
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    // Enable/disable export menu based on data availability
    updateExportMenuState() {
        const exportBtn = document.getElementById('exportFileBtn');
        const hasData = this.genomeBrowser.currentSequence && 
                       Object.keys(this.genomeBrowser.currentSequence).length > 0;
        
        if (exportBtn) {
            exportBtn.disabled = !hasData;
        }
    }
}

// Make ExportManager globally available for debugging
window.ExportManager = ExportManager;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportManager;
} 