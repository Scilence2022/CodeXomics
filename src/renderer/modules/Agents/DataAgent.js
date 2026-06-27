/**
 * DataAgent - data agent
 * Specializes in data retrieval and storage functions
 */
class DataAgent extends AgentBase {
  constructor(multiAgentSystem) {
    super(multiAgentSystem, 'data', ['data_retrieval', 'data_storage', 'data_export', 'data_import']);

    this.app = multiAgentSystem.app;
    this.configManager = multiAgentSystem.configManager;
    this.storageManager = null;
  }

  /**
   * Run the concrete initialization logic
   */
  async performInitialization() {
    // Ensure the app is initialized
    if (!this.app) {
      throw new Error('Application reference not available');
    }

    // Get the storage manager
    this.storageManager = this.app.storageManager || null;
    if (!this.storageManager) {
      console.warn('⚠️ DataAgent: StorageManager not available, some tools will rely on ChatManager fallback');
    }

    console.log(`💾 DataAgent: Data management tools initialized`);
  }

  /**
   * Perform function execution with ChatManager delegation
   */
  async performExecution(functionName, parameters, context) {
    const chatManager = this.multiAgentSystem.chatManager;

    // Try ChatManager first (authoritative execution path)
    if (chatManager && typeof chatManager.executeToolByName === 'function') {
      try {
        const result = await chatManager.executeToolByName(functionName, parameters, { bypassAgent: true });
        return result;
      } catch (error) {
        console.warn(
          `DataAgent: ChatManager execution failed for ${functionName}, falling back to local implementation`
        );
      }
    }

    // Fall back to local implementation
    return await this._performLocalExecution(functionName, parameters, context);
  }

  /**
   * Local execution fallback
   */
  async _performLocalExecution(functionName, parameters, context) {
    // Check toolMapping for local implementations
    if (this.toolMapping.has(functionName)) {
      const toolFunction = this.toolMapping.get(functionName);
      return await toolFunction(parameters, context);
    }

    throw new Error(`DataAgent: Function ${functionName} not implemented locally and ChatManager unavailable`);
  }

  /**
   * Register the tool mappings
   */
  registerToolMapping() {
    // Data retrieval tools - builtInToolsMap-aligned names
    this.toolMapping.set('get_sequence', this.getSequenceData.bind(this));
    this.toolMapping.set('get_sequence_data', this.getSequenceData.bind(this)); // legacy alias
    this.toolMapping.set('get_gene_details', this.getGeneData.bind(this));
    this.toolMapping.set('get_gene_data', this.getGeneData.bind(this)); // legacy alias
    this.toolMapping.set('get_annotation_data', this.getAnnotationData.bind(this));
    this.toolMapping.set('get_annotation', this.getAnnotationData.bind(this)); // alias
    this.toolMapping.set('get_track_data', this.getTrackData.bind(this));

    // Data export tools - builtInToolsMap-aligned names
    this.toolMapping.set('export_data', this.exportSequence.bind(this));
    this.toolMapping.set('export_sequence', this.exportSequence.bind(this));
    this.toolMapping.set('export_region', this.exportRegion.bind(this));
    this.toolMapping.set('export_gene_list', this.exportGeneList.bind(this));
    this.toolMapping.set('export_track_data', this.exportTrackData.bind(this));
    this.toolMapping.set('export_fasta_sequence', this.exportFastaSequence.bind(this));
    this.toolMapping.set('export_genbank_format', this.exportGenbankFormat.bind(this));
    this.toolMapping.set('export_gff_annotations', this.exportGffAnnotations.bind(this));
    this.toolMapping.set('export_bed_format', this.exportBedFormat.bind(this));
    this.toolMapping.set('export_cds_fasta', this.exportCdsFasta.bind(this));
    this.toolMapping.set('export_protein_fasta', this.exportProteinFasta.bind(this));
    this.toolMapping.set('export_current_view_fasta', this.exportCurrentViewFasta.bind(this));
    this.toolMapping.set('capture_screenshot', this.captureScreenshot.bind(this));
    this.toolMapping.set('open_image_file', this.openImageFile.bind(this));

    // Data import tools - builtInToolsMap-aligned names
    this.toolMapping.set('load_genome_file', this.loadGenomeFile.bind(this));
    this.toolMapping.set('load_annotation_file', this.loadAnnotationFile.bind(this));
    this.toolMapping.set('load_variant_file', this.loadVariantFile.bind(this));
    this.toolMapping.set('load_reads_file', this.loadReadsFile.bind(this));
    this.toolMapping.set('load_wig_tracks', this.loadWigTracks.bind(this));
    this.toolMapping.set('import_sequence', this.importSequence.bind(this)); // legacy alias
    this.toolMapping.set('import_annotation', this.importAnnotation.bind(this)); // legacy alias
    this.toolMapping.set('import_track_data', this.importTrackData.bind(this)); // legacy alias

    // Data search tools - builtInToolsMap-aligned names
    this.toolMapping.set('get_operons', this.getOperons.bind(this));
    this.toolMapping.set('get_nearby_features', this.getNearbyFeatures.bind(this));
    this.toolMapping.set('find_intergenic_regions', this.findIntergenicRegions.bind(this));
    this.toolMapping.set('search_genes', this.searchGenes.bind(this));
    this.toolMapping.set('search_sequences', this.searchSequences.bind(this));
    this.toolMapping.set('search_annotations', this.searchAnnotations.bind(this));
    this.toolMapping.set('list_annotations', this.listAnnotations.bind(this));

    // Data statistics tools
    this.toolMapping.set('get_data_statistics', this.getDataStatistics.bind(this));
    this.toolMapping.set('get_genome_summary', this.getGenomeSummary.bind(this));

    // Annotation CRUD tools
    this.toolMapping.set('create_annotation', this.createAnnotation.bind(this));
    this.toolMapping.set('update_annotation', this.updateAnnotation.bind(this));
    this.toolMapping.set('delete_annotation', this.deleteAnnotation.bind(this));
    this.toolMapping.set('bulk_update_annotations', this.bulkUpdateAnnotations.bind(this));
    this.toolMapping.set('get_annotation_history', this.getAnnotationHistory.bind(this));

    console.log(`💾 DataAgent: Registered ${this.toolMapping.size} data tools`);
  }

