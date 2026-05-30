const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/ChatManager.js');
let content = fs.readFileSync(targetFile, 'utf8');

const startMarker = 'async executeToolByName(toolName, parameters) {';
const startIndex = content.indexOf(startMarker);

const endMarker = '  /**\n   * Execute delete sequence function directly';
const nextMethodIndex = content.indexOf(endMarker, startIndex);

if (startIndex !== -1 && nextMethodIndex !== -1) {
  const before = content.substring(0, startIndex);
  const after = content.substring(nextMethodIndex);

  const newMethod = `async executeToolByName(toolName, parameters) {
    if (!this.services || !this.services.execution) {
       console.error('[ChatManager] ToolExecutionService not initialized!');
       throw new Error('ChatManager services not fully initialized');
    }
    return await this.services.execution.execute(toolName, parameters);
  }

`;

  content = before + newMethod + after;
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('Successfully replaced executeToolByName!');
} else {
  console.error('Could not find markers');
  console.log('startIndex:', startIndex);
  console.log('nextMethodIndex:', nextMethodIndex);
}
