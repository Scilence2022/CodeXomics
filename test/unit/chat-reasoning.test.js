import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CM_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');

describe('Chat Reasoning Extractor and Formatter', () => {
  it('should verify formatMessage implementation includes regex replacing for <think>', () => {
    const code = fs.readFileSync(CM_PATH, 'utf-8');
    expect(code).toContain('replace(/<think>[\\s\\S]*?<\\/think>/gi, \'\')');
  });

  it('should verify displayLLMThinking wraps reasoning in details and summary tags', () => {
    const code = fs.readFileSync(CM_PATH, 'utf-8');
    expect(code).toContain('<details>');
    expect(code).toContain('<summary>💭 Model reasoning</summary>');
  });
});
