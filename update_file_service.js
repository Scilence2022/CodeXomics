const fs = require('fs');

const oldChat = fs.readFileSync('previous_ChatManager.js', 'utf8');
let fileService = fs.readFileSync('src/renderer/modules/chat/services/FileOperationService.js', 'utf8');

function extractMethod(name) {
  const regex = new RegExp(`^  async ${name}\\(parameters = \\{\\}\\) \\{\\n(?:[\\s\\S]*?^  \\}\\n)`, 'm');
  const match = oldChat.match(regex);
  if (match) {
    let code = match[0];
    // Rename methods to strict camelCase to match ToolExecutionService
    if (name === 'exportCDSFasta') code = code.replace('async exportCDSFasta(', 'async exportCdsFasta(');
    if (name === 'exportGFFAnnotations') code = code.replace('async exportGFFAnnotations(', 'async exportGffAnnotations(');
    if (name === 'exportBEDFormat') code = code.replace('async exportBEDFormat(', 'async exportBedFormat(');
    return code;
  }
  return null;
}

const exportCdsFasta = extractMethod('exportCDSFasta');
const exportProteinFasta = extractMethod('exportProteinFasta');
const exportGffAnnotations = extractMethod('exportGFFAnnotations');
const exportBedFormat = extractMethod('exportBEDFormat');
const exportCurrentViewFasta = extractMethod('exportCurrentViewFasta');

// Also extract showExportSaveDialog and downloadFileAsBrowser
const regexSaveDialog = new RegExp(`^  async showExportSaveDialog\\(content, defaultFilename, formatType, mimeType = 'text/plain'\\) \\{\\n(?:[\\s\\S]*?^  \\}\\n)`, 'm');
const matchSaveDialog = oldChat.match(regexSaveDialog);
const showExportSaveDialogCode = matchSaveDialog[0];

const regexDownload = new RegExp(`^  /\\*\\*\\n   \\* Helper method for browser-based file download[\\s\\S]*?^  \\}\\n`, 'm');
const matchDownload = oldChat.match(regexDownload);
const downloadFileAsBrowserCode = matchDownload[0];

// Replace showExportSaveDialog in fileService
const saveDialogReplacementRegex = /  async showExportSaveDialog\(content, defaultFilename, formatType, mimeType = 'text\/plain'\) \{\n(?:[\s\S]*?  \}\n)/m;
fileService = fileService.replace(saveDialogReplacementRegex, showExportSaveDialogCode + '\n' + downloadFileAsBrowserCode);

// Add alias for exportGenBankFormat
const aliasCode = `
  // Aliases for ToolExecutionService
  async exportGenbankFormat(parameters = {}) {
    return this.exportGenBankFormat(parameters);
  }
`;

// Inject new methods before // 3. WORKSPACE MANAGEMENT
const injectPoint = '  // 3. WORKSPACE MANAGEMENT';
const injection = `
${exportCdsFasta}
${exportProteinFasta}
${exportGffAnnotations}
${exportBedFormat}
${exportCurrentViewFasta}
${aliasCode}
`;

fileService = fileService.replace(injectPoint, injection + '\n' + injectPoint);

// Need to replace this.downloadFileAsBrowser with this.downloadFileAsBrowser in case it's different context, but they are both inside the same class.
// Also, the benchmark mode fallback: add a fallback to showExportSaveDialog to not complain if not available.
// In the original ChatManager, showExportSaveDialog uses electronAPI, and if not present, uses downloadFileAsBrowser! 
// This is exactly what we need, so we're good.

fs.writeFileSync('src/renderer/modules/chat/services/FileOperationService.js', fileService);
console.log('Update successful');
