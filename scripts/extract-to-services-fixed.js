const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/ChatManager.js');
let content = fs.readFileSync(targetFile, 'utf8');

const moves = {
  analysis: ['genomeCodonUsageAnalysis', 'aminoAcidComposition'],
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
  intent: ['parseToolCall', 'parseMultipleToolCalls'],
};

const methodToService = Object.create(null);
for (const [service, methods] of Object.entries(moves)) {
  for (const method of methods) {
    methodToService[method] = service;
  }
}

const extractedCode = {
  analysis: '',
  protein: '',
  file: '',
  context: '',
  ui: '',
  intent: '',
};

const regex = /^ {2}(?:async )?([A-Za-z0-9_]+)\([^)]*\) {/gm;
let match;
const foundMethods = [];

while ((match = regex.exec(content)) !== null) {
  const methodName = match[1];
  if (!methodToService[methodName]) continue;

  const startIndex = match.index;
  const bodyStartIndex = content.indexOf('{', startIndex);

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
    foundMethods.push({
      name: methodName,
      serviceName: methodToService[methodName],
      startIndex,
      endIndex,
      fullBody: content.substring(startIndex, endIndex + 1),
    });
  } else {
    console.log('Failed brace match on ' + methodName);
  }
}

foundMethods.sort(function(a, b) {
  return b.startIndex - a.startIndex;
});

for (const m of foundMethods) {
  extractedCode[m.serviceName] = m.fullBody.replace(/^ {2}/gm, '  ') + '\n\n' + extractedCode[m.serviceName];

  const sigMatch = m.fullBody.match(/(?:async )?[a-zA-Z0-9_]+\s*\(([^)]*)\)/);
  const params = sigMatch ? sigMatch[1] : '';

  const argsList = params
    .split(',')
    .map(function(p) {
      return p.split('=')[0].trim();
    })
    .join(', ');
  let delegationArgs = argsList;
  if (params.indexOf('{') !== -1) {
    delegationArgs = 'parameters';
  }

  const isAsync = m.fullBody.indexOf('async ' + m.name + '(') !== -1 ? 'async ' : '';
  const awaitPrefix = isAsync ? 'await ' : '';

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
    " service not initialized');\n" +
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
  console.log('Processed ' + m.name + ' -> ' + m.serviceName);
}

if (foundMethods.length > 0) {
  const appendToService = function(serviceFile, code) {
    if (!code) return;
    const fp = path.resolve(
      '/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/chat/services/' + serviceFile
    );
    let svcContent = fs.readFileSync(fp, 'utf8');
    svcContent = svcContent.replace(/}\s*\n\s*window\.[A-Za-z]+ = [A-Za-z]+;/, '\n' + code + '\n$& ');
    fs.writeFileSync(fp, svcContent);
    console.log('Appended to ' + serviceFile);
  };

  appendToService('GenomeAnalysisService.js', extractedCode.analysis);
  appendToService('ProteinService.js', extractedCode.protein);
  appendToService('FileOperationService.js', extractedCode.file);

  if (extractedCode.intent) {
    const fp = path.resolve(
      '/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/chat/services/IntentParserService.js'
    );
    if (fs.existsSync(fp)) {
      appendToService('IntentParserService.js', extractedCode.intent);
    } else {
      const code =
        '/**\n' +
        ' * IntentParserService - Extracted from ChatManager\n' +
        ' * Handles complex tool call parsing from LLM responses.\n' +
        ' */\n' +
        'class IntentParserService {\n' +
        '  constructor(app, chatManager) {\n' +
        '    this.app = app;\n' +
        '    this.chatManager = chatManager;\n' +
        '  }\n\n' +
        extractedCode.intent +
        '\n' +
        '}\n\n' +
        'window.IntentParserService = IntentParserService;\n';
      fs.writeFileSync(fp, code);
      console.log('Created IntentParserService.js');
    }
  }

  if (extractedCode.context) {
    const fp = path.resolve(
      '/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/chat/services/LLMContextService.js'
    );
    if (fs.existsSync(fp)) {
      appendToService('LLMContextService.js', extractedCode.context);
    } else {
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
  }

  if (extractedCode.ui) {
    const fp = path.resolve(
      '/Users/song/Github-Repos/GenomeAIStudio_1/src/renderer/modules/chat/services/UIService.js'
    );
    if (fs.existsSync(fp)) {
      appendToService('UIService.js', extractedCode.ui);
    } else {
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
  }

  // Restore constructor modifications done by earlier phases BEFORE we save!
  const lines = content.split('\n');
  const injectIndex = lines.findIndex(l => l.includes('annotation: new window.AnnotationService(this.app, this)'));
  if (injectIndex !== -1 && !lines[injectIndex + 1].includes('intent:')) {
    lines[injectIndex] = lines[injectIndex].replace('this)', 'this),');
    lines.splice(
      injectIndex + 1,
      0,
      '      intent: new window.IntentParserService(this.app, this),',
      '      context: new window.LLMContextService(this.app, this),',
      '      ui: new window.UIService(this.app, this)'
    );
    content = lines.join('\n');
  }

  fs.writeFileSync(targetFile, content);
  console.log('Successfully completed full aggressive extraction phase!');
} else {
  console.log('No methods were successfully extracted.');
}
