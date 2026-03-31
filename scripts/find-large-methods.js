const fs = require('fs');

const content = fs.readFileSync('src/renderer/modules/ChatManager.js', 'utf8');

const regex = /^  (?:async )?([A-Za-z0-9_]+)\([^)]*\) {/gm;
let match;
let methods = [];

while ((match = regex.exec(content)) !== null) {
  const methodName = match[1];
  const startChar = match.index;
  const startLine = content.substring(0, startChar).split('\n').length;
  
  if (methodName === 'if' || methodName === 'switch' || methodName === 'for' || methodName === 'while' || methodName === 'catch') continue;

  const bodyStartIndex = content.indexOf('{', startChar);
  
  let openBraces = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inLineComment = false;
  let endChar = -1;

  for (let i = bodyStartIndex; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i-1] : '';
    const nextChar = i < content.length - 1 ? content[i+1] : '';

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
        endChar = i;
        break;
      }
    }
  }

  if (endChar !== -1) {
    const endLine = content.substring(0, endChar).split('\n').length;
    const lines = endLine - startLine + 1;
    methods.push({ name: methodName, lines, startLine, endLine });
  }
}

methods.sort((a,b) => b.lines - a.lines);
console.log(methods.slice(0, 30).map(m => `${m.name}: ${m.lines} lines (L${m.startLine}-L${m.endLine})`).join('\n'));
