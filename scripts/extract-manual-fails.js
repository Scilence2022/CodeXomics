const fs = require('fs');
const content = fs.readFileSync('src/renderer/modules/ChatManager.js', 'utf8');
const lines = content.split('\n');

// Boundaries determined from pristine HEAD
const m1 = lines.slice(9972, 10148);
const m2 = lines.slice(10154, 10241);
const m3 = lines.slice(10712, 10761);

const intentCode = `/**
 * IntentParserService - Extracted from ChatManager
 */
class IntentParserService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

${m1.join('\n')}

${m2.join('\n')}
}

window.IntentParserService = IntentParserService;
`;
fs.writeFileSync('src/renderer/modules/chat/services/IntentParserService.js', intentCode);

const stub1 = `  parseToolCall(response) {
    if (!this.services || !this.services.intent) {
      console.error('[ChatManager] intent not initialized');
      return null;
    }
    return this.services.intent.parseToolCall(response);
  }`;

const stub2 = `  parseMultipleToolCalls(response) {
    if (!this.services || !this.services.intent) {
      console.error('[ChatManager] intent not initialized');
      return [];
    }
    return this.services.intent.parseMultipleToolCalls(response);
  }`;

const stub3 = `  convertMCPDownloadUrls(text) {
    if (!this.services || !this.services.file) {
      console.error('[ChatManager] file not initialized');
      return;
    }
    return this.services.file.convertMCPDownloadUrls(text);
  }`;

// Inject stub 3 first (higher up in the file)
lines.splice(8032, 8081 - 8032, stub3);
// Re-calculate the shift for the subsequent indices!
// We replaced (8081 - 8032) = 49 lines with 1 continuous multiline string (which split('\n') considers as 1 array element... wait!)
// NO! splice replaces array elements. If I pass `stub3` as a single string, it becomes ONE array element containing `\n`! Then when I join('\n'), it works perfectly!
// BUT the array indexes shift by `1 - 49 = -48`!
// So 9972 becomes 9972 - 48 = 9924.
// Let's just do bottom-up exactly like my AST parser!

const linesBottomUp = content.split('\n');
linesBottomUp.splice(10712, 10761 - 10712, stub3);
linesBottomUp.splice(9972, 10241 - 9972, stub1, '', stub2);

fs.writeFileSync('src/renderer/modules/ChatManager.js', linesBottomUp.join('\n'));

const fileOpPath = 'src/renderer/modules/chat/services/FileOperationService.js';
const fileOpCode = `/**
 * FileOperationService - Extracted from ChatManager
 */
class FileOperationService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

${m3.join('\n')}
}

window.FileOperationService = FileOperationService;
`;
fs.writeFileSync(fileOpPath, fileOpCode);

console.log('Successfully extracted manual exceptions!');