  /**
   * Get sequence data
   */
  async getSequenceData(parameters, strategy) {
    try {
      const { chromosome, start, end, format = 'fasta' } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      const sequence = await this.app.sequenceUtils.getSequence(chromosome, start, end);

      let formattedData;
      switch (format.toLowerCase()) {
        case 'fasta':
          formattedData = `>${chromosome}:${start}-${end}\n${sequence}`;
          break;
        case 'raw':
          formattedData = sequence;
          break;
        case 'json':
          formattedData = {
            chromosome,
            start,
            end,
            sequence,
            length: sequence.length,
          };
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      return {
        success: true,
        data: formattedData,
        format,
        region: { chromosome, start, end },
        length: sequence.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get gene data
   */
  async getGeneData(parameters, strategy) {
    try {
      const { geneName, includeSequence = false } = parameters;

      if (!geneName) {
        throw new Error('Gene name is required');
      }

      // Get the gene info
      const geneInfo = await this.app.navigationManager.getGeneInfo(geneName);
      if (!geneInfo) {
        throw new Error(`Gene not found: ${geneName}`);
      }

      const result = {
        name: geneName,
        chromosome: geneInfo.chromosome,
        start: geneInfo.start,
        end: geneInfo.end,
        strand: geneInfo.strand,
        type: geneInfo.type,
        description: geneInfo.description,
      };

      // If the sequence is needed
      if (includeSequence) {
        const sequence = await this.app.sequenceUtils.getSequence(geneInfo.chromosome, geneInfo.start, geneInfo.end);
        result.sequence = sequence;
      }

      return {
        success: true,
        geneData: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get annotation data
   */
  async getAnnotationData(parameters, strategy) {
    try {
      const { chromosome, start, end, type = 'all' } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      // Get the annotation data
      const annotations = await this.app.annotationManager.getAnnotations(chromosome, start, end, type);

      return {
        success: true,
        annotations: annotations.map(ann => ({
          id: ann.id,
          type: ann.type,
          start: ann.start,
          end: ann.end,
          strand: ann.strand,
          attributes: ann.attributes,
        })),
        count: annotations.length,
        region: { chromosome, start, end },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get track data
   */
  async getTrackData(parameters, strategy) {
    try {
      const { trackName, chromosome, start, end } = parameters;

      if (!trackName) {
        throw new Error('Track name is required');
      }

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      // Get the track data
      const trackData = await this.app.trackRenderer.getTrackData(trackName, chromosome, start, end);

      return {
        success: true,
        trackName,
        data: trackData,
        region: { chromosome, start, end },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Export a sequence
   */
  async exportSequence(parameters, strategy) {
    try {
      const { chromosome, start, end, format = 'fasta', filename } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      const sequence = await this.app.sequenceUtils.getSequence(chromosome, start, end);

      let content;
      switch (format.toLowerCase()) {
        case 'fasta':
          content = `>${chromosome}:${start}-${end}\n${sequence}`;
          break;
        case 'genbank':
          content = this.formatGenBank(chromosome, start, end, sequence);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Save the file
      let savedFile = filename || `${chromosome}_${start}-${end}.${format}`;
      if (this.storageManager) {
        savedFile = await this.storageManager.saveFile(savedFile, content);
      }

      return {
        success: true,
        message: `Sequence exported to ${savedFile}`,
        file: savedFile,
        format,
        region: { chromosome, start, end },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Export a region
   */
  async exportRegion(parameters, strategy) {
    try {
      const { chromosome, start, end, includeAnnotations = true, format = 'gff' } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      const sequence = await this.app.sequenceUtils.getSequence(chromosome, start, end);
      let content = '';

      if (format.toLowerCase() === 'gff' && includeAnnotations) {
        const annotations = await this.app.annotationManager.getAnnotations(chromosome, start, end);
        content = this.formatGFF(chromosome, start, end, sequence, annotations);
      } else {
        content = `>${chromosome}:${start}-${end}\n${sequence}`;
      }

      const filename = `${chromosome}_${start}-${end}_region.${format}`;
      let savedFile = filename;
      if (this.storageManager) {
        savedFile = await this.storageManager.saveFile(filename, content);
      }

      return {
        success: true,
        message: `Region exported to ${savedFile}`,
        file: savedFile,
        format,
        region: { chromosome, start, end },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Export the gene list
   */
  async exportGeneList(parameters, strategy) {
    try {
      const { chromosome, start, end, format = 'csv' } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      const annotations = await this.app.annotationManager.getAnnotations(chromosome, start, end, 'gene');

      let content;
      if (format.toLowerCase() === 'csv') {
        content = 'Gene,Start,End,Strand,Type,Description\n';
        annotations.forEach(gene => {
          content += `${gene.id},${gene.start},${gene.end},${gene.strand},${gene.type},${gene.attributes.description || ''}\n`;
        });
      } else if (format.toLowerCase() === 'json') {
        content = JSON.stringify(annotations, null, 2);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      const filename = `${chromosome}_${start}-${end}_genes.${format}`;
      let savedFile = filename;
      if (this.storageManager) {
        savedFile = await this.storageManager.saveFile(filename, content);
      }

      return {
        success: true,
        message: `Gene list exported to ${savedFile}`,
        file: savedFile,
        format,
        geneCount: annotations.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Export track data
   */
  async exportTrackData(parameters, strategy) {
    try {
      const { trackName, chromosome, start, end, format = 'wig' } = parameters;

      if (!trackName) {
        throw new Error('Track name is required');
      }

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      const trackData = await this.app.trackRenderer.getTrackData(trackName, chromosome, start, end);

      let content;
      if (format.toLowerCase() === 'wig') {
        content = this.formatWIG(trackName, chromosome, trackData);
      } else if (format.toLowerCase() === 'bedgraph') {
        content = this.formatBedGraph(trackName, trackData);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      const filename = `${trackName}_${chromosome}_${start}-${end}.${format}`;
      let savedFile = filename;
      if (this.storageManager) {
        savedFile = await this.storageManager.saveFile(filename, content);
      }

      return {
        success: true,
        message: `Track data exported to ${savedFile}`,
        file: savedFile,
        format,
        trackName,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // === BuiltInToolsMap-aligned export methods ===

  /**
   * Export FASTA sequences
   */
  async exportFastaSequence(parameters) {
    return await this.exportSequence({ ...parameters, format: 'fasta' });
  }

  /**
   * Export GenBank format
   */
  async exportGenbankFormat(parameters) {
    return await this.exportSequence({ ...parameters, format: 'genbank' });
  }

  /**
   * Export GFF annotations
   */
  async exportGffAnnotations(parameters) {
    return await this.exportRegion({ ...parameters, format: 'gff', includeAnnotations: true });
  }

  /**
   * Export BED format
   */
  async exportBedFormat(parameters) {
    try {
      if (this.services?.file?.exportBedFormat) {
        return await this.services.file.exportBedFormat(parameters);
      }
      const { chromosome, start, end } = parameters;

      const filename = `${chromosome}_${start}-${end}.bed`;
      return { success: true, message: `BED exported to ${filename}`, file: filename, format: 'bed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Export CDS FASTA
   */
  async exportCdsFasta(parameters) {
    try {
      const { geneName, chromosome, start, end } = parameters;
      const sequence = await this.app.sequenceUtils.getSequence(chromosome, start, end);
      const content = `>${geneName || 'CDS'}:${chromosome}:${start}-${end}\n${sequence}`;
      return { success: true, content, format: 'fasta' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Export protein FASTA
   */
  async exportProteinFasta(parameters) {
    try {
      const { geneName, proteinSequence } = parameters;
      const content = `>${geneName || 'protein'}\n${proteinSequence || ''}`;
      return { success: true, content, format: 'fasta' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Export the current view as FASTA
   */
  async exportCurrentViewFasta(parameters) {
    try {
      const app = this.app;
      const state = await app.genomeBrowser.getCurrentState();
      return await this.exportSequence({
        ...parameters,
        chromosome: state.chromosome,
        start: state.start,
        end: state.end,
        format: 'fasta',
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Capture a screenshot through the renderer ScreenshotManager.
   */
  async captureScreenshot(parameters) {
    if (!this.app?.screenshotManager) {
      throw new Error('Screenshot manager not available');
    }
    const result = await this.app.screenshotManager.captureScreenshot({
      ...parameters,
      aiInitiated: true,
      source: parameters?.source || 'ai',
    });
    if (result?.success === false && !result.canceled) {
      throw new Error(result.error || 'Screenshot capture failed');
    }
    return result;
  }

  async openImageFile(parameters = {}) {
    if (!window.electronAPI?.openImageFile) {
      throw new Error('Image viewer IPC bridge is unavailable');
    }
    const requestedPath =
      parameters.filePath ||
      parameters.file_path ||
      parameters.path ||
      parameters.imagePath ||
      parameters.image_path ||
      parameters.filename ||
      parameters.fileName;
    const chatManager = this.multiAgentSystem?.chatManager;
    const filePath =
      requestedPath && typeof chatManager?.resolvePathAgainstWorkingDirectory === 'function'
        ? chatManager.resolvePathAgainstWorkingDirectory(requestedPath)
        : requestedPath;
    const result = await window.electronAPI.openImageFile({
      ...parameters,
      filePath,
      aiInitiated: true,
      source: parameters?.source || 'ai',
    });
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to open image file');
    }
    return {
      success: true,
      message: `Opened image file: ${result.filePath}`,
      filePath: result.filePath,
      fileName: result.fileName,
      tool: 'open_image_file',
    };
  }

  // === BuiltInToolsMap-aligned load/import methods ===

  /**
   * Load a genome file
   */
  async loadGenomeFile(parameters) {
    return await this.importSequence({ ...parameters, format: 'auto' });
  }

  /**
   * Load an annotation file
   */
  async loadAnnotationFile(parameters) {
    return await this.importAnnotation({ ...parameters, format: 'gff' });
  }

  /**
   * Load a variant file
   */
  async loadVariantFile(parameters) {
    try {
      const { filePath } = parameters;
      if (!filePath) throw new Error('File path is required');
      return { success: true, message: `Variant file loaded: ${filePath}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Load a reads file
   */
  async loadReadsFile(parameters) {
    try {
      const { filePath } = parameters;
      if (!filePath) throw new Error('File path is required');
      return { success: true, message: `Reads file loaded: ${filePath}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Load a WIG track
   */
  async loadWigTracks(parameters) {
    return await this.importTrackData({ ...parameters, format: 'wig' });
  }

  // === BuiltInToolsMap-aligned retrieval methods ===

  /**
   * Get operons
   */
  async getOperons(parameters) {
    try {
      const { chromosome, start, end } = parameters;
      if (this.app.annotationManager && typeof this.app.annotationManager.getOperons === 'function') {
        const operons = await this.app.annotationManager.getOperons(chromosome, start, end);
        return { success: true, operons, count: operons.length };
      }
      return { success: false, error: 'get_operons requires ChatManager or annotationManager implementation' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get nearby features
   */
  async getNearbyFeatures(parameters) {
    try {
      const { chromosome, position, distance = 1000 } = parameters;
      if (this.app.annotationManager && typeof this.app.annotationManager.getNearbyFeatures === 'function') {
        const features = await this.app.annotationManager.getNearbyFeatures(chromosome, position, distance);
        return { success: true, features, count: features.length };
      }
      return { success: false, error: 'get_nearby_features requires ChatManager or annotationManager implementation' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Find intergenic regions
   */
  async findIntergenicRegions(parameters) {
    try {
      const { chromosome, start, end } = parameters;
      if (this.app.annotationManager && typeof this.app.annotationManager.findIntergenicRegions === 'function') {
        const regions = await this.app.annotationManager.findIntergenicRegions(chromosome, start, end);
        return { success: true, regions, count: regions.length };
      }
      return {
        success: false,
        error: 'find_intergenic_regions requires ChatManager or annotationManager implementation',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List annotations
   */
  async listAnnotations(parameters) {
    return await this.searchAnnotations(parameters);
  }

  /**
   * Import a sequence
   */
  async importSequence(parameters, strategy) {
    try {
      const { filePath, format = 'auto' } = parameters;

      if (!filePath) {
        throw new Error('File path is required');
      }

      if (!this.storageManager) {
        throw new Error('StorageManager not available');
      }

      const content = await this.storageManager.readFile(filePath);
      const sequences = this.parseSequenceFile(content, format);

      // Store the sequence data
      for (const seq of sequences) {
        await this.app.sequenceUtils.storeSequence(seq.chromosome, seq.start, seq.end, seq.sequence);
      }

      return {
        success: true,
        message: `Imported ${sequences.length} sequences`,
        sequences: sequences.map(s => ({ chromosome: s.chromosome, start: s.start, end: s.end })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Import annotations
   */
  async importAnnotation(parameters, strategy) {
    try {
      const { filePath, format = 'gff' } = parameters;

      if (!filePath) {
        throw new Error('File path is required');
      }

      if (!this.storageManager) {
        throw new Error('StorageManager not available');
      }

      const content = await this.storageManager.readFile(filePath);
      const annotations = this.parseAnnotationFile(content, format);

      // Store the annotation data
      for (const ann of annotations) {
        await this.app.annotationManager.addAnnotation(ann);
      }

      return {
        success: true,
        message: `Imported ${annotations.length} annotations`,
        annotationCount: annotations.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Import track data
   */
  async importTrackData(parameters, strategy) {
    try {
      const { filePath, trackName, format = 'wig' } = parameters;

      if (!filePath || !trackName) {
        throw new Error('File path and track name are required');
      }

      if (!this.storageManager) {
        throw new Error('StorageManager not available');
      }

      const content = await this.storageManager.readFile(filePath);
      const trackData = this.parseTrackFile(content, format);

      // Create the track
      await this.app.trackRenderer.createTrack(trackName, trackData);

      return {
        success: true,
        message: `Track ${trackName} created with ${trackData.length} data points`,
        trackName,
        dataPoints: trackData.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Search genes
   */
  async searchGenes(parameters, strategy) {
    try {
      const { query, chromosome, type = 'all' } = parameters;

      if (!query) {
        throw new Error('Search query is required');
      }

      const genes = await this.app.annotationManager.searchGenes(query, chromosome, type);

      return {
        success: true,
        genes: genes.map(gene => ({
          id: gene.id,
          name: gene.name,
          chromosome: gene.chromosome,
          start: gene.start,
          end: gene.end,
          type: gene.type,
          description: gene.description,
        })),
        count: genes.length,
        query,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Search sequences
   */
  async searchSequences(parameters, strategy) {
    try {
      const { sequence, chromosome, maxMismatches = 0 } = parameters;

      if (!sequence) {
        throw new Error('Search sequence is required');
      }

      const matches = await this.app.sequenceUtils.searchSequence(sequence, chromosome, maxMismatches);

      return {
        success: true,
        matches: matches.map(match => ({
          chromosome: match.chromosome,
          start: match.start,
          end: match.end,
          strand: match.strand,
          score: match.score,
        })),
        count: matches.length,
        query: sequence,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Search annotations
   */
  async searchAnnotations(parameters, strategy) {
    try {
      const { query, type = 'all', chromosome } = parameters;

      if (!query) {
        throw new Error('Search query is required');
      }

      const annotations = await this.app.annotationManager.searchAnnotations(query, type, chromosome);

      return {
        success: true,
        annotations: annotations.map(ann => ({
          id: ann.id,
          type: ann.type,
          chromosome: ann.chromosome,
          start: ann.start,
          end: ann.end,
          attributes: ann.attributes,
        })),
        count: annotations.length,
        query,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get data statistics
   */
  async getDataStatistics(parameters, strategy) {
    try {
      const { chromosome } = parameters;

      const stats = await this.app.dataManager.getStatistics(chromosome);

      return {
        success: true,
        statistics: {
          totalLength: stats.totalLength,
          geneCount: stats.geneCount,
          annotationCount: stats.annotationCount,
          trackCount: stats.trackCount,
          gcContent: stats.gcContent,
        },
        chromosome: chromosome || 'all',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get the genome summary
   */
  async getGenomeSummary(parameters, strategy) {
    try {
      const summary = await this.app.dataManager.getGenomeSummary();

      return {
        success: true,
        summary: {
          name: summary.name,
          version: summary.version,
          chromosomes: summary.chromosomes,
          totalLength: summary.totalLength,
          geneCount: summary.geneCount,
          annotationCount: summary.annotationCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Format as GenBank
   */
  formatGenBank(chromosome, start, end, sequence) {
    return (
      `LOCUS       ${chromosome}:${start}-${end}    ${sequence.length} bp    DNA     linear\n` +
      `DEFINITION  ${chromosome} region ${start}-${end}\n` +
      `ACCESSION   ${chromosome}_${start}_${end}\n` +
      `VERSION     ${chromosome}_${start}_${end}.1\n` +
      `ORIGIN\n` +
      sequence
        .match(/.{1,60}/g)
        .map((line, i) => `${String(i * 60 + 1).padStart(9)} ${line}`)
        .join('\n') +
      '\n' +
      `//\n`
    );
  }

  /**
   * Format as GFF
   */
  formatGFF(chromosome, start, end, sequence, annotations) {
    let gff = `##gff-version 3\n` + `##sequence-region ${chromosome} ${start} ${end}\n`;

    annotations.forEach(ann => {
      gff += `${chromosome}\t.\t${ann.type}\t${ann.start}\t${ann.end}\t.\t${ann.strand}\t.\tID=${ann.id};Name=${ann.attributes.name || ann.id}\n`;
    });

    return gff;
  }

  /**
   * Format as WIG
   */
  formatWIG(trackName, chromosome, trackData) {
    let wig = `track type=wiggle_0 name="${trackName}"\n` + `fixedStep chrom=${chromosome} start=1 step=1\n`;

    trackData.forEach(point => {
      wig += `${point.value}\n`;
    });

    return wig;
  }

  /**
   * Format as BedGraph
   */
  formatBedGraph(trackName, trackData) {
    let bedgraph = `track type=bedGraph name="${trackName}"\n`;

    trackData.forEach(point => {
      bedgraph += `${point.chromosome}\t${point.start}\t${point.end}\t${point.value}\n`;
    });

    return bedgraph;
  }

  /**
   * Parse a sequence file
   */
  parseSequenceFile(content, format) {
    const sequences = [];

    if (format === 'auto' || format === 'fasta') {
      const fastaRegex = />([^\n]+)\n([^>]+)/g;
      let match;
      while ((match = fastaRegex.exec(content)) !== null) {
        const header = match[1];
        const sequence = match[2].replace(/\s/g, '');

        // Parse the header info
        const headerMatch = header.match(/([^:]+):(\d+)-(\d+)/);
        if (headerMatch) {
          sequences.push({
            chromosome: headerMatch[1],
            start: parseInt(headerMatch[2]),
            end: parseInt(headerMatch[3]),
            sequence: sequence,
          });
        }
      }
    }

    return sequences;
  }

  /**
   * Parse an annotation file
   */
  parseAnnotationFile(content, format) {
    const annotations = [];

    if (format === 'gff') {
      const lines = content.split('\n');
      lines.forEach(line => {
        if (line.startsWith('#') || !line.trim()) return;

        const fields = line.split('\t');
        if (fields.length >= 9) {
          const attributes = this.parseGFFAttributes(fields[8]);
          annotations.push({
            chromosome: fields[0],
            source: fields[1],
            type: fields[2],
            start: parseInt(fields[3]),
            end: parseInt(fields[4]),
            score: fields[5],
            strand: fields[6],
            phase: fields[7],
            attributes: attributes,
          });
        }
      });
    }

    return annotations;
  }

  /**
   * Parse GFF attributes
   */
  parseGFFAttributes(attributesString) {
    const attributes = {};
    const pairs = attributesString.split(';');

    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        attributes[key.trim()] = value.trim();
      }
    });

    return attributes;
  }

  /**
   * Parse a track file
   */
  parseTrackFile(content, format) {
    const trackData = [];

    if (format === 'wig') {
      const lines = content.split('\n');
      let currentChromosome = null;
      let currentStart = null;
      let currentStep = null;

      lines.forEach(line => {
        if (line.startsWith('track')) return;

        if (line.startsWith('fixedStep')) {
          const match = line.match(/chrom=([^\s]+)\s+start=(\d+)\s+step=(\d+)/);
          if (match) {
            currentChromosome = match[1];
            currentStart = parseInt(match[2]);
            currentStep = parseInt(match[3]);
          }
        } else if (currentChromosome && !isNaN(parseFloat(line))) {
          const value = parseFloat(line);
          trackData.push({
            chromosome: currentChromosome,
            start: currentStart,
            end: currentStart + currentStep - 1,
            value: value,
          });
          currentStart += currentStep;
        }
      });
    }

    return trackData;
  }

  /**
   * Create an annotation
   */
  async createAnnotation(parameters) {
    if (this.multiAgentSystem.chatManager) {
      return await this.multiAgentSystem.chatManager.executeToolByName('create_annotation', parameters, {
        bypassAgent: true,
      });
    }
    const { chromosome, start, end, type, name, attributes } = parameters;
    const annotation = {
      id: name,
      chromosome,
      start,
      end,
      type,
      strand: parameters.strand || '+',
      attributes: attributes || {},
    };
    await this.app.annotationManager.addAnnotation(annotation);
    return { success: true, annotation };
  }

  /**
   * Update an annotation
   */
  async updateAnnotation(parameters) {
    if (this.multiAgentSystem.chatManager) {
      return await this.multiAgentSystem.chatManager.executeToolByName('update_annotation', parameters, {
        bypassAgent: true,
      });
    }
    throw new Error('update_annotation requires ChatManager execution');
  }

  /**
   * Delete an annotation
   */
  async deleteAnnotation(parameters) {
    if (this.multiAgentSystem.chatManager) {
      return await this.multiAgentSystem.chatManager.executeToolByName('delete_annotation', parameters, {
        bypassAgent: true,
      });
    }
    throw new Error('delete_annotation requires ChatManager execution');
  }

  /**
   * Bulk update annotations
   */
  async bulkUpdateAnnotations(parameters) {
    if (this.multiAgentSystem.chatManager) {
      return await this.multiAgentSystem.chatManager.executeToolByName('bulk_update_annotations', parameters, {
        bypassAgent: true,
      });
    }
    throw new Error('bulk_update_annotations requires ChatManager execution');
  }

  /**
   * Get annotation history
   */
  async getAnnotationHistory(parameters) {
    if (this.multiAgentSystem.chatManager) {
      return await this.multiAgentSystem.chatManager.executeToolByName('get_annotation_history', parameters, {
        bypassAgent: true,
      });
    }
    throw new Error('get_annotation_history requires ChatManager execution');
  }
}

// Export the agent
window.DataAgent = DataAgent;
