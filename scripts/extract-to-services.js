const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/ChatManager.js');
let content = fs.readFileSync(targetFile, 'utf8');

function extractMethod(contentStr, methodName) {
  // Use Regex to find the method signature to handle generic spacing:
  // We want to match: ^[whitespace](maybe async)[whitespace]methodName[whitespace](...)[whitespace]{
  const regexStr = '^\\\\s*(?:async\\\\s+)?' + methodName + '\\\\s*\\\\([^)]*\\\\)\\\\s*\\\\{';
  const regex = new RegExp(regexStr, 'm');
  const match = regex.exec(contentStr);
  if (!match) return null;

  const startIndex = match.index;
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
    const prevChar = i > 0 ? contentStr[i - 1] : '';
    const nextChar = i < contentStr.length - 1 ? contentStr[i + 1] : '';

    if (inString) {
      if (char === stringChar && prevChar !== '\\\\') inString = false;
      continue;
    }

    if (inLineComment) {
      if (char === '\\n') inLineComment = false;
      continue;
    }

    if (inComment) {
      if (char === '*' && nextChar === '/') {
        inComment = false;
        i++;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
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
      fullBody: contentStr.substring(startIndex, endIndex + 1),
    };
  }
  return null;
}

const moves = {
  analysis: ['genomeCodonUsageAnalysis', 'sequenceStatistics', 'aminoAcidComposition'],
  protein: ['analyzeInterProDomains', 'processUniProtResults'],
  file: ['convertMCPDownloadUrls'],
  context: [
    'generateSingleToolResponse',
    'shouldAllowToolExecution',
    'formatToolResult',
    'getCompleteToolContext',
    'checkTaskCompletion',
    'getBaseSystemMessage',
    'getOptimizedSystemMessage',
    'shouldTerminateAfterToolExecution',
    'getAllToolsDetailed',
    'addToolResultMessage',
  ],
  ui: [
    'addAlphaFoldSidebarStyles',
    'addPDBSidebarStyles',
    'showChatHistoryModal',
    'setupChatDragging',
    'showMetabolicPathway',
  ],
};

const extractedCode = {
  analysis: '',
  protein: '',
  file: '',
  context: '',
  ui: '',
};

for (const [serviceName, methods] of Object.entries(moves)) {
  for (const method of methods) {
    const extracted = extractMethod(content, method);
    if (extracted) {
      extractedCode[serviceName] += extracted.fullBody.replace(/^  /gm, '  ') + '\\n\\n';

      const sigMatch = extracted.fullBody.match(/(?:async )?[a-zA-Z0-9_]+\s*\(([^)]*)\)/);
      const params = sigMatch ? sigMatch[1] : '';

      const argsList = params
        .split(',')
        .map(function (p) {
          return p.split('=')[0].trim();
        })
        .join(', ');
      let delegationArgs = argsList;
      if (params.indexOf('{') !== -1) {
        delegationArgs = 'parameters';
      }

      const isAsync = extracted.fullBody.indexOf('async ' + method + '(') !== -1 ? 'async ' : '';
      const awaitPrefix = isAsync ? 'await ' : '';

      const stub =
        '  ' +
        isAsync +
        method +
        '(' +
        params +
        ') {\n' +
        '    if (!this.services || !this.services.' +
        serviceName +
        ') {\n' +
        "      console.error('[ChatManager] " +
        serviceName +
        " service not initialized');\n" +
        '      return;\n' +
        '    }\n' +
        '    return ' +
        awaitPrefix +
        'this.services.' +
        serviceName +
        '.' +
        method +
        '(' +
        delegationArgs +
        ');\n' +
        '  }';

      content = content.substring(0, extracted.startIndex) + stub + content.substring(extracted.endIndex + 1);
      console.log('Processed ' + method + ' -> ' + serviceName);
    } else {
      console.log('Skipped ' + method + ' (not found)');
    }
  }
}

// Write LLMContextService
if (extractedCode.context) {
  const fp = path.resolve(
    '/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/chat/services/LLMContextService.js'
  );
  const code =
    '/**\n' +
    ' * LLMContextService - Extracted from ChatManager\n' +
    ' * Handles prompt formatting, task completion checking, and tool loop logic.\n' +
    ' */\n' +
    'class LLMContextService {\n' +
    '  constructor(app, chatManager) {\n' +
    '    this.app = app;\n' +
    '    this.chatManager = chatManager;\n' +
    '  }\n\n' +
    extractedCode.context +
    '\n' +
    '}\n\n' +
    'window.LLMContextService = LLMContextService;\n';
  fs.writeFileSync(fp, code);
  console.log('Created LLMContextService.js');
}

// Write UIService
if (extractedCode.ui) {
  const fp = path.resolve('/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/chat/services/UIService.js');
  const code =
    '/**\n' +
    ' * UIService - Extracted from ChatManager\n' +
    ' * Handles sidebar elements, dragging, modals, and style injection.\n' +
    ' */\n' +
    'class UIService {\n' +
    '  constructor(app, chatManager) {\n' +
    '    this.app = app;\n' +
    '    this.chatManager = chatManager;\n' +
    '  }\n\n' +
    extractedCode.ui +
    '\n' +
    '}\n\n' +
    'window.UIService = UIService;\n';
  fs.writeFileSync(fp, code);
  console.log('Created UIService.js');
}

// Append to existing services
const appendToService = function (serviceFile, code) {
  if (!code) return;
  const fp = path.resolve(
    '/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/chat/services/' + serviceFile
  );
  let svcContent = fs.readFileSync(fp, 'utf8');
  svcContent = svcContent.replace(/}\s*\n\s*window\.[A-Za-z]+ = [A-Za-z]+;/, code + '\n$& ');
  fs.writeFileSync(fp, svcContent);
  console.log('Appended to ' + serviceFile);
};

appendToService('GenomeAnalysisService.js', extractedCode.analysis);
appendToService('ProteinService.js', extractedCode.protein);
appendToService('FileOperationService.js', extractedCode.file);

fs.writeFileSync(targetFile, content);
console.log('Successfully completed aggressive extraction phase!');
