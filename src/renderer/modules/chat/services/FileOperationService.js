/**
 * FileOperationService - Handles all file loading, saving, and export operations
 */
class FileOperationService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  // 1. FILE LOADING OPERATIONS
  async loadGenomeFile(parameters = {}) {
    // [ChatManager] ==> loadGenomeFile ENTRY POINT <==
    // [ChatManager] Parameters received

    try {
      const { filePath, showFileDialog = false, fileType = 'auto' } = parameters;

      // [ChatManager] Parsed parameters
      // [ChatManager] App structure check

      // If direct file path is provided and showFileDialog is false, load directly
      if (filePath && !showFileDialog) {
        // [ChatManager] Direct file loading mode

        if (!this.app?.fileManager) {
          const error = 'FileManager not available - app structure missing';
          // [ChatManager] Error
          throw new Error(error);
        }

        // [ChatManager] FileManager available, checking file existence...

        // Validate file exists (basic check)
        if (typeof require !== 'undefined') {
          try {
            const fs = require('fs');
            if (!fs.existsSync(filePath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            // [ChatManager] File exists
          } catch (fsError) {
            // [ChatManager] File system error
            throw fsError;
          }
        } else {
          // [ChatManager] require() not available - skipping file existence check
        }

        // [ChatManager] Calling fileManager.loadFile...

        // Load file directly
        await this.app.fileManager.loadFile(filePath);

        // [ChatManager] fileManager.loadFile completed successfully

        const result = {
          success: true,
          message: `Successfully loaded genome file: ${filePath}`,
          filePath: filePath,
          fileType: 'genome',
          tool: 'load_genome_file',
          timestamp: new Date().toISOString(),
        };

        // [ChatManager] loadGenomeFile result
        return result;
      } else {
        // [ChatManager] File dialog mode

        // Note: Remove benchmark mode special handling for consistent behavior
        // Tool should behave the same way in benchmark mode as in normal mode
        // This ensures accurate benchmark testing and tool detection recording

        // Show file dialog for genome files
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available');
        }

        this.app.fileManager.openSpecificFileType('genome');

        // Enhanced logging for benchmark tool detection recording
        // [ChatManager] TOOL EXECUTED: load_genome_file - File dialog opened

        return {
          success: true,
          message: 'File dialog opened for genome file selection',
          action: 'dialog_opened',
          fileType: 'genome',
          tool: 'load_genome_file',
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      // [ChatManager] CRITICAL ERROR in loadGenomeFile
      // [ChatManager] Error stack

      const errorResult = {
        success: false,
        error: error.message,
        fileType: 'genome',
        tool: 'load_genome_file',
        timestamp: new Date().toISOString(),
        stack: error.stack,
      };

      // [ChatManager] Error result
      return errorResult;
    }
  }

  async loadAnnotationFile(parameters = {}) {
    try {
      const { filePath, showFileDialog = false, fileType = 'auto', mergeWithExisting = false } = parameters;

      // [ChatManager] Loading annotation file

      // If direct file path is provided and showFileDialog is false, load directly
      if (filePath && !showFileDialog) {
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available');
        }

        // Validate file exists (basic check)
        if (typeof require !== 'undefined') {
          const fs = require('fs');
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
          }
        }

        // Load file directly with merge option
        await this.app.fileManager.loadFile(filePath, { mergeWithExisting });

        return {
          success: true,
          message: `Successfully loaded annotation file: ${filePath}`,
          filePath: filePath,
          fileType: 'annotation',
        };
      } else {
        // Note: Remove benchmark mode special handling for consistent behavior
        // Tool should behave the same way in benchmark mode as in normal mode

        // Show file dialog for annotation files
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available');
        }

        this.app.fileManager.openSpecificFileType('annotation');

        return {
          success: true,
          message: 'File dialog opened for annotation file selection',
          action: 'dialog_opened',
          fileType: 'annotation',
        };
      }
    } catch (error) {
      // [ChatManager] Error loading annotation file
      return {
        success: false,
        error: error.message,
        fileType: 'annotation',
      };
    }
  }

  async loadVariantFile(parameters = {}) {
    try {
      const { filePath, showFileDialog = false } = parameters;

      // [ChatManager] Loading variant file

      // If direct file path is provided and showFileDialog is false, load directly
      if (filePath && !showFileDialog) {
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available');
        }

        // Validate file exists (basic check)
        if (typeof require !== 'undefined') {
          const fs = require('fs');
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
          }
        }

        // Load file directly
        await this.app.fileManager.loadFile(filePath);

        return {
          success: true,
          message: `Successfully loaded variant file: ${filePath}`,
          filePath: filePath,
          fileType: 'variant',
        };
      } else {
        // Note: Remove benchmark mode special handling for consistent behavior

        // Show file dialog for variant files
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available');
        }

        this.app.fileManager.openSpecificFileType('variant');

        return {
          success: true,
          message: 'File dialog opened for variant file selection',
          action: 'dialog_opened',
          fileType: 'variant',
        };
      }
    } catch (error) {
      // [ChatManager] Error loading variant file
      return {
        success: false,
        error: error.message,
        fileType: 'variant',
      };
    }
  }

  async loadReadsFile(parameters = {}) {
    try {
      const { filePath, showFileDialog = false } = parameters;
      if (filePath && !showFileDialog) {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        if (typeof require !== 'undefined') {
          const fs = require('fs');
          if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        }
        await this.app.fileManager.loadFile(filePath);
        return { success: true, message: `Successfully loaded reads file: ${filePath}`, filePath, fileType: 'reads' };
      } else {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        this.app.fileManager.openSpecificFileType('reads');
        return { success: true, message: 'File dialog opened for reads file selection', action: 'dialog_opened', fileType: 'reads' };
      }
    } catch (error) {
      return { success: false, error: error.message, fileType: 'reads' };
    }
  }

  async loadWigTracks(parameters = {}) {
    try {
      const { filePaths, showFileDialog = false } = parameters;
      if (filePaths && !showFileDialog) {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        const pathsArray = Array.isArray(filePaths) ? filePaths : [filePaths];
        if (typeof require !== 'undefined') {
          const fs = require('fs');
          for (const fp of pathsArray) {
            if (!fs.existsSync(fp)) throw new Error(`File not found: ${fp}`);
          }
        }
        if (pathsArray.length > 1) {
          await this.app.fileManager.loadMultipleWIGFiles(pathsArray);
        } else {
          await this.app.fileManager.loadFile(pathsArray[0]);
        }
        return { success: true, message: `Successfully loaded ${pathsArray.length} WIG track(s)`, filePaths: pathsArray, fileType: 'wig', count: pathsArray.length };
      } else {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        this.app.fileManager.openSpecificFileType('wig');
        return { success: true, message: 'File dialog opened for WIG file selection', action: 'dialog_opened', fileType: 'wig' };
      }
    } catch (error) {
      return { success: false, error: error.message, fileType: 'wig' };
    }
  }

  async loadOperonFile(parameters = {}) {
    try {
      const { filePath, showFileDialog = false } = parameters;
      if (filePath && !showFileDialog) {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        if (typeof require !== 'undefined') {
          const fs = require('fs');
          if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        }
        await this.app.fileManager.loadOperonFile(filePath);
        return { success: true, message: `Successfully loaded operon file: ${filePath}`, filePath, fileType: 'operon' };
      } else {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        this.app.fileManager.openSpecificFileType('operon');
        return { success: true, message: 'File dialog opened for operon file selection', action: 'dialog_opened', fileType: 'operon' };
      }
    } catch (error) {
      return { success: false, error: error.message, fileType: 'operon' };
    }
  }

  // 2. DATA EXPORT OPERATIONS
  async exportFastaSequence(parameters = {}) {
    const { filename, includeDescription = true } = parameters;

    console.log('🧬 [ChatManager] Exporting FASTA sequence:', parameters);

    if (!this.app || !this.app.exportManager) {
      throw new Error('Export manager not available');
    }

    // Check for genome sequence data - use the correct path
    if (!this.app.currentSequence || Object.keys(this.app.currentSequence).length === 0) {
      throw new Error('No genome data loaded to export');
    }

    try {
      const chromosomes = Object.keys(this.app.currentSequence);
      let fastaContent = '';

      chromosomes.forEach(chr => {
        const sequence = this.app.currentSequence[chr];
        fastaContent += `>${chr}\n`;

        // Split sequence into lines of 80 characters
        for (let i = 0; i < sequence.length; i += 80) {
          fastaContent += sequence.substring(i, i + 80) + '\n';
        }
      });

      // Check if filename is user-provided (not default value)
      const isUserProvidedFilename =
        filename && filename.trim() && filename !== 'sequences.fasta' && filename !== 'genome.fasta';

      if (isUserProvidedFilename) {
        // Direct file export without dialog
        await this.writeFileDirectly(fastaContent, filename, 'FASTA sequence');
      } else {
        // Show file save dialog for user to choose location
        await this.showExportSaveDialog(fastaContent, 'genome.fasta', 'FASTA sequence', 'text/plain');
      }

      const totalLength = chromosomes.reduce((sum, chr) => {
        return sum + this.app.currentSequence[chr].length;
      }, 0);

      return {
        success: true,
        tool: 'export_fasta_sequence',
        timestamp: new Date().toISOString(),
        exported_format: 'FASTA',
        filename: filename || 'genome.fasta',
        chromosomes: chromosomes,
        total_chromosomes: chromosomes.length,
        total_length: totalLength,
        export_method: isUserProvidedFilename ? 'direct' : 'dialog',
        message: `Successfully exported ${chromosomes.length} chromosome(s) as FASTA format`,
        details: `Total sequence length: ${totalLength.toLocaleString()} bp`,
      };
    } catch (error) {
      console.error('❌ [ChatManager] FASTA export failed:', error);
      throw new Error(`FASTA export failed: ${error.message}`);
    }
  }

  async exportGenBankFormat(parameters = {}) {
    const { filename, includeProteinSequences = false } = parameters;

    console.log('📄 [ChatManager] Exporting GenBank format:', parameters);

    if (!this.app || !this.app.exportManager) {
      throw new Error('Export manager not available');
    }

    // Check for genome sequence data - use the correct path
    if (!this.app.currentSequence || Object.keys(this.app.currentSequence).length === 0) {
      throw new Error('No genome data loaded to export');
    }

    try {
      const chromosomes = Object.keys(this.app.currentSequence);
      let genbankContent = '';

      chromosomes.forEach(chr => {
        const sequence = this.app.currentSequence[chr];
        const features = this.app.currentAnnotations[chr] || [];

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
          const location =
            feature.strand === '-'
              ? `complement(${feature.start}..${feature.end})`
              : `${feature.start}..${feature.end}`;

          genbankContent += `     ${feature.type.padEnd(15)} ${location}\n`;

          // Export qualifiers using ExportManager's method
          if (this.app.exportManager.exportFeatureQualifiers) {
            genbankContent += this.app.exportManager.exportFeatureQualifiers(feature);
          }
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

      // Check if filename is user-provided (not default value)
      const isUserProvidedFilename = filename && filename.trim() && filename !== 'genome.gbk';

      if (isUserProvidedFilename) {
        // Direct file export without dialog
        await this.writeFileDirectly(genbankContent, filename, 'GenBank format');
      } else {
        // Show file save dialog for user to choose location
        await this.showExportSaveDialog(genbankContent, 'genome.gbk', 'GenBank format', 'text/plain');
      }

      const totalFeatures = chromosomes.reduce((sum, chr) => {
        const features = this.app.currentAnnotations?.[chr] || [];
        return sum + features.length;
      }, 0);

      return {
        success: true,
        tool: 'export_genbank_format',
        timestamp: new Date().toISOString(),
        exported_format: 'GenBank',
        filename: filename || 'genome.gbk',
        chromosomes: chromosomes,
        total_chromosomes: chromosomes.length,
        total_features: totalFeatures,
        include_protein_sequences: includeProteinSequences,
        export_method: isUserProvidedFilename ? 'direct' : 'dialog',
        message: `Successfully exported ${chromosomes.length} chromosome(s) as GenBank format`,
        details: `Included ${totalFeatures} features${includeProteinSequences ? ' with protein translations' : ''}`,
      };
    } catch (error) {
      console.error('❌ [ChatManager] GenBank export failed:', error);
      throw new Error(`GenBank export failed: ${error.message}`);
    }
  }

  async exportCdsFasta(parameters = {}) {
    const { filename, includeGeneNames = true } = parameters;

    console.log('🧬 [ChatManager] Exporting CDS FASTA:', parameters);

    if (!this.app || !this.app.exportManager) {
      throw new Error('Export manager not available');
    }

    // Check for annotation data - use the correct path
    if (!this.app.currentAnnotations || Object.keys(this.app.currentAnnotations).length === 0) {
      throw new Error('No annotation data loaded to export CDS sequences');
    }

    try {
      let cdsContent = '';
      const chromosomes = Object.keys(this.app.currentAnnotations);
      const processedFeatures = new Set(); // Track processed features to avoid duplicates

      chromosomes.forEach(chr => {
        const sequence = this.app.currentSequence[chr];
        const features = this.app.currentAnnotations[chr] || [];

        features.forEach(feature => {
          // Only process CDS features to avoid duplicates with gene features
          if (feature.type === 'CDS') {
            // Create unique identifier to avoid duplicates
            const featureId = `${chr}_${feature.start}_${feature.end}_${feature.strand}`;

            if (!processedFeatures.has(featureId)) {
              processedFeatures.add(featureId);

              const cdsSequence = this.app.exportManager.extractFeatureSequence(sequence, feature);
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
        throw new Error('No CDS features found to export');
      }

      // Check if filename is user-provided (not default value)
      const isUserProvidedFilename = filename && filename.trim() && filename !== 'cds_sequences.fasta';

      if (isUserProvidedFilename) {
        // Direct file export without dialog
        await this.writeFileDirectly(cdsContent, filename, 'CDS FASTA');
      } else {
        // Show file save dialog for user to choose location
        await this.showExportSaveDialog(cdsContent, 'cds_sequences.fasta', 'CDS FASTA', 'text/plain');
      }

      // Count CDS features using correct data path
      const cdsCount = chromosomes.reduce((sum, chr) => {
        const features = this.app.currentAnnotations[chr] || [];
        return sum + features.filter(f => f.type === 'CDS' || f.type === 'gene').length;
      }, 0);

      return {
        success: true,
        tool: 'export_cds_fasta',
        timestamp: new Date().toISOString(),
        exported_format: 'CDS FASTA',
        filename: filename || 'cds_sequences.fasta',
        chromosomes: chromosomes,
        total_cds_sequences: cdsCount,
        include_gene_names: includeGeneNames,
        export_method: isUserProvidedFilename ? 'direct' : 'dialog',
        message: `Successfully exported ${cdsCount} CDS sequences as FASTA format`,
        details: `Exported from ${chromosomes.length} chromosome(s)`,
      };
    } catch (error) {
      console.error('❌ [ChatManager] CDS FASTA export failed:', error);
      throw new Error(`CDS FASTA export failed: ${error.message}`);
    }
  }

  async exportProteinFasta(parameters = {}) {
    const { filename, includeGeneNames = true, translationTable = 1 } = parameters;

    console.log('🧬 [ChatManager] Exporting Protein FASTA:', parameters);

    if (!this.app || !this.app.exportManager) {
      throw new Error('Export manager not available');
    }

    // Check for annotation data - use the correct path
    if (!this.app.currentAnnotations || Object.keys(this.app.currentAnnotations).length === 0) {
      throw new Error('No annotation data loaded to export protein sequences');
    }

    try {
      let proteinContent = '';
      const chromosomes = Object.keys(this.app.currentAnnotations);
      const processedFeatures = new Set(); // Track processed features to avoid duplicates

      chromosomes.forEach(chr => {
        const sequence = this.app.currentSequence[chr];
        const features = this.app.currentAnnotations[chr] || [];

        features.forEach(feature => {
          // Only process CDS features, skip gene features to avoid duplication
          if (feature.type === 'CDS') {
            // Create unique identifier to avoid duplicates
            const featureId = `${chr}_${feature.start}_${feature.end}_${feature.strand}`;

            if (!processedFeatures.has(featureId)) {
              processedFeatures.add(featureId);

              const cdsSequence = this.app.exportManager.extractFeatureSequence(sequence, feature);
              // ExtractFeatureSequence already handles reverse complement, so translate directly
              const proteinSequence = this.app.exportManager.translateDNA(cdsSequence);

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
        throw new Error('No protein-coding features found to export');
      }

      // Check if filename is user-provided (not default value)
      const isUserProvidedFilename = filename && filename.trim() && filename !== 'protein_sequences.fasta';

      if (isUserProvidedFilename) {
        // Direct file export without dialog
        await this.writeFileDirectly(proteinContent, filename, 'Protein FASTA');
      } else {
        // Show file save dialog for user to choose location
        await this.showExportSaveDialog(proteinContent, 'protein_sequences.fasta', 'Protein FASTA', 'text/plain');
      }

      // Count protein-coding features using correct data path
      const proteinCount = chromosomes.reduce((sum, chr) => {
        const features = this.app.currentAnnotations[chr] || [];
        return (
          sum +
          features.filter(f => {
            return (f.type === 'CDS' || f.type === 'gene') && f.start && f.end && f.start < f.end;
          }).length
        );
      }, 0);

      return {
        success: true,
        tool: 'export_protein_fasta',
        timestamp: new Date().toISOString(),
        exported_format: 'Protein FASTA',
        filename: filename || 'protein_sequences.fasta',
        chromosomes: chromosomes,
        total_protein_sequences: proteinCount,
        translation_table: translationTable,
        include_gene_names: includeGeneNames,
        export_method: isUserProvidedFilename ? 'direct' : 'dialog',
        message: `Successfully exported ${proteinCount} protein sequences as FASTA format`,
        details: `Translated from CDS features using genetic code table ${translationTable}`,
      };
    } catch (error) {
      console.error('❌ [ChatManager] Protein FASTA export failed:', error);
      throw new Error(`Protein FASTA export failed: ${error.message}`);
    }
  }

  async exportGffAnnotations(parameters = {}) {
    const { filename, gffVersion = 3, includeSequences = false } = parameters;

    console.log('📋 [ChatManager] Exporting GFF annotations:', parameters);

    if (!this.app || !this.app.exportManager) {
      throw new Error('Export manager not available');
    }

    // Check for annotation data - use the correct path
    if (!this.app.currentAnnotations || Object.keys(this.app.currentAnnotations).length === 0) {
      throw new Error('No annotation data loaded to export as GFF');
    }

    try {
      let gffContent = `##gff-version ${gffVersion}\n`;
      const chromosomes = Object.keys(this.app.currentAnnotations);

      chromosomes.forEach(chr => {
        const features = this.app.currentAnnotations[chr] || [];

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

      // Check if filename is user-provided (not default value)
      const isUserProvidedFilename = filename && filename.trim() && filename !== 'features.gff3';

      if (isUserProvidedFilename) {
        // Direct file export without dialog
        await this.writeFileDirectly(gffContent, filename, 'GFF annotations');
      } else {
        // Show file save dialog for user to choose location
        await this.showExportSaveDialog(gffContent, 'features.gff3', 'GFF annotations', 'text/plain');
      }

      // Count features using correct data path
      const featureCount = chromosomes.reduce((sum, chr) => {
        const features = this.app.currentAnnotations[chr] || [];
        return sum + features.length;
      }, 0);

      const featureTypes = chromosomes.reduce((types, chr) => {
        const features = this.app.currentAnnotations[chr] || [];
        features.forEach(f => {
          if (f.type && !types.includes(f.type)) {
            types.push(f.type);
          }
        });
        return types;
      }, []);

      return {
        success: true,
        tool: 'export_gff_annotations',
        timestamp: new Date().toISOString(),
        exported_format: `GFF${gffVersion}`,
        filename: filename || 'features.gff3',
        chromosomes: chromosomes,
        total_features: featureCount,
        feature_types: featureTypes,
        gff_version: gffVersion,
        include_sequences: includeSequences,
        export_method: isUserProvidedFilename ? 'direct' : 'dialog',
        message: `Successfully exported ${featureCount} features as GFF${gffVersion} format`,
        details: `Feature types: ${featureTypes.join(', ')}`,
      };
    } catch (error) {
      console.error('❌ [ChatManager] GFF export failed:', error);
      throw new Error(`GFF export failed: ${error.message}`);
    }
  }

  async exportBedFormat(parameters = {}) {
    const { filename, includeScore = true, includeStrand = true } = parameters;

    console.log('📊 [ChatManager] Exporting BED format:', parameters);

    if (!this.app || !this.app.exportManager) {
      throw new Error('Export manager not available');
    }

    // Check for annotation data - use the correct path
    if (!this.app.currentAnnotations || Object.keys(this.app.currentAnnotations).length === 0) {
      throw new Error('No annotation data loaded to export as BED');
    }

    try {
      let bedContent = 'track name="Genome Features" description="Exported genome features"\n';
      const chromosomes = Object.keys(this.app.currentAnnotations);

      chromosomes.forEach(chr => {
        const features = this.app.currentAnnotations[chr] || [];

        features.forEach(feature => {
          const name = feature.name || feature.id || 'feature';
          const score = feature.score || 1000;
          const strand = feature.strand || '+';

          // BED format: chrom, chromStart (0-based), chromEnd, name, score, strand
          bedContent += `${chr}\t${feature.start - 1}\t${feature.end}\t${name}\t${score}\t${strand}\n`;
        });
      });

      // Check if filename is user-provided (not default value)
      const isUserProvidedFilename = filename && filename.trim() && filename !== 'features.bed';

      if (isUserProvidedFilename) {
        // Direct file export without dialog
        await this.writeFileDirectly(bedContent, filename, 'BED format');
      } else {
        // Show file save dialog for user to choose location
        await this.showExportSaveDialog(bedContent, 'features.bed', 'BED format', 'text/plain');
      }

      // Count features using correct data path
      const featureCount = chromosomes.reduce((sum, chr) => {
        const features = this.app.currentAnnotations[chr] || [];
        return sum + features.length;
      }, 0);

      return {
        success: true,
        tool: 'export_bed_format',
        timestamp: new Date().toISOString(),
        exported_format: 'BED',
        filename: filename || 'features.bed',
        chromosomes: chromosomes,
        total_features: featureCount,
        include_score: includeScore,
        include_strand: includeStrand,
        export_method: isUserProvidedFilename ? 'direct' : 'dialog',
        message: `Successfully exported ${featureCount} features as BED format`,
        details: `Browser extensible data format from ${chromosomes.length} chromosome(s)`,
      };
    } catch (error) {
      console.error('❌ [ChatManager] BED export failed:', error);
      throw new Error(`BED export failed: ${error.message}`);
    }
  }

  async exportCurrentViewFasta(parameters = {}) {
    const { filename, includeCoordinates = true } = parameters;

    console.log('👁️ [ChatManager] Exporting current view as FASTA:', parameters);

    if (!this.app || !this.app.exportManager) {
      throw new Error('Export manager not available');
    }

    // Check for genome sequence data - use the correct path
    if (!this.app.currentSequence || Object.keys(this.app.currentSequence).length === 0) {
      throw new Error('No genome data loaded to export current view');
    }

    try {
      // Get current view information
      const currentState = this.chatManager.getCurrentState();
      const currentChr = currentState.currentChromosome;
      const viewStart = currentState.currentPosition?.start || 1;
      const viewEnd = currentState.currentPosition?.end || currentState.sequenceLength;

      if (!currentChr) {
        throw new Error('No chromosome selected for current view export');
      }

      const sequence = this.app.currentSequence[currentChr];
      if (!sequence) {
        throw new Error(`Sequence not found for chromosome: ${currentChr}`);
      }

      const viewSequence = sequence.substring(viewStart - 1, viewEnd);
      const header = `${currentChr}:${viewStart}-${viewEnd}`;

      let fastaContent = `>${header}\n`;

      // Split sequence into lines of 80 characters
      for (let i = 0; i < viewSequence.length; i += 80) {
        fastaContent += viewSequence.substring(i, i + 80) + '\n';
      }

      // Check if filename is user-provided (not default value)
      const defaultCurrentViewFilename = `${currentChr}_${viewStart}-${viewEnd}.fasta`;
      const isUserProvidedFilename = filename && filename.trim() && filename !== defaultCurrentViewFilename;

      if (isUserProvidedFilename) {
        // Direct file export without dialog
        await this.writeFileDirectly(fastaContent, filename, 'Current view FASTA');
      } else {
        // Show file save dialog for user to choose location
        const defaultFilename = `${currentChr}_${viewStart}-${viewEnd}.fasta`;
        await this.showExportSaveDialog(fastaContent, defaultFilename, 'Current view FASTA', 'text/plain');
      }

      const regionLength = viewEnd - viewStart + 1;
      const coordinates = `${currentChr}:${viewStart}-${viewEnd}`;

      return {
        success: true,
        tool: 'export_current_view_fasta',
        timestamp: new Date().toISOString(),
        exported_format: 'FASTA (Current View)',
        filename: filename || `${currentChr}_${viewStart}-${viewEnd}.fasta`,
        chromosome: currentChr,
        region_start: viewStart,
        region_end: viewEnd,
        region_length: regionLength,
        coordinates: coordinates,
        include_coordinates: includeCoordinates,
        export_method: isUserProvidedFilename ? 'direct' : 'dialog',
        message: `Successfully exported current view as FASTA format`,
        details: `Region: ${coordinates} (${regionLength.toLocaleString()} bp)`,
      };
    } catch (error) {
      console.error('❌ [ChatManager] Current view FASTA export failed:', error);
      throw new Error(`Current view FASTA export failed: ${error.message}`);
    }
  }

  // Aliases: ChatManager delegates use these exact names (original casing)
  async exportCDSFasta(parameters = {}) { return this.exportCdsFasta(parameters); }
  async exportGFFAnnotations(parameters = {}) { return this.exportGffAnnotations(parameters); }
  async exportBEDFormat(parameters = {}) { return this.exportBedFormat(parameters); }
  // Alias: ToolExecutionService converts export_genbank_format -> exportGenbankFormat
  async exportGenbankFormat(parameters = {}) { return this.exportGenBankFormat(parameters); }

  // 3. EXPORT HELPERS
  async showExportSaveDialog(content, defaultFilename, formatType, mimeType = 'text/plain') {
    try {
      // Use Electron's save dialog via IPC
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        // Determine appropriate file extensions based on format type
        const extensionMap = {
          'FASTA sequence': [{ name: 'FASTA Files', extensions: ['fasta', 'fa', 'fas'] }],
          'GenBank format': [{ name: 'GenBank Files', extensions: ['gbk', 'gb', 'genbank'] }],
          'CDS FASTA': [{ name: 'FASTA Files', extensions: ['fasta', 'fa', 'fas'] }],
          'Protein FASTA': [{ name: 'FASTA Files', extensions: ['fasta', 'fa', 'fas'] }],
          'GFF annotations': [{ name: 'GFF Files', extensions: ['gff3', 'gff', 'gtf'] }],
          'BED format': [{ name: 'BED Files', extensions: ['bed'] }],
          'Current view FASTA': [{ name: 'FASTA Files', extensions: ['fasta', 'fa', 'fas'] }],
        };

        const filters = extensionMap[formatType] || [{ name: 'Text Files', extensions: ['txt'] }];
        filters.push({ name: 'All Files', extensions: ['*'] });

        const result = await window.electronAPI.showSaveDialog({
          title: `Save ${formatType}`,
          defaultPath: defaultFilename,
          filters: filters,
        });

        if (!result.canceled && result.filePath) {
          // Write the file using IPC
          const writeResult = await window.electronAPI.writeFile(result.filePath, content);

          if (writeResult.success) {
            console.log(`✅ [ChatManager] File saved via dialog: ${result.filePath}`);

            // Show success notification
            if (this.app && this.app.showNotification) {
              this.app.showNotification(`${formatType} saved successfully`, 'success');
            }

            return {
              success: true,
              filePath: result.filePath,
              fileSize: content.length,
              method: 'dialog',
              canceled: false,
            };
          } else {
            throw new Error(`Failed to write file: ${writeResult.error}`);
          }
        } else {
          // User canceled the dialog
          console.log('🚫 [ChatManager] Save dialog canceled by user');
          return {
            success: false,
            canceled: true,
            method: 'dialog',
          };
        }
      } else {
        // Fallback: Use browser download method
        console.log('🔄 [ChatManager] Falling back to browser download');
        this.downloadFileAsBrowser(content, defaultFilename, mimeType);

        return {
          success: true,
          filename: defaultFilename,
          fileSize: content.length,
          method: 'browser_download',
        };
      }
    } catch (error) {
      console.error(`❌ [ChatManager] Save dialog failed:`, error);

      // Show error notification
      if (this.app && this.app.showNotification) {
        this.app.showNotification(`Failed to save ${formatType}: ${error.message}`, 'error');
      }

      throw new Error(`Save dialog failed: ${error.message}`);
    }
  }

  downloadFileAsBrowser(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
    console.log(`💾 [ChatManager] Browser download triggered: ${filename}`);
  }

  async writeFileDirectly(content, filename, formatType) {
    try {
      // Use Electron IPC for secure file operations
      if (window.electronAPI && window.electronAPI.writeFile) {
        // Primary method: Use Electron IPC
        const result = await window.electronAPI.writeFile(filename, content);

        console.log(`✅ [ChatManager] File written via Electron IPC: ${result.filePath}`);

        // Show success notification
        if (this.app && this.app.showNotification) {
          this.app.showNotification(`${formatType} exported successfully to: ${result.fileName}`, 'success');
        }

        return {
          success: true,
          filePath: result.filePath,
          fileSize: content.length,
          method: 'ipc',
        };
      } else {
        // Fallback method: Direct Node.js access (if available)
        const fs = require('fs').promises;
        const path = require('path');

        // Ensure filename has proper extension if not provided
        let finalFilename = filename;
        if (!path.extname(finalFilename)) {
          const extensions = {
            'FASTA sequence': '.fasta',
            'GenBank format': '.gbk',
            'CDS FASTA': '.fasta',
            'Protein FASTA': '.fasta',
            'GFF annotations': '.gff3',
            'BED format': '.bed',
            'Current view FASTA': '.fasta',
          };
          const ext = extensions[formatType] || '.txt';
          finalFilename += ext;
        }

        // Resolve to absolute path if relative path provided
        const absolutePath = path.resolve(finalFilename);

        // Write file directly
        await fs.writeFile(absolutePath, content, 'utf8');

        console.log(`✅ [ChatManager] File written directly: ${absolutePath}`);

        // Show success notification
        if (this.app && this.app.showNotification) {
          this.app.showNotification(
            `${formatType} exported successfully to: ${path.basename(absolutePath)}`,
            'success'
          );
        }

        return {
          success: true,
          filePath: absolutePath,
          fileSize: content.length,
          method: 'direct',
        };
      }
    } catch (error) {
      console.error(`❌ [ChatManager] Direct file write failed:`, error);

      // Show error notification
      if (this.app && this.app.showNotification) {
        this.app.showNotification(`Failed to export ${formatType}: ${error.message}`, 'error');
      }

      throw new Error(`Failed to write file directly: ${error.message}`);
    }
  }

  // 4. WORKSPACE MANAGEMENT
  getCurrentWorkingDirectory() {
    return this.chatManager.currentWorkingDirectory || process.cwd();
  }
}

// Make it available globally if needed by plugin system
window.FileOperationService = FileOperationService;
