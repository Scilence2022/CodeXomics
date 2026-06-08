// @ts-check
/**
 * FileOperationService - Handles all file loading, saving, and export operations
 */
class FileOperationService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  getPathModule() {
    if (typeof window !== 'undefined' && window.path) {
      return window.path;
    }
    return {
      isAbsolute: filePath => /^([A-Za-z]:[\\/]|\/)/.test(String(filePath || '')),
      resolve: (...parts) => {
        const joined = parts.filter(Boolean).join('/');
        const normalized = joined.replace(/\\/g, '/').replace(/\/+/g, '/');
        return /^([A-Za-z]:[\\/]|\/)/.test(normalized) ? normalized : `/${normalized}`;
      },
    };
  }

  isBenchmarkAutomationMode() {
    const sessionId = this.chatManager?.toolExecutionTracker?.currentSessionId || '';
    return this.chatManager?.benchmarkAutomationActive === true || sessionId.startsWith('benchmark');
  }

  requireExplicitFilePathForBenchmark(toolName) {
    if (this.isBenchmarkAutomationMode()) {
      throw new Error(`${toolName} requires an explicit filePath during benchmark automation; file dialogs require user activation.`);
    }
  }

  async validateFilePath(filePath, label = 'File') {
    if (!filePath) {
      throw new Error(`${label} path is required`);
    }

    if (typeof window !== 'undefined' && window.electronAPI?.getSelectedFileInfo) {
      const infoResult = await window.electronAPI.getSelectedFileInfo(filePath);
      if (!infoResult?.success) {
        throw new Error(infoResult?.error || `${label} not found: ${filePath}`);
      }
      if (infoResult.info?.isDirectory) {
        throw new Error(`${label} path is a directory, expected a file: ${filePath}`);
      }
      return infoResult;
    }

    if (typeof window !== 'undefined') {
      throw new Error('electronAPI.getSelectedFileInfo is unavailable in the hardened renderer');
    }

    return { success: true };
  }

  // 1. FILE LOADING OPERATIONS
  async loadGenomeFile(parameters = {}) {
    try {
      const filePath = parameters.filePath || parameters.file_path || parameters.path;
      const { showFileDialog = false, fileType = 'auto' } = parameters;

      if (filePath && (!showFileDialog || this.isBenchmarkAutomationMode())) {
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available');
        }

        await this.validateFilePath(filePath, 'Genome file');

        await this.app.fileManager.loadFile(filePath);

        return {
          success: true,
          message: `Successfully loaded genome file: ${filePath}`,
          filePath: filePath,
          fileType: 'genome',
          tool: 'load_genome_file',
          timestamp: new Date().toISOString(),
        };
      } else {
        this.requireExplicitFilePathForBenchmark('load_genome_file');
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available');
        }

        this.app.fileManager.openSpecificFileType('genome');

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
      console.error('❌ [FileOperationService] loadGenomeFile failed:', error);
      return {
        success: false,
        error: error.message,
        fileType: 'genome',
        tool: 'load_genome_file',
      };
    }
  }

  async loadAnnotationFile(parameters = {}) {
    try {
      // Support both loadMode and mergeWithExisting for compatibility
      const filePath = parameters.filePath || parameters.file_path || parameters.path;
      const {
        showFileDialog = false,
        fileType = 'auto',
        loadMode,
        mergeWithExisting: mergeParam,
      } = parameters;

      // Determine merge strategy
      let mergeWithExisting;
      if (loadMode === 'merge') {
        mergeWithExisting = true;
      } else if (loadMode === 'new_track') {
        mergeWithExisting = false;
      } else if (mergeParam !== undefined) {
        mergeWithExisting = mergeParam;
      }
      // If none specified, leave as undefined so FileManager can show a popup if needed (for manual usage)

      const options = mergeWithExisting !== undefined ? { mergeWithExisting } : {};

      if (filePath && (!showFileDialog || this.isBenchmarkAutomationMode())) {
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available');
        }

        await this.validateFilePath(filePath, 'Annotation file');

        // Load annotation file passing merge options
        await this.app.fileManager.loadFile(filePath, options);

        return {
          success: true,
          message: `Successfully loaded annotation file: ${filePath}${mergeWithExisting ? ' (Merged)' : ' (New Track)'}`,
          filePath: filePath,
          fileType: 'annotation',
          tool: 'load_annotation_file',
          timestamp: new Date().toISOString(),
        };
      } else {
        this.requireExplicitFilePathForBenchmark('load_annotation_file');
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available');
        }

        // Open specific file type passing merge options
        this.app.fileManager.openSpecificFileType('annotation', options);

        return {
          success: true,
          message: `File dialog opened for annotation file selection${mergeWithExisting !== undefined ? (mergeWithExisting ? ' (Merge mode)' : ' (New Track mode)') : ''}`,
          action: 'dialog_opened',
          fileType: 'annotation',
          tool: 'load_annotation_file',
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error('❌ [FileOperationService] loadAnnotationFile failed:', error);
      return {
        success: false,
        error: error.message,
        fileType: 'annotation',
        tool: 'load_annotation_file',
      };
    }
  }

  // 2. DATA EXPORT OPERATIONS
  getExportFilename(parameters = {}, defaultFilename) {
    return (
      parameters.filename ||
      parameters.fileName ||
      parameters.file_name ||
      parameters.filePath ||
      parameters.file_path ||
      parameters.path ||
      parameters.outputPath ||
      parameters.output_path ||
      parameters.savePath ||
      parameters.save_path ||
      defaultFilename
    );
  }

  shouldAutoSaveExport(parameters = {}) {
    return Boolean(
      parameters.auto_save ||
        parameters.autoSave ||
        parameters.filename ||
        parameters.fileName ||
        parameters.file_name ||
        parameters.filePath ||
        parameters.file_path ||
        parameters.path ||
        parameters.outputPath ||
        parameters.output_path ||
        parameters.savePath ||
        parameters.save_path
    );
  }

  async exportFastaSequence(parameters = {}) {
    if (!this.app?.exportManager) throw new Error('Export manager not available');
    if (!this.app.currentSequence || Object.keys(this.app.currentSequence).length === 0) {
      throw new Error('No genome data loaded to export');
    }

    try {
      const chromosomes = Object.keys(this.app.currentSequence);
      let fastaContent = '';
      chromosomes.forEach(chr => {
        const sequence = this.app.currentSequence[chr];
        fastaContent += `>${chr}\n`;
        for (let i = 0; i < sequence.length; i += 80) {
          fastaContent += sequence.substring(i, i + 80) + '\n';
        }
      });

      const outputFilename = this.getExportFilename(parameters, 'genome.fasta');
      let writeResult;
      if (this.shouldAutoSaveExport(parameters)) {
        writeResult = await this.writeFileDirectly(fastaContent, outputFilename, 'FASTA sequence');
      } else {
        writeResult = await this.showExportSaveDialog(fastaContent, outputFilename, 'FASTA sequence', 'text/plain');
      }

      return {
        success: true,
        tool: 'export_fasta_sequence',
        exported_format: 'FASTA',
        filename: outputFilename,
        file_path: writeResult?.filePath || outputFilename,
        filePath: writeResult?.filePath || outputFilename,
        total_chromosomes: chromosomes.length,
        chromosomes: chromosomes,
        total_length: chromosomes.reduce((sum, chr) => sum + this.app.currentSequence[chr].length, 0),
        message: `Successfully exported ${chromosomes.length} chromosome(s) as FASTA`,
        details: `Saved to ${writeResult?.filePath || outputFilename}`,
      };
    } catch (error) {
      throw new Error(`FASTA export failed: ${error.message}`);
    }
  }

  async exportProteinFasta(parameters = {}) {
    const { translationTable = 1 } = parameters;
    if (!this.app?.exportManager) throw new Error('Export manager not available');
    if (!this.app.currentAnnotations || Object.keys(this.app.currentAnnotations).length === 0) {
      throw new Error('No annotation data loaded to export protein sequences');
    }

    try {
      let proteinContent = '';
      const chromosomes = Object.keys(this.app.currentAnnotations);
      const processedFeatures = new Set();

      chromosomes.forEach(chr => {
        const sequence = this.app.currentSequence[chr];
        const features = this.app.currentAnnotations[chr] || [];
        features.forEach(feature => {
          if (feature.type === 'CDS') {
            const featureId = `${chr}_${feature.start}_${feature.end}_${feature.strand}`;
            if (!processedFeatures.has(featureId)) {
              processedFeatures.add(featureId);
              const cdsSequence = this.app.exportManager.extractFeatureSequence(sequence, feature);
              const proteinSequence = this.app.exportManager.translateDNA(cdsSequence);
              const cleanProteinSequence = proteinSequence.replace(/\*+$/, '');
              const header = `${feature.name || feature.id || 'unknown'}_${chr}_${feature.start}-${feature.end}`;
              proteinContent += `>${header}\n`;
              for (let i = 0; i < cleanProteinSequence.length; i += 80) {
                proteinContent += cleanProteinSequence.substring(i, i + 80) + '\n';
              }
            }
          }
        });
      });

      if (!proteinContent) throw new Error('No protein-coding features found to export');

      const outputFilename = this.getExportFilename(parameters, 'protein_sequences.fasta');
      let writeResult;
      if (this.shouldAutoSaveExport(parameters)) {
        writeResult = await this.writeFileDirectly(proteinContent, outputFilename, 'Protein FASTA');
      } else {
        writeResult = await this.showExportSaveDialog(proteinContent, outputFilename, 'Protein FASTA', 'text/plain');
      }

      const proteinCount = chromosomes.reduce((sum, chr) => {
        return sum + (this.app.currentAnnotations[chr] || []).filter(f => f.type === 'CDS').length;
      }, 0);

      return {
        success: true,
        tool: 'export_protein_fasta',
        exported_format: 'Protein FASTA',
        filename: outputFilename,
        file_path: writeResult?.filePath || outputFilename,
        filePath: writeResult?.filePath || outputFilename,
        total_protein_sequences: proteinCount,
        translation_table: translationTable,
        message: `Successfully exported ${proteinCount} protein sequences`,
        details: `Saved to ${writeResult?.filePath || outputFilename}`,
      };
    } catch (error) {
      throw new Error(`Protein FASTA export failed: ${error.message}`);
    }
  }

  async exportCurrentViewFasta(parameters = {}) {
    if (!this.app?.exportManager) throw new Error('Export manager not available');
    if (!this.app.currentSequence || Object.keys(this.app.currentSequence).length === 0) {
      throw new Error('No genome data loaded to export current view');
    }

    try {
      const currentState = this.chatManager.getCurrentState();
      const currentChr = currentState.currentChromosome;
      const viewStart = currentState.currentPosition?.start || 1;
      const viewEnd = currentState.currentPosition?.end || currentState.sequenceLength;

      if (!currentChr) throw new Error('No chromosome selected for current view export');
      const sequence = this.app.currentSequence[currentChr];
      if (!sequence) throw new Error(`Sequence not found for chromosome: ${currentChr}`);

      const viewSequence = sequence.substring(viewStart - 1, viewEnd);
      let fastaContent = `>${currentChr}:${viewStart}-${viewEnd}\n`;
      for (let i = 0; i < viewSequence.length; i += 80) fastaContent += viewSequence.substring(i, i + 80) + '\n';

      const defaultFilename = `${currentChr}_${viewStart}-${viewEnd}.fasta`;
      const outputFilename = this.getExportFilename(parameters, defaultFilename);
      let writeResult;
      if (this.shouldAutoSaveExport(parameters)) {
        writeResult = await this.writeFileDirectly(fastaContent, outputFilename, 'Current view FASTA');
      } else {
        writeResult = await this.showExportSaveDialog(fastaContent, outputFilename, 'Current view FASTA', 'text/plain');
      }

      return {
        success: true,
        tool: 'export_current_view_fasta',
        exported_format: 'FASTA (Current View)',
        filename: outputFilename,
        file_path: writeResult?.filePath || outputFilename,
        filePath: writeResult?.filePath || outputFilename,
        chromosome: currentChr,
        region_start: viewStart,
        region_end: viewEnd,
        region_length: viewEnd - viewStart + 1,
        coordinates: `${currentChr}:${viewStart}-${viewEnd}`,
        message: `Successfully exported current view as FASTA format`,
        details: `Saved to ${writeResult?.filePath || outputFilename}`,
      };
    } catch (error) {
      throw new Error(`Current view FASTA export failed: ${error.message}`);
    }
  }

  async exportGenBankFormat(parameters = {}) {
    if (!this.app?.exportManager) throw new Error('Export manager not available');
    if (!this.app.currentSequence || Object.keys(this.app.currentSequence).length === 0) {
      throw new Error('No genome data loaded to export');
    }

    try {
      const chromosomes = Object.keys(this.app.currentSequence);
      const includeFeatures = parameters.include_features !== false && parameters.includeFeatures !== false;
      const includeSequence = parameters.include_sequence !== false && parameters.includeSequence !== false;
      let totalFeatures = 0;
      let genbankContent = '';
      chromosomes.forEach(chr => {
        const sequence = this.app.currentSequence[chr];
        const features = includeFeatures ? this.app.currentAnnotations?.[chr] || [] : [];
        totalFeatures += features.length;
        genbankContent += `LOCUS       ${chr.padEnd(16)} ${sequence.length} bp    DNA     linear   UNK ${new Date().toISOString().slice(0, 10)}\n`;
        genbankContent += `FEATURES             Location/Qualifiers\n`;
        genbankContent += `     source          1..${sequence.length}\n`;
        features.forEach(feature => {
          const loc =
            feature.strand === '-'
              ? `complement(${feature.start}..${feature.end})`
              : `${feature.start}..${feature.end}`;
          genbankContent += `     ${feature.type.padEnd(15)} ${loc}\n`;
        });
        if (includeSequence) {
          genbankContent += `ORIGIN\n`;
          for (let i = 0; i < sequence.length; i += 60) {
            const lineNum = (i + 1).toString().padStart(9);
            const seqLine = sequence.substring(i, i + 60).toLowerCase();
            const formattedSeq = seqLine.match(/.{1,10}/g)?.join(' ') || seqLine;
            genbankContent += `${lineNum} ${formattedSeq}\n`;
          }
        }
        genbankContent += `//\n\n`;
      });

      const outputFilename = this.getExportFilename(parameters, 'genome.gbk');
      let writeResult;
      if (this.shouldAutoSaveExport(parameters)) {
        writeResult = await this.writeFileDirectly(genbankContent, outputFilename, 'GenBank format');
      } else {
        writeResult = await this.showExportSaveDialog(genbankContent, outputFilename, 'GenBank format', 'text/plain');
      }

      return {
        success: true,
        tool: 'export_genbank_format',
        exported_format: 'GenBank',
        filename: outputFilename,
        file_path: writeResult?.filePath || outputFilename,
        filePath: writeResult?.filePath || outputFilename,
        total_chromosomes: chromosomes.length,
        total_features: totalFeatures,
        include_features: includeFeatures,
        include_sequence: includeSequence,
        include_protein_sequences: false,
        message: `Successfully exported ${chromosomes.length} chromosome(s) in GenBank format`,
        details: `Saved to ${writeResult?.filePath || outputFilename}`,
      };
    } catch (error) {
      throw new Error(`GenBank export failed: ${error.message}`);
    }
  }

  async exportCdsFasta(parameters = {}) {
    try {
      const includeGeneNames = parameters.includeGeneNames !== false && parameters.include_gene_names !== false;
      const chromosomes = Object.keys(this.app.currentSequence || {});
      let cdsContent = '';
      let totalCDS = 0;

      chromosomes.forEach(chr => {
        const features = this.app.currentAnnotations?.[chr] || [];
        const cdsFeatures = features.filter(f => f.type === 'CDS');
        cdsFeatures.forEach(feature => {
          let sequence = this.app.currentSequence[chr].substring(feature.start - 1, feature.end);
          if (feature.strand === '-') {
            sequence = sequence
              .split('')
              .reverse()
              .map(base => ({ A: 'T', T: 'A', C: 'G', G: 'C' })[base] || base)
              .join('');
          }
          cdsContent += `>${feature.attributes?.name || feature.attributes?.ID || 'CDS'}_${chr}:${feature.start}-${feature.end}\n`;
          for (let i = 0; i < sequence.length; i += 80) cdsContent += sequence.substring(i, i + 80) + '\n';
          totalCDS++;
        });
      });

      if (cdsContent === '') throw new Error('No CDS features found to export');

      const outputFilename = this.getExportFilename(parameters, 'cds_sequences.fasta');
      let writeResult;
      if (this.shouldAutoSaveExport(parameters)) {
        writeResult = await this.writeFileDirectly(cdsContent, outputFilename, 'CDS FASTA');
      } else {
        writeResult = await this.showExportSaveDialog(cdsContent, outputFilename, 'CDS FASTA', 'text/plain');
      }

      return {
        success: true,
        tool: 'export_cds_fasta',
        exported_format: 'CDS FASTA',
        count: totalCDS,
        total_cds_sequences: totalCDS,
        include_gene_names: includeGeneNames,
        filename: outputFilename,
        file_path: writeResult?.filePath || outputFilename,
        filePath: writeResult?.filePath || outputFilename,
        message: `Successfully exported ${totalCDS} CDS sequence(s)`,
        details: `Saved to ${writeResult?.filePath || outputFilename}`,
      };
    } catch (error) {
      throw new Error(`CDS export failed: ${error.message}`);
    }
  }

  async exportGffAnnotations(parameters = {}) {
    try {
      const chromosomes = Object.keys(this.app.currentAnnotations || {});
      const featureTypes = new Set();
      let totalFeatures = 0;
      let gffContent = '##gff-version 3\n';
      chromosomes.forEach(chr => {
        const features = this.app.currentAnnotations[chr];
        features.forEach(f => {
          totalFeatures++;
          if (f.type) featureTypes.add(f.type);
          const attrs = Object.entries(f.attributes || {})
            .map(([k, v]) => `${k}=${v}`)
            .join(';');
          gffContent += `${chr}\tCodeXomics\t${f.type}\t${f.start}\t${f.end}\t.\t${f.strand || '+'}\t.\t${attrs}\n`;
        });
      });

      const outputFilename = this.getExportFilename(parameters, 'features.gff3');
      let writeResult;
      if (this.shouldAutoSaveExport(parameters)) {
        writeResult = await this.writeFileDirectly(gffContent, outputFilename, 'GFF annotations');
      } else {
        writeResult = await this.showExportSaveDialog(gffContent, outputFilename, 'GFF annotations', 'text/plain');
      }

      return {
        success: true,
        tool: 'export_gff_annotations',
        exported_format: 'GFF',
        filename: outputFilename,
        file_path: writeResult?.filePath || outputFilename,
        filePath: writeResult?.filePath || outputFilename,
        total_features: totalFeatures,
        feature_types: Array.from(featureTypes),
        message: `Successfully exported ${totalFeatures} annotation feature(s) in GFF format`,
        details: `Saved to ${writeResult?.filePath || outputFilename}`,
      };
    } catch (error) {
      throw new Error(`GFF export failed: ${error.message}`);
    }
  }

  async exportBedFormat(parameters = {}) {
    const {
      export_range = 'all',
      chromosome: filterChromosome,
      start_position,
      end_position,
      include_partial_overlap = true,
      feature_types = ['gene'],
      bed_format = 'bed6',
    } = parameters;

    try {
      const chromosomes = Object.keys(this.app.currentAnnotations || {});
      let bedContent = '';
      let exportedCount = 0;
      const hasRangeFilter = export_range === 'custom_range' && start_position != null && end_position != null;
      const rangeStart = hasRangeFilter ? start_position : null;
      const rangeEnd = hasRangeFilter ? end_position : null;
      const includeAllTypes = feature_types.includes('all');

      const filteredChromosomes =
        filterChromosome && export_range === 'by_chromosome'
          ? chromosomes.filter(chr => chr === filterChromosome)
          : chromosomes;

      filteredChromosomes.forEach(chr => {
        const features = this.app.currentAnnotations[chr];
        if (!features) return;
        features.forEach(f => {
          if (!includeAllTypes && !feature_types.includes(f.type)) return;

          if (hasRangeFilter) {
            if (include_partial_overlap) {
              if (f.end < rangeStart || f.start > rangeEnd) return;
            } else {
              if (f.start < rangeStart || f.end > rangeEnd) return;
            }
          }

          const name = f.attributes?.name || f.attributes?.ID || f.type;
          const score = bed_format === 'bed3' ? '' : `\t0`;
          const strand = bed_format === 'bed3' ? '' : `\t${f.strand || '+'}`;
          bedContent += `${chr}\t${f.start - 1}\t${f.end}\t${name}${score}${strand}\n`;
          exportedCount++;
        });
      });

      if (exportedCount === 0) {
        const rangeInfo = hasRangeFilter ? ` in range ${rangeStart}-${rangeEnd}` : '';
        return { success: false, tool: 'export_bed_format', error: `No features found${rangeInfo}`, exported_count: 0 };
      }

      const outputFilename = this.getExportFilename(parameters, 'features.bed');
      let writeResult;
      if (this.shouldAutoSaveExport(parameters)) {
        writeResult = await this.writeFileDirectly(bedContent, outputFilename, 'BED format');
      } else {
        writeResult = await this.showExportSaveDialog(bedContent, outputFilename, 'BED format', 'text/plain');
      }

      const result = {
        success: true,
        tool: 'export_bed_format',
        exported_format: 'BED',
        filename: outputFilename,
        file_path: writeResult?.filePath || outputFilename,
        filePath: writeResult?.filePath || outputFilename,
        exported_count: exportedCount,
        total_features: exportedCount,
        bed_format,
        include_score: bed_format !== 'bed3',
        include_strand: bed_format !== 'bed3',
        message: `Successfully exported ${exportedCount} feature(s) in BED format`,
        details: `Saved to ${writeResult?.filePath || outputFilename}`,
      };
      if (hasRangeFilter) {
        result.range = { start: rangeStart, end: rangeEnd, include_partial_overlap };
      }
      return result;
    } catch (error) {
      throw new Error(`BED export failed: ${error.message}`);
    }
  }

  async loadVariantFile(parameters = {}) {
    try {
      const filePath = parameters.filePath || parameters.file_path || parameters.path;
      const { showFileDialog = false } = parameters;
      if (filePath && (!showFileDialog || this.isBenchmarkAutomationMode())) {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        await this.validateFilePath(filePath, 'Variant file');
        await this.app.fileManager.loadFile(filePath);
        return {
          success: true,
          message: `Successfully loaded variant file: ${filePath}`,
          filePath,
          fileType: 'variant',
        };
      } else {
        this.requireExplicitFilePathForBenchmark('load_variant_file');
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        this.app.fileManager.openSpecificFileType('variant');
        return {
          success: true,
          message: 'File dialog opened for variant file selection',
          action: 'dialog_opened',
          fileType: 'variant',
        };
      }
    } catch (error) {
      console.error('❌ [FileOperationService] loadVariantFile failed:', error);
      return { success: false, error: error.message, fileType: 'variant' };
    }
  }

  async loadReadsFile(parameters = {}) {
    try {
      const filePath = parameters.filePath || parameters.file_path || parameters.path;
      const { showFileDialog = false } = parameters;
      if (filePath && (!showFileDialog || this.isBenchmarkAutomationMode())) {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        await this.validateFilePath(filePath, 'Reads file');
        await this.app.fileManager.loadFile(filePath);
        return { success: true, message: `Successfully loaded reads file: ${filePath}`, filePath, fileType: 'reads' };
      } else {
        this.requireExplicitFilePathForBenchmark('load_reads_file');
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        this.app.fileManager.openSpecificFileType('reads');
        return {
          success: true,
          message: 'File dialog opened for reads file selection',
          action: 'dialog_opened',
          fileType: 'reads',
        };
      }
    } catch (error) {
      console.error('❌ [FileOperationService] loadReadsFile failed:', error);
      return { success: false, error: error.message, fileType: 'reads' };
    }
  }

  async loadWigTracks(parameters = {}) {
    try {
      const filePaths = parameters.filePaths || parameters.file_paths || parameters.filePath || parameters.file_path;
      const { showFileDialog = false, multiple = true } = parameters;
      if (filePaths && (!showFileDialog || this.isBenchmarkAutomationMode())) {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        const pathsArray = Array.isArray(filePaths) ? filePaths : [filePaths];
        for (const wigPath of pathsArray) {
          await this.validateFilePath(wigPath, 'WIG track file');
        }
        if (pathsArray.length > 1) await this.app.fileManager.loadMultipleWIGFiles(pathsArray);
        else await this.app.fileManager.loadFile(pathsArray[0]);
        return {
          success: true,
          message: `Successfully loaded ${pathsArray.length} WIG track(s)`,
          filePaths: pathsArray,
          fileType: 'wig',
          count: pathsArray.length,
        };
      } else {
        this.requireExplicitFilePathForBenchmark('load_wig_tracks');
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        this.app.fileManager.openSpecificFileType('tracks');
        return {
          success: true,
          message: 'File dialog opened for WIG tracks selection',
          action: 'dialog_opened',
          fileType: 'wig',
          multiple,
        };
      }
    } catch (error) {
      console.error('❌ [FileOperationService] loadWigTracks failed:', error);
      return { success: false, error: error.message, fileType: 'wig' };
    }
  }

  async loadOperonFile(parameters = {}) {
    try {
      const filePath = parameters.filePath || parameters.file_path || parameters.path;
      const { showFileDialog = false, format = 'auto' } = parameters;
      if (filePath && (!showFileDialog || this.isBenchmarkAutomationMode())) {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        await this.validateFilePath(filePath, 'Operon file');
        await this.app.fileManager.loadOperonFile(filePath);
        return {
          success: true,
          message: `Successfully loaded operon file: ${filePath}`,
          filePath,
          fileType: 'operon',
          format,
        };
      } else {
        this.requireExplicitFilePathForBenchmark('load_operon_file');
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        this.app.fileManager.openSpecificFileType('operon');
        return {
          success: true,
          message: 'File dialog opened for operon file selection',
          action: 'dialog_opened',
          fileType: 'operon',
        };
      }
    } catch (error) {
      console.error('❌ [FileOperationService] loadOperonFile failed:', error);
      return { success: false, error: error.message, fileType: 'operon' };
    }
  }

  async downloadInternetFile(parameters = {}) {
    try {
      let {
        url,
        destinationPath,
        destination_path,
        savePath,
        save_path,
        filename,
        fileName,
        file_name,
      } = parameters;
      destinationPath = destinationPath || destination_path || savePath || save_path;
      filename = filename || fileName || file_name;
      if (url) url = url.replace(/[`\s]/g, '');
      console.log(`📥 [FileOperationService] Downloading file from: ${url}`);
      if (!url) throw new Error('URL is required for download');

      // If no explicit destination was given, use the user-configured working directory
      // so the file lands where set_working_directory points, not the system Downloads folder.
      let usingWorkingDirectoryDestination = false;
      if (!destinationPath) {
        destinationPath = this.getCurrentWorkingDirectory();
        usingWorkingDirectoryDestination = true;
        console.log(`📥 [FileOperationService] No destinationPath given; using working directory: ${destinationPath}`);
      }

      if (destinationPath && window.electronAPI?.approveWorkingDirectory) {
        const approvalResult = await window.electronAPI.approveWorkingDirectory(destinationPath);
        if (!approvalResult?.success) {
          const directoryLabel = usingWorkingDirectoryDestination ? 'Working directory' : 'Download destination';
          throw new Error(approvalResult?.error || `${directoryLabel} is not approved: ${destinationPath}`);
        }
        destinationPath = approvalResult.path || destinationPath;
      }

      if (window.electronAPI?.downloadInternetFile) {
        const result = await window.electronAPI.downloadInternetFile({ url, destinationPath, filename });
        if (result.success) {
return {
            success: true,
            message: `Successfully downloaded file to: ${result.filePath}`,
            filePath: result.filePath,
            filename: result.filename,
            fileSize: result.fileSize,
            url,
            tool: 'download_internet_file',
          };
}
        throw new Error(result.error || 'Download failed');
      } else if (window.ipcRenderer) {
        const result = await window.ipcRenderer.invoke('download-internet-file', { url, destinationPath, filename });
        if (result.success) {
return {
            success: true,
            message: `Successfully downloaded file to: ${result.filePath}`,
            filePath: result.filePath,
            filename: result.filename,
            fileSize: result.fileSize,
            url,
            tool: 'download_internet_file',
          };
}
        throw new Error(result.error || 'Download failed');
      } else {
        throw new Error('electronAPI.downloadInternetFile not available');
      }
    } catch (error) {
      console.error('❌ [FileOperationService] downloadInternetFile failed:', error);
      return { success: false, error: error.message, tool: 'download_internet_file' };
    }
  }

  // 3. MCP DOWNLOAD URL CONVERSION
  convertMCPDownloadUrls(text) {
    if (!text || typeof text !== 'string') return text;
    try {
      let baseUrl = 'http://localhost:3000';
      if (this.chatManager.mcpServerManager) {
        const deepGeneServer = this.chatManager.mcpServerManager.servers?.get('deep-gene-research');
        if (deepGeneServer?.url) {
          try {
            const urlObj = new URL(deepGeneServer.url);
            baseUrl = `${urlObj.protocol}//${urlObj.host}`;
          } catch (e) {
            console.warn('Failed to parse MCP server URL:', e);
          }
        }
      }
      text = text.replace(/🔗\s*(\/api\/mcp\/download\/[^\s\n`"<>]+)/g, (m, p) => `🔗 [Download](${baseUrl}${p})`);
      text = text.replace(/(?<!\(|\[|")(\/api\/mcp\/download\/[^\s\n)`"<>]+)/g, (m, p) => `[${p}](${baseUrl}${p})`);
      text = text.replace(/\[([^\]]+)\]\((\/api\/mcp\/[^\s\n)]+)\)/g, (m, l, p) => `[${l}](${baseUrl}${p})`);
      return text;
    } catch (error) {
      console.error('Error converting MCP download URLs:', error);
      return text;
    }
  }

  // 4. EXPORT HELPERS
  async showExportSaveDialog(content, defaultFilename, formatType, mimeType = 'text/plain') {
    try {
      if (window.electronAPI?.showSaveDialog) {
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
          const writeResult = await window.electronAPI.writeFile(result.filePath, content);
          if (writeResult.success) {
            if (this.chatManager.showNotification) {
this.chatManager.showNotification(`${formatType} saved successfully`, 'success');
}
            return { success: true, filePath: result.filePath };
          } else throw new Error(`Failed to write file: ${writeResult.error}`);
        }
        return { success: false, canceled: true };
      } else {
        this.downloadFileAsBrowser(content, defaultFilename, mimeType);
        return { success: true, method: 'browser_download' };
      }
    } catch (error) {
      if (this.chatManager.showNotification) {
this.chatManager.showNotification(`Failed to save ${formatType}: ${error.message}`, 'error');
}
      throw error;
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
  }

  async writeFileDirectly(content, filename, formatType) {
    try {
      // Resolve relative paths against current working directory
      let resolvedPath = filename;
      const pathModule = this.getPathModule();
      if (pathModule && typeof pathModule.isAbsolute === 'function') {
        if (!pathModule.isAbsolute(filename)) {
          const cwd = this.getCurrentWorkingDirectory();
          resolvedPath = pathModule.resolve(cwd, filename);
        }
      }

      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : null;
      if (electronAPI?.writeFile) {
        const result = await electronAPI.writeFile(resolvedPath, content);
        if (!result?.success) {
          throw new Error(result?.error || `Failed to write ${formatType} to ${resolvedPath}`);
        }
        if (this.chatManager.showNotification) {
this.chatManager.showNotification(`${formatType} exported successfully`, 'success');
}
        return { success: true, filePath: result.filePath || resolvedPath };
      } else {
        throw new Error('electronAPI.writeFile is unavailable in the hardened renderer');
      }
    } catch (error) {
      if (this.chatManager.showNotification) {
this.chatManager.showNotification(`Failed to export ${formatType}: ${error.message}`, 'error');
}
      throw error;
    }
  }

  getCurrentWorkingDirectory() {
    if (this.chatManager?.currentWorkingDirectory) {
      return this.chatManager.currentWorkingDirectory;
    }
    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      return process.cwd();
    }
    return '/';
  }

  // Aliases for ToolExecutionService
  async exportCDSFasta(p) {
    return this.exportCdsFasta(p);
  }
  async exportGFFAnnotations(p) {
    return this.exportGffAnnotations(p);
  }
  async exportBEDFormat(p) {
    return this.exportBedFormat(p);
  }
  async exportGenbankFormat(p) {
    return this.exportGenBankFormat(p);
  }
}

window.FileOperationService = FileOperationService;
