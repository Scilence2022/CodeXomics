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
    try {
      const { filePath, showFileDialog = false, fileType = 'auto' } = parameters;

      if (filePath && !showFileDialog) {
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available');
        }

        if (typeof require !== 'undefined') {
          const fs = require('fs');
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
          }
        }

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
      const { filePath, showFileDialog = false, fileType = 'auto', mergeWithExisting = false } = parameters;

      if (filePath && !showFileDialog) {
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available');
        }

        if (typeof require !== 'undefined') {
          const fs = require('fs');
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
          }
        }

        // Load annotation file using the generic loadFile method (fileManager has no loadAnnotationFile)
        await this.app.fileManager.loadFile(filePath);

        return {
          success: true,
          message: `Successfully loaded annotation file: ${filePath}`,
          filePath: filePath,
          fileType: 'annotation',
          tool: 'load_annotation_file',
          timestamp: new Date().toISOString(),
        };
      } else {
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available');
        }

        this.app.fileManager.openSpecificFileType('annotation');

        return {
          success: true,
          message: 'File dialog opened for annotation file selection',
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
  async exportFastaSequence(parameters = {}) {
    const { filename } = parameters;
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

      const isUserProvidedFilename = filename && filename.trim() && !['sequences.fasta', 'genome.fasta'].includes(filename);
      if (isUserProvidedFilename) {
        await this.writeFileDirectly(fastaContent, filename, 'FASTA sequence');
      } else {
        await this.showExportSaveDialog(fastaContent, 'genome.fasta', 'FASTA sequence', 'text/plain');
      }

      return {
        success: true,
        tool: 'export_fasta_sequence',
        exported_format: 'FASTA',
        filename: filename || 'genome.fasta',
        chromosomes: chromosomes,
        total_length: chromosomes.reduce((sum, chr) => sum + this.app.currentSequence[chr].length, 0),
      };
    } catch (error) {
      throw new Error(`FASTA export failed: ${error.message}`);
    }
  }

  async exportProteinFasta(parameters = {}) {
    const { filename, includeGeneNames = true, translationTable = 1 } = parameters;
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

      const isUserProvidedFilename = filename && filename.trim() && filename !== 'protein_sequences.fasta';
      if (isUserProvidedFilename) {
        await this.writeFileDirectly(proteinContent, filename, 'Protein FASTA');
      } else {
        await this.showExportSaveDialog(proteinContent, 'protein_sequences.fasta', 'Protein FASTA', 'text/plain');
      }

      const proteinCount = chromosomes.reduce((sum, chr) => {
        return sum + (this.app.currentAnnotations[chr] || []).filter(f => f.type === 'CDS').length;
      }, 0);

      return {
        success: true,
        tool: 'export_protein_fasta',
        exported_format: 'Protein FASTA',
        filename: filename || 'protein_sequences.fasta',
        total_protein_sequences: proteinCount,
        translation_table: translationTable,
        message: `Successfully exported ${proteinCount} protein sequences`,
      };
    } catch (error) {
      throw new Error(`Protein FASTA export failed: ${error.message}`);
    }
  }

  async exportCurrentViewFasta(parameters = {}) {
    const { filename, includeCoordinates = true } = parameters;
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
      const isUserProvidedFilename = filename && filename.trim() && filename !== defaultFilename;
      if (isUserProvidedFilename) {
        await this.writeFileDirectly(fastaContent, filename, 'Current view FASTA');
      } else {
        await this.showExportSaveDialog(fastaContent, defaultFilename, 'Current view FASTA', 'text/plain');
      }

      return {
        success: true,
        tool: 'export_current_view_fasta',
        exported_format: 'FASTA (Current View)',
        filename: filename || defaultFilename,
        chromosome: currentChr,
        region_start: viewStart,
        region_end: viewEnd,
        region_length: viewEnd - viewStart + 1,
        coordinates: `${currentChr}:${viewStart}-${viewEnd}`,
        message: `Successfully exported current view as FASTA format`,
      };
    } catch (error) {
      throw new Error(`Current view FASTA export failed: ${error.message}`);
    }
  }

  async exportGenBankFormat(parameters = {}) {
    const { filename } = parameters;
    if (!this.app?.exportManager) throw new Error('Export manager not available');
    if (!this.app.currentSequence || Object.keys(this.app.currentSequence).length === 0) {
      throw new Error('No genome data loaded to export');
    }

    try {
      const chromosomes = Object.keys(this.app.currentSequence);
      let genbankContent = '';
      chromosomes.forEach(chr => {
        const sequence = this.app.currentSequence[chr];
        const features = this.app.currentAnnotations?.[chr] || [];
        genbankContent += `LOCUS       ${chr.padEnd(16)} ${sequence.length} bp    DNA     linear   UNK ${new Date().toISOString().slice(0, 10)}\n`;
        genbankContent += `FEATURES             Location/Qualifiers\n`;
        genbankContent += `     source          1..${sequence.length}\n`;
        features.forEach(feature => {
          const loc = feature.strand === '-' ? `complement(${feature.start}..${feature.end})` : `${feature.start}..${feature.end}`;
          genbankContent += `     ${feature.type.padEnd(15)} ${loc}\n`;
        });
        genbankContent += `ORIGIN\n`;
        for (let i = 0; i < sequence.length; i += 60) {
          const lineNum = (i + 1).toString().padStart(9);
          const seqLine = sequence.substring(i, i + 60).toLowerCase();
          const formattedSeq = seqLine.match(/.{1,10}/g)?.join(' ') || seqLine;
          genbankContent += `${lineNum} ${formattedSeq}\n`;
        }
        genbankContent += `//\n\n`;
      });

      const isUserProvidedFilename = filename && filename.trim() && filename !== 'genome.gbk';
      if (isUserProvidedFilename) {
        await this.writeFileDirectly(genbankContent, filename, 'GenBank format');
      } else {
        await this.showExportSaveDialog(genbankContent, 'genome.gbk', 'GenBank format', 'text/plain');
      }

      return { success: true, tool: 'export_genbank_format', exported_format: 'GenBank', filename: filename || 'genome.gbk' };
    } catch (error) {
      throw new Error(`GenBank export failed: ${error.message}`);
    }
  }

  async exportCdsFasta(parameters = {}) {
    const { filename } = parameters;
    try {
      const chromosomes = Object.keys(this.app.currentSequence || {});
      let cdsContent = '';
      let totalCDS = 0;

      chromosomes.forEach(chr => {
        const features = this.app.currentAnnotations?.[chr] || [];
        const cdsFeatures = features.filter(f => f.type === 'CDS');
        cdsFeatures.forEach(feature => {
          let sequence = this.app.currentSequence[chr].substring(feature.start - 1, feature.end);
          if (feature.strand === '-') {
            sequence = sequence.split('').reverse().map(base => ({A:'T',T:'A',C:'G',G:'C'}[base] || base)).join('');
          }
          cdsContent += `>${feature.attributes?.name || feature.attributes?.ID || 'CDS'}_${chr}:${feature.start}-${feature.end}\n`;
          for (let i = 0; i < sequence.length; i += 80) cdsContent += sequence.substring(i, i + 80) + '\n';
          totalCDS++;
        });
      });

      if (cdsContent === '') throw new Error('No CDS features found to export');

      const isUserProvidedFilename = filename && filename.trim() && filename !== 'cds.fasta';
      if (isUserProvidedFilename) {
        await this.writeFileDirectly(cdsContent, filename, 'CDS FASTA');
      } else {
        await this.showExportSaveDialog(cdsContent, 'cds_sequences.fasta', 'CDS FASTA', 'text/plain');
      }

      return { success: true, tool: 'export_cds_fasta', exported_format: 'CDS FASTA', count: totalCDS };
    } catch (error) {
      throw new Error(`CDS export failed: ${error.message}`);
    }
  }

  async exportGffAnnotations(parameters = {}) {
    const { filename } = parameters;
    try {
      const chromosomes = Object.keys(this.app.currentAnnotations || {});
      let gffContent = '##gff-version 3\n';
      chromosomes.forEach(chr => {
        const features = this.app.currentAnnotations[chr];
        features.forEach(f => {
          const attrs = Object.entries(f.attributes || {}).map(([k,v]) => `${k}=${v}`).join(';');
          gffContent += `${chr}\tCodeXomics\t${f.type}\t${f.start}\t${f.end}\t.\t${f.strand || '+'}\t.\t${attrs}\n`;
        });
      });

      const isUserProvidedFilename = filename && filename.trim() && filename !== 'annotations.gff';
      if (isUserProvidedFilename) {
        await this.writeFileDirectly(gffContent, filename, 'GFF annotations');
      } else {
        await this.showExportSaveDialog(gffContent, 'features.gff3', 'GFF annotations', 'text/plain');
      }

      return { success: true, tool: 'export_gff_annotations', exported_format: 'GFF' };
    } catch (error) {
      throw new Error(`GFF export failed: ${error.message}`);
    }
  }

  async exportBedFormat(parameters = {}) {
    const { filename } = parameters;
    try {
      const chromosomes = Object.keys(this.app.currentAnnotations || {});
      let bedContent = '';
      chromosomes.forEach(chr => {
        const features = this.app.currentAnnotations[chr];
        features.forEach(f => {
          const name = f.attributes?.name || f.attributes?.ID || f.type;
          bedContent += `${chr}\t${f.start - 1}\t${f.end}\t${name}\t0\t${f.strand || '+'}\n`;
        });
      });

      const isUserProvidedFilename = filename && filename.trim() && filename !== 'annotations.bed';
      if (isUserProvidedFilename) {
        await this.writeFileDirectly(bedContent, filename, 'BED format');
      } else {
        await this.showExportSaveDialog(bedContent, 'features.bed', 'BED format', 'text/plain');
      }

      return { success: true, tool: 'export_bed_format', exported_format: 'BED' };
    } catch (error) {
      throw new Error(`BED export failed: ${error.message}`);
    }
  }

  async loadVariantFile(parameters = {}) {
    try {
      const { filePath, showFileDialog = false } = parameters;
      if (filePath && !showFileDialog) {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        if (typeof require !== 'undefined') {
          const fs = require('fs');
          if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        }
        await this.app.fileManager.loadFile(filePath);
        return { success: true, message: `Successfully loaded variant file: ${filePath}`, filePath, fileType: 'variant' };
      } else {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        this.app.fileManager.openSpecificFileType('variant');
        return { success: true, message: 'File dialog opened for variant file selection', action: 'dialog_opened', fileType: 'variant' };
      }
    } catch (error) {
      console.error('❌ [FileOperationService] loadVariantFile failed:', error);
      return { success: false, error: error.message, fileType: 'variant' };
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
      console.error('❌ [FileOperationService] loadReadsFile failed:', error);
      return { success: false, error: error.message, fileType: 'reads' };
    }
  }

  async loadWigTracks(parameters = {}) {
    try {
      const { filePaths, showFileDialog = false, multiple = true } = parameters;
      if (filePaths && !showFileDialog) {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        const pathsArray = Array.isArray(filePaths) ? filePaths : [filePaths];
        if (typeof require !== 'undefined') {
          const fs = require('fs');
          for (const path of pathsArray) {
            if (!fs.existsSync(path)) throw new Error(`File not found: ${path}`);
          }
        }
        if (pathsArray.length > 1) await this.app.fileManager.loadMultipleWIGFiles(pathsArray);
        else await this.app.fileManager.loadFile(pathsArray[0]);
        return { success: true, message: `Successfully loaded ${pathsArray.length} WIG track(s)`, filePaths: pathsArray, fileType: 'wig', count: pathsArray.length };
      } else {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        this.app.fileManager.openSpecificFileType('tracks');
        return { success: true, message: 'File dialog opened for WIG tracks selection', action: 'dialog_opened', fileType: 'wig', multiple };
      }
    } catch (error) {
      console.error('❌ [FileOperationService] loadWigTracks failed:', error);
      return { success: false, error: error.message, fileType: 'wig' };
    }
  }

  async loadOperonFile(parameters = {}) {
    try {
      const { filePath, showFileDialog = false, format = 'auto' } = parameters;
      if (filePath && !showFileDialog) {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        if (typeof require !== 'undefined') {
          const fs = require('fs');
          if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        }
        await this.app.fileManager.loadOperonFile(filePath);
        return { success: true, message: `Successfully loaded operon file: ${filePath}`, filePath, fileType: 'operon', format };
      } else {
        if (!this.app?.fileManager) throw new Error('FileManager not available');
        this.app.fileManager.openSpecificFileType('operon');
        return { success: true, message: 'File dialog opened for operon file selection', action: 'dialog_opened', fileType: 'operon' };
      }
    } catch (error) {
      console.error('❌ [FileOperationService] loadOperonFile failed:', error);
      return { success: false, error: error.message, fileType: 'operon' };
    }
  }

  async downloadInternetFile(parameters = {}) {
    try {
      let { url, destinationPath, filename } = parameters;
      if (url) url = url.replace(/[`\s]/g, '');
      console.log(`📥 [FileOperationService] Downloading file from: ${url}`);
      if (!url) throw new Error('URL is required for download');

      if (window.electronAPI?.downloadInternetFile) {
        const result = await window.electronAPI.downloadInternetFile({ url, destinationPath, filename });
        if (result.success) return { success: true, message: `Successfully downloaded file to: ${result.filePath}`, filePath: result.filePath, filename: result.filename, fileSize: result.fileSize, url, tool: 'download_internet_file' };
        throw new Error(result.error || 'Download failed');
      } else if (window.ipcRenderer) {
        const result = await window.ipcRenderer.invoke('download-internet-file', { url, destinationPath, filename });
        if (result.success) return { success: true, message: `Successfully downloaded file to: ${result.filePath}`, filePath: result.filePath, filename: result.filename, fileSize: result.fileSize, url, tool: 'download_internet_file' };
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
          } catch (e) { console.warn('Failed to parse MCP server URL:', e); }
        }
      }
      text = text.replace(/🔗\s*(\/api\/mcp\/download\/[^\s\n`"<>]+)/g, (m, p) => `🔗 [Download](${baseUrl}${p})`);
      text = text.replace(/(?<!\(|\[|")(\/api\/mcp\/download\/[^\s\n\)`"<>]+)/g, (m, p) => `[${p}](${baseUrl}${p})`);
      text = text.replace(/\[([^\]]+)\]\((\/api\/mcp\/[^\s\n\)]+)\)/g, (m, l, p) => `[${l}](${baseUrl}${p})`);
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

        const result = await window.electronAPI.showSaveDialog({ title: `Save ${formatType}`, defaultPath: defaultFilename, filters: filters });
        if (!result.canceled && result.filePath) {
          const writeResult = await window.electronAPI.writeFile(result.filePath, content);
          if (writeResult.success) {
            if (this.chatManager.showNotification) this.chatManager.showNotification(`${formatType} saved successfully`, 'success');
            return { success: true, filePath: result.filePath };
          } else throw new Error(`Failed to write file: ${writeResult.error}`);
        }
        return { success: false, canceled: true };
      } else {
        this.downloadFileAsBrowser(content, defaultFilename, mimeType);
        return { success: true, method: 'browser_download' };
      }
    } catch (error) {
      if (this.chatManager.showNotification) this.chatManager.showNotification(`Failed to save ${formatType}: ${error.message}`, 'error');
      throw error;
    }
  }

  downloadFileAsBrowser(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async writeFileDirectly(content, filename, formatType) {
    try {
      if (window.electronAPI?.writeFile) {
        const result = await window.electronAPI.writeFile(filename, content);
        if (this.chatManager.showNotification) this.chatManager.showNotification(`${formatType} exported successfully`, 'success');
        return { success: true, filePath: result.filePath };
      } else {
        const fs = require('fs').promises;
        const path = require('path');
        const absolutePath = path.resolve(filename);
        await fs.writeFile(absolutePath, content, 'utf8');
        if (this.chatManager.showNotification) this.chatManager.showNotification(`${formatType} exported successfully`, 'success');
        return { success: true, filePath: absolutePath };
      }
    } catch (error) {
      if (this.chatManager.showNotification) this.chatManager.showNotification(`Failed to export ${formatType}: ${error.message}`, 'error');
      throw error;
    }
  }

  getCurrentWorkingDirectory() {
    return this.chatManager.currentWorkingDirectory || process.cwd();
  }

  // Aliases for ToolExecutionService
  async exportCDSFasta(p) { return this.exportCdsFasta(p); }
  async exportGFFAnnotations(p) { return this.exportGffAnnotations(p); }
  async exportBEDFormat(p) { return this.exportBedFormat(p); }
  async exportGenbankFormat(p) { return this.exportGenBankFormat(p); }
}

window.FileOperationService = FileOperationService;
