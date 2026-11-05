/**
 * ExportManager - Handles exporting genome data in various formats
 */
class ExportManager {
  constructor(genomeBrowser) {
    this.genomeBrowser = genomeBrowser;
    // Export configuration settings
    this.exportConfig = {
      includeProteinSequences: false, // Default: don't export protein sequences
    };

    // Load saved configuration
    this.loadExportConfig();
  }

  /**
   * Feature types that are managed by PrimerManager (sidecar), not the genome
   * annotations. Genome-format exporters must never emit these.
   */
  static PRIMER_FEATURE_TYPES = new Set(['primer', 'primer_bind']);

  /**
   * Return the annotation features for a chromosome that are safe to write into
   * a genome file. Primers live in the sidecar and are excluded so they never
   * leak back into exported GBK/GFF/BED files.
   * @param {string} chromosome
   * @returns {Array}
   */
  getExportableFeatures(chromosome) {
    const features = this.genomeBrowser.currentAnnotations?.[chromosome] || [];
    return features.filter(feature => {
      const type = String(feature?.type || '').toLowerCase();
      return !ExportManager.PRIMER_FEATURE_TYPES.has(type);
    });
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

    try {
      const { content } = this.buildGenBankExport({
        includeProteinSequences: this.exportConfig.includeProteinSequences,
      });
      this.downloadFile(content, 'genome.gbk', 'text/plain');
    } catch (error) {
      alert(`Failed to export GenBank: ${error.message}`);
    }
  }

  buildGenBankExport(options = {}) {
    const chromosomes = Object.keys(this.genomeBrowser.currentSequence);
    const Exporter = this.getGenBankExporter();
    let totalFeatures = 0;
    const content = new Exporter(this.genomeBrowser).exportGenBank({
      chromosomes,
      getSequence: chromosome => this.genomeBrowser.currentSequence[chromosome],
      getFeatures: chromosome => {
        const features = this.getExportableFeatures(chromosome);
        const selected =
          options.includeFeatures === false ? features.filter(feature => feature.type === 'source') : features;
        totalFeatures += options.includeFeatures === false ? 0 : selected.length;
        return selected;
      },
      options,
    });
    return { content, chromosomes, totalFeatures };
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
        const isVisible = dialog.style.display !== 'none' && dialog.offsetWidth > 0 && dialog.offsetHeight > 0;
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

    try {
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
    } catch (error) {
      alert(`Failed to export CDS FASTA: ${error.message}`);
    }
  }

  // Export protein sequences as FASTA
  exportProteinAsFasta() {
    if (!this.genomeBrowser.currentSequence || !this.genomeBrowser.currentAnnotations) {
      alert('No genome data or features loaded to export proteins.');
      return;
    }

    try {
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

              const cleanProteinSequence = this.extractFeatureProtein(sequence, feature);

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
    } catch (error) {
      alert(`Failed to export protein FASTA: ${error.message}`);
    }
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
      const features = this.getExportableFeatures(chr);

      features.forEach((feature, index) => {
        const id = feature.id || feature.name || `feature_${index + 1}`;
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
      const features = this.getExportableFeatures(chr);

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
    const currentChr = this.genomeBrowser.currentChromosome || document.getElementById('chromosomeSelect')?.value;
    if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
      alert('No chromosome selected or sequence loaded.');
      return;
    }

    const sequence = this.genomeBrowser.currentSequence[currentChr];
    const currentPosition = this.genomeBrowser.currentPosition || {};
    const startIndex = Number.isFinite(currentPosition.start) ? currentPosition.start : 0;
    const endIndex = Number.isFinite(currentPosition.end) ? currentPosition.end : sequence.length;
    const clampedStartIndex = Math.max(0, Math.min(startIndex, sequence.length));
    const clampedEndIndex = Math.max(clampedStartIndex, Math.min(endIndex, sequence.length));
    const start = clampedStartIndex + 1;
    const end = clampedEndIndex;

    const viewSequence = sequence.substring(clampedStartIndex, clampedEndIndex);
    const header = `${currentChr}:${start}-${end}`;

    let fastaContent = `>${header}\n`;

    // Split sequence into lines of 80 characters
    for (let i = 0; i < viewSequence.length; i += 80) {
      fastaContent += viewSequence.substring(i, i + 80) + '\n';
    }

    this.downloadFile(fastaContent, `${currentChr}_${start}-${end}.fasta`, 'text/plain');
  }

  getGenBankExporter() {
    return typeof module !== 'undefined' && module.exports
      ? require('./export/GenBankExporter')
      : window.GenBankExporter;
  }

  extractFeatureSequence(sequence, feature) {
    const Exporter = this.getGenBankExporter();
    return new Exporter(this.genomeBrowser).extractLocationSequence(sequence, feature, value =>
      this.reverseComplement(value)
    );
  }

  extractFeatureProtein(sequence, feature, requestedTable) {
    const first = value => (Array.isArray(value) ? value[0] : value);
    const qualifiers = feature.qualifiers || {};
    const featureTable = Number(first(qualifiers.transl_table) || 1);
    const table = requestedTable === undefined ? featureTable : Number(requestedTable);
    const annotated = String(first(qualifiers.translation) || '').replace(/\s+/g, '');
    if (table === featureTable && /^[A-Z*]+$/i.test(annotated)) return annotated.replace(/\*+$/, '');
    if (table !== 1 || qualifiers.transl_except) {
      throw new Error(`No supported translation is available for ${feature.name || feature.type} (table ${table})`);
    }
    const startCodon = Number(first(qualifiers.codon_start) || 1);
    if (![1, 2, 3].includes(startCodon)) throw new Error(`Invalid codon_start: ${startCodon}`);
    const bases = this.extractFeatureSequence(sequence, feature).slice(startCodon - 1);
    const translator =
      typeof module !== 'undefined' && module.exports
        ? require('./UnifiedDNATranslation')
        : window.UnifiedDNATranslation;
    const result = translator.translateDNA({
      sequence: bases,
      geneticCode: 'standard',
      includeStops: true,
    });
    if (!result.success) throw new Error(result.error);
    return result.protein.replace(/\*+$/, '');
  }

  // Helper method to reverse complement DNA sequence
  reverseComplement(sequence) {
    const processing =
      typeof module !== 'undefined' && module.exports
        ? require('./UnifiedSequenceProcessing')
        : window.UnifiedSequenceProcessing;
    return processing.reverseComplement(sequence, { caseSensitive: false, validateInput: false }).sequence;
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
    const hasData = this.genomeBrowser.currentSequence && Object.keys(this.genomeBrowser.currentSequence).length > 0;

    if (exportBtn) {
      exportBtn.disabled = false;
    }

    [
      'exportFastaBtn',
      'exportGenbankBtn',
      'exportCDSFastaBtn',
      'exportProteinFastaBtn',
      'exportGFFBtn',
      'exportBEDBtn',
      'exportCurrentViewBtn',
    ].forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.disabled = !hasData;
      }
    });
  }
}

// Make ExportManager globally available for debugging
window.ExportManager = ExportManager;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportManager;
}
