const fs = require('fs');
const path = require('path');
const targetFile = path.resolve('src/renderer/modules/ChatManager.js');
let content = fs.readFileSync(targetFile, 'utf8');

const moves = {
  analysis: ['genomeCodonUsageAnalysis', 'sequenceStatistics', 'aminoAcidComposition'],
  protein: ['analyzeInterProDomains', 'processUniProtResults'],
  file: [],
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
const methodToService = Object.create(null);
for (const [service, methods] of Object.entries(moves)) {
  for (const method of methods) {
    methodToService[method] = service;
  }
}

const regex = /^ {2}(?:async )?([A-Za-z0-9_]+)\([^)]*\) {/gm;
let match;
const extractedMethods = [];

while ((match = regex.exec(content)) !== null) {
  const methodName = match[1];
  if (!methodToService[methodName]) continue;

  const startChar = match.index;
  const bodyStartIndex = content.indexOf('{', startChar);

  let openBraces = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inLineComment = false;
  let endChar = -1;

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
        endChar = i;
        break;
      }
    }
  }

  if (endChar !== -1) {
    extractedMethods.push({
      name: methodName,
      serviceName: methodToService[methodName],
      startIndex: startChar,
      endIndex: endChar,
      fullBody: content.substring(startChar, endChar + 1),
    });
  } else {
    console.log('Failed: ' + methodName);
  }
}

extractedMethods.sort((a, b) => b.startIndex - a.startIndex);
const extractedCode = { analysis: '', protein: '', file: '', context: '', ui: '', intent: '' };

for (const m of extractedMethods) {
  extractedCode[m.serviceName] = m.fullBody.replace(/^ {2}/gm, '  ') + '\n\n' + extractedCode[m.serviceName];

  const sigMatch = m.fullBody.match(/(?:async )?[a-zA-Z0-9_]+\s*\(([^)]*)\)/);
  const params = sigMatch ? sigMatch[1] : '';
  const isAsync = m.fullBody.indexOf('async ' + m.name + '(') !== -1 ? 'async ' : '';
  const awaitPrefix = isAsync ? 'await ' : '';

  let delegationArgs = params
    .split(',')
    .map(p => p.split('=')[0].trim())
    .join(', ');
  if (params.includes('{')) delegationArgs = 'parameters';

  const stub =
    '  ' +
    isAsync +
    m.name +
    '(' +
    params +
    ') {\n' +
    '    if (!this.services || !this.services.' +
    m.serviceName +
    ') {\n' +
    "      console.error('[ChatManager] " +
    m.serviceName +
    " not initialized');\n" +
    '      return;\n' +
    '    }\n' +
    '    return ' +
    awaitPrefix +
    'this.services.' +
    m.serviceName +
    '.' +
    m.name +
    '(' +
    delegationArgs +
    ');\n' +
    '  }';

  content = content.substring(0, m.startIndex) + stub + content.substring(m.endIndex + 1);
  console.log('Processed ' + m.name);
}

const appendToService = (file, code) => {
  if (!code) return;
  const fp = path.resolve('src/renderer/modules/chat/services', file);
  if (fs.existsSync(fp)) {
    let text = fs.readFileSync(fp, 'utf8');
    text = text.replace(/}\s*\n\s*window\.[A-Za-z]+ = [A-Za-z]+;/, '\n' + code + '\n$& ');
    fs.writeFileSync(fp, text);
    console.log('Appended to ' + file);
  } else {
    const className = file.replace('.js', '');
    const template = `/**\n * ${className} - Extracted from ChatManager\n */\nclass ${className} {\n  constructor(app, chatManager) {\n    this.app = app;\n    this.chatManager = chatManager;\n  }\n\n${code}\n}\n\nwindow.${className} = ${className};\n`;
    fs.writeFileSync(fp, template);
    console.log('Created ' + file);
  }
};

appendToService('GenomeAnalysisService.js', extractedCode.analysis);
appendToService('ProteinService.js', extractedCode.protein);
appendToService('FileOperationService.js', extractedCode.file);
appendToService('IntentParserService.js', extractedCode.intent);
appendToService('LLMContextService.js', extractedCode.context);
appendToService('UIService.js', extractedCode.ui);

fs.writeFileSync(targetFile, content);
console.log('SUCCESS!');
