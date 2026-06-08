const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/ChatManager.js');
let content = fs.readFileSync(targetFile, 'utf8');

function replaceMethod(methodName, delegationCode) {
  const startMarker1 = `  async ${methodName}(`;
  const startMarker2 = `  ${methodName}(`;

  let startIndex = content.indexOf(startMarker1);
  if (startIndex === -1) {
    startIndex = content.indexOf(startMarker2);
    if (startIndex === -1) {
      console.warn(`Could not find method ${methodName}`);
      return;
    }
  }

  // 1. Scan forward to find the end of the arguments list
  let openParens = 0;
  let inArgs = false;
  let argsEndIndex = -1;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    if (char === '(') {
      openParens++;
      inArgs = true;
    } else if (char === ')') {
      openParens--;
      if (openParens === 0 && inArgs) {
        argsEndIndex = i;
        break;
      }
    }
  }

  if (argsEndIndex === -1) {
    console.warn(`Could not find end of arguments for ${methodName}`);
    return;
  }

  // 2. Scan forward to find the start of the method body
  const bodyStartIndex = content.indexOf('{', argsEndIndex);
  if (bodyStartIndex === -1) {
    console.warn(`Could not find start of body for ${methodName}`);
    return;
  }

  // 3. Scan forward to find the end of the method body
  let openBraces = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inLineComment = false;
  let endIndex = -1;

  for (let i = bodyStartIndex; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';
    const nextChar = i < content.length - 1 ? content[i + 1] : '';

    if (inString) {
      if (char === stringChar && prevChar !== '\\') inString = false;
      continue;
    }

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inComment) {
      if (char === '*' && nextChar === '/') {
        inComment = false;
        i++; // skip /
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      inString = true;
      stringChar = char;
    } else if (char === '/' && nextChar === '/') {
      inLineComment = true;
      i++; // skip /
    } else if (char === '/' && nextChar === '*') {
      inComment = true;
      i++; // skip *
    } else if (char === '{') {
      openBraces++;
    } else if (char === '}') {
      openBraces--;
      if (openBraces === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex !== -1) {
    const before = content.substring(0, bodyStartIndex + 1);
    const after = content.substring(endIndex);

    // We'll output a clean body with the delegation
    content = before + '\n    ' + delegationCode + '\n  ' + after;
    console.log(`Replaced ${methodName}`);
  } else {
    console.warn(`Failed to find end of body for ${methodName}`);
  }
}

// Map of methods to their new service calls
const methodsToPatch = {
  // FileOperationService
  loadGenomeFile: 'return this.services.file.loadGenomeFile(parameters);',
  loadAnnotationFile: 'return this.services.file.loadAnnotationFile(parameters);',
  loadVariantFile: 'return this.services.file.loadVariantFile(parameters);',
  loadReadsFile: 'return this.services.file.loadReadsFile(parameters);',
  loadWigTracks: 'return this.services.file.loadWigTracks(parameters);',
  loadOperonFile: 'return this.services.file.loadOperonFile(parameters);',
  exportFastaSequence: 'return this.services.file.exportFastaSequence(parameters);',
  exportGenBankFormat: 'return this.services.file.exportGenBankFormat(parameters);',
  exportCDSFasta: 'return this.services.file.exportCDSFasta(parameters);',
  exportProteinFasta: 'return this.services.file.exportProteinFasta(parameters);',
  exportGFFAnnotations: 'return this.services.file.exportGFFAnnotations(parameters);',
  exportBEDFormat: 'return this.services.file.exportBEDFormat(parameters);',
  exportCurrentViewFasta: 'return this.services.file.exportCurrentViewFasta(parameters);',
  writeFileDirectly: 'return this.services.file.writeFileDirectly(content, filePath, fileType);',
  showExportSaveDialog:
    'return this.services.file.showExportSaveDialog(content, defaultFilename, formatType, mimeType);',

  // ProteinService
  fetchProteinStructure: 'return this.services.protein.fetchProteinStructure(parameters);',
  searchPDBStructures: 'return this.services.protein.searchPDBStructures(parameters);',
  getPDBDetails: 'return this.services.protein.getPDBDetails(pdbId);',
  searchAlphaFoldByGene: 'return this.services.protein.searchAlphaFoldByGene(parameters);',
  fetchAlphaFoldStructure: 'return this.services.protein.fetchAlphaFoldStructure(parameters);',
  checkAlphaFoldAvailability: 'return this.services.protein.checkAlphaFoldAvailability(uniprotId);',
  searchUniProtDatabase: 'return this.services.protein.searchUniProtDatabase(parameters);',

  // BlastService
  blastSearch: 'return this.services.blast.blastSearch(parameters);',
  blastSequenceFromRegion: 'return this.services.blast.blastSequenceFromRegion(parameters);',
  getBlastDatabases: 'return this.services.blast.getBlastDatabases(parameters);',
  batchBlastSearch: 'return this.services.blast.batchBlastSearch(parameters);',
  localBlastDatabaseInfo: 'return this.services.blast.localBlastDatabaseInfo(parameters);',
  advancedBlastSearch: 'return this.services.blast.advancedBlastSearch(parameters);',
  executeMCPBlastTool: 'return this.services.blast.executeMCPBlastTool(toolName, parameters);',
  applyBlastFilters: 'return this.services.blast.applyBlastFilters(hits, filters);',

  // GenomeAnalysisService
  getSequenceSelection: 'return this.services.analysis.getSequenceSelection();',
  getSequence: 'return this.services.analysis.getSequence(parameters);',
  reverseComplement: 'return this.services.analysis.reverseComplement(sequence);',
  getCodingSequence: 'return this.services.analysis.getCodingSequence(parameters);',
  translateSequence: 'return this.services.analysis.translateSequence(parameters);',
  calculateGCContent: 'return this.services.analysis.calculateGCContent(parameters);',
  codonUsageAnalysis: 'return this.services.analysis.codonUsageAnalysis(parameters);',
  findOpenReadingFrames: 'return this.services.analysis.findOpenReadingFrames(parameters);',
  getGenomeInfo: 'return this.services.analysis.getGenomeInfo(parameters);',
  checkGenomicsEnvironment: 'return this.services.analysis.checkGenomicsEnvironment();',

  // AnnotationService
  listAnnotations: 'return this.services.annotation.listAnnotations(parameters);',
  _findAnnotation: 'return this.services.annotation._findAnnotation(identifier, chromosome);',
  getAnnotation: 'return this.services.annotation.getAnnotation(parameters);',
  updateAnnotation: 'return this.services.annotation.updateAnnotation(parameters);',
  searchAnnotations: 'return this.services.annotation.searchAnnotations(parameters);',
  bulkUpdateAnnotations: 'return this.services.annotation.bulkUpdateAnnotations(parameters);',
  getAnnotationHistory: 'return this.services.annotation.getAnnotationHistory(parameters);',
  editAnnotation: 'return this.services.annotation.editAnnotation(parameters);',
  deleteAnnotation: 'return this.services.annotation.deleteAnnotation(parameters);',
  batchCreateAnnotations: 'return this.services.annotation.batchCreateAnnotations(parameters);',
};

for (const [methodName, delegationCode] of Object.entries(methodsToPatch)) {
  replaceMethod(methodName, delegationCode);
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully patched all service delegation methods!');
