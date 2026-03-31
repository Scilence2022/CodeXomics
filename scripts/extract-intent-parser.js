const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/ChatManager.js');
let content = fs.readFileSync(targetFile, 'utf8');

function extractMethod(contentStr, methodName) {
  const startMarker = "  " + methodName + "(";
  const startIndex = contentStr.indexOf(startMarker);
  if (startIndex === -1) return null;

  const bodyStartIndex = contentStr.indexOf('{', startIndex);
  if (bodyStartIndex === -1) return null;

  let openBraces = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inLineComment = false;
  let endIndex = -1;

  for (let i = bodyStartIndex; i < contentStr.length; i++) {
    const char = contentStr[i];
    const prevChar = i > 0 ? contentStr[i-1] : '';
    const nextChar = i < contentStr.length - 1 ? contentStr[i+1] : '';

    if (inString) {
      if (char === stringChar && prevChar !== '\\\\') inString = false;
      continue;
    }
    
    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    
    if (inComment) {
      if (char === '*' && nextChar === '/') {
        inComment = false;
        i++;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "\`") {
      inString = true;
      stringChar = char;
    } else if (char === '/' && nextChar === '/') {
      inLineComment = true;
      i++;
    } else if (char === '/' && nextChar === '*') {
      inComment = true;
      i++;
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
    return {
      name: methodName,
      startIndex,
      endIndex,
      body: contentStr.substring(startIndex, endIndex + 1)
    };
  }
  return null;
}

const parseSingle = extractMethod(content, 'parseToolCall');
if (parseSingle) {
  let parsedBodies = parseSingle.body;
  
  let newContent = content.substring(0, parseSingle.startIndex) +
    "  parseToolCall(response) {\n" +
    "    if (!this.services || !this.services.intent) {\n" +
    "      console.error('[ChatManager] IntentParserService not initialized');\n" +
    "      return null;\n" +
    "    }\n" +
    "    return this.services.intent.parseToolCall(response);\n" +
    "  }" + content.substring(parseSingle.endIndex + 1);
  
  // Now extract parseMultipleToolCalls from the NEW content
  const parseMultiple = extractMethod(newContent, 'parseMultipleToolCalls');
  if (parseMultiple) {
    parsedBodies += '\n\n' + parseMultiple.body;
    
    newContent = newContent.substring(0, parseMultiple.startIndex) +
      "  parseMultipleToolCalls(response) {\n" +
      "    if (!this.services || !this.services.intent) {\n" +
      "      console.error('[ChatManager] IntentParserService not initialized');\n" +
      "      return [];\n" +
      "    }\n" +
      "    return this.services.intent.parseMultipleToolCalls(response);\n" +
      "  }" + newContent.substring(parseMultiple.endIndex + 1);
  }

  const serviceCode = "/**\n" +
    " * IntentParserService - Extracted from ChatManager\n" +
    " * Handles parsing LLM natural language responses into exact tool calls based on massive rulesets.\n" +
    " */\n" +
    "class IntentParserService {\n" +
    "  constructor(app, chatManager) {\n" +
    "    this.app = app;\n" +
    "    this.chatManager = chatManager;\n" +
    "  }\n\n" +
    parsedBodies + "\n\n" +
    "}\n\n" +
    "window.IntentParserService = IntentParserService;\n";
  
  const servicePath = path.resolve('/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/chat/services/IntentParserService.js');
  fs.writeFileSync(servicePath, serviceCode, 'utf8');
  console.log('Successfully created IntentParserService.js! Output size:', serviceCode.length);
  
  fs.writeFileSync(targetFile, newContent, 'utf8');
  console.log('Successfully patched ChatManager.js!');
} else {
  console.error('Failed to extract parseToolCall');
}
