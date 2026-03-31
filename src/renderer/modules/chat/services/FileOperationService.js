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
      const { filePath, showFileDialog = false } = parameters;

      if (filePath && !showFileDialog) {
        if (!this.app?.fileManager) {
          throw new Error('FileManager not available - app structure missing');
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
      return {
        success: false,
        error: error.message,
        fileType: 'genome',
        tool: 'load_genome_file',
        timestamp: new Date().toISOString(),
        stack: error.stack,
      };
    }
  }

  async loadAnnotationFile(parameters = {}) {
    try {
      const { filePath, showFileDialog = false, mergeWithExisting = false } = parameters;

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

        await this.app.fileManager.loadFile(filePath, { mergeWithExisting });

        return {
          success: true,
          message: `Successfully loaded annotation file: ${filePath}`,
          filePath: filePath,
          fileType: 'annotation',
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
        };
      }
    } catch (error) {
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
          message: `Successfully loaded variant file: ${filePath}`,
          filePath: filePath,
          fileType: 'variant',
        };
      } else {
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
      return {
        success: false,
        error: error.message,
        fileType: 'variant',
      };
    }
  }

  // 2. DATA EXPORT OPERATIONS
  async writeFileDirectly(content, filePath, fileType) {
    console.log(`[FileOperationService] Writing ${fileType} to ${filePath}`);
    
    // Convert relative to absolute if needed
    const path = require('path');
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.getCurrentWorkingDirectory(), filePath);

    if (window.electronAPI && window.electronAPI.writeFile) {
      const writeResult = await window.electronAPI.writeFile(absolutePath, content);
      if (!writeResult.success) {
        throw new Error(`Failed to save ${fileType}: ${writeResult.error}`);
      }
      return writeResult;
    } else if (window.ipcRenderer) {
      const writeResult = await window.ipcRenderer.invoke('write-file', { filePath: absolutePath, content });
      if (!writeResult.success) {
        throw new Error(`Failed to save ${fileType}: ${writeResult.error}`);
      }
      return writeResult;
    } else {
      const fs = require('fs');
      try {
        fs.writeFileSync(absolutePath, content, 'utf8');
        return { success: true, filePath: absolutePath };
      } catch (e) {
        throw new Error(`Failed to save ${fileType}: ${e.message}`);
      }
    }
  }

  async showExportSaveDialog(content, defaultFilename, formatType, mimeType = 'text/plain') {
    try {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
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
            return {
              success: true,
              filePath: result.filePath,
              message: `Successfully saved to ${result.filePath}`
            };
          } else {
            throw new Error(`Failed to write file: ${writeResult.error}`);
          }
        }
        
        return {
          success: false,
          canceled: true,
          message: 'Export canceled by user'
        };
      }
      
      throw new Error('electronAPI.showSaveDialog not available');
    } catch (error) {
      console.error('[FileOperationService] Error in save dialog:', error);
      throw error;
    }
  }

  async exportFastaSequence(parameters = {}) {
    const { filename } = parameters;

    if (!this.app || !this.app.exportManager) {
      throw new Error('Export manager not available');
    }

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

      const isUserProvidedFilename = filename && filename.trim() && filename !== 'sequences.fasta' && filename !== 'genome.fasta';

      if (isUserProvidedFilename) {
        await this.writeFileDirectly(fastaContent, filename, 'FASTA sequence');
      } else {
        await this.showExportSaveDialog(fastaContent, 'genome.fasta', 'FASTA sequence', 'text/plain');
      }

      const totalLength = chromosomes.reduce((sum, chr) => sum + this.app.currentSequence[chr].length, 0);

      return {
        success: true,
        tool: 'export_fasta_sequence',
        exported_format: 'FASTA',
        filename: filename || 'genome.fasta',
        chromosomes: chromosomes,
        total_length: totalLength,
      };
    } catch (error) {
      throw new Error(`FASTA export failed: ${error.message}`);
    }
  }

  async exportGenBankFormat(parameters = {}) {
    const { filename, includeProteinSequences = false } = parameters;

    if (!this.app || !this.app.exportManager) {
      throw new Error('Export manager not available');
    }

    if (!this.app.currentSequence || Object.keys(this.app.currentSequence).length === 0) {
      throw new Error('No genome data loaded to export');
    }

    try {
      const chromosomes = Object.keys(this.app.currentSequence);
      let genbankContent = '';

      chromosomes.forEach(chr => {
        const sequence = this.app.currentSequence[chr];
        const features = this.app.currentAnnotations[chr] || [];

        genbankContent += `LOCUS       ${chr.padEnd(16)} ${sequence.length} bp    DNA     linear   UNK ${new Date().toISOString().slice(0, 10).replace(/-/g, '-')}\n`;
        genbankContent += `DEFINITION  ${chr}\n`;
        genbankContent += `ACCESSION   ${chr}\n`;
        genbankContent += `VERSION     ${chr}\n`;
        genbankContent += `KEYWORDS    .\n`;
        genbankContent += `SOURCE      .\n`;
        genbankContent += `  ORGANISM  .\n`;
        genbankContent += `FEATURES             Location/Qualifiers\n`;
        genbankContent += `     source          1..${sequence.length}\n`;

        features.forEach(feature => {
          const location = feature.strand === '-' 
            ? `complement(${feature.start}..${feature.end})` 
            : `${feature.start}..${feature.end}`;

          genbankContent += `     ${feature.type.padEnd(15)} ${location}\n`;

          if (this.app.exportManager.exportFeatureQualifiers) {
            genbankContent += this.app.exportManager.exportFeatureQualifiers(feature);
          }
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

      return {
        success: true,
        tool: 'export_genbank_format',
        exported_format: 'GenBank',
        filename: filename || 'genome.gbk',
      };
    } catch (error) {
      throw new Error(`GenBank export failed: ${error.message}`);
    }
  }

  // 3. WORKSPACE MANAGEMENT
  getCurrentWorkingDirectory() {
    return this.chatManager.currentWorkingDirectory || process.cwd();
  }
}

// Make it available globally if needed by plugin system
window.FileOperationService = FileOperationService;
