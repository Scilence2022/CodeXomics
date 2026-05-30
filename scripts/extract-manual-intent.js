const fs = require('fs');
const content = fs.readFileSync('src/renderer/modules/ChatManager.js', 'utf8');
const lines = content.split('\n');
const m1 = lines.slice(9972, 10148);
const m2 = lines.slice(10154, 10241);

const code = `/**
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
fs.writeFileSync('src/renderer/modules/chat/services/IntentParserService.js', code);

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

// Replace the lines 9972 through 10240 with the two stubs
lines.splice(9972, 10241 - 9972, stub1, '', stub2);
fs.writeFileSync('src/renderer/modules/ChatManager.js', lines.join('\n'));

console.log('Successfully extracted IntentParserService manually!');
