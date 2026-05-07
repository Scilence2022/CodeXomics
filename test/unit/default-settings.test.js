/**
 * DefaultSettings Constants Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SETTINGS_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/constants/DefaultSettings.js');

describe('DefaultSettings Constants', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
  });

  it('DefaultSettings.js should exist and be valid', () => {
    expect(fs.existsSync(SETTINGS_PATH)).toBe(true);
    expect(content.length).toBeGreaterThan(100);
  });

  it('should define DEFAULT_CHAT_SETTINGS', () => {
    expect(content).toContain('DEFAULT_CHAT_SETTINGS');
  });

  it('DEFAULT_CHAT_SETTINGS should have required keys', () => {
    const keys = ['showThinkingProcess', 'maxHistoryMessages', 'responseTimeout', 'customSystemPrompt'];
    for (const key of keys) {
      expect(content.includes(key), `DEFAULT_CHAT_SETTINGS should contain "${key}"`).toBe(true);
    }
  });

  it('should define DEFAULT_AGENT_SETTINGS', () => {
    expect(content).toContain('DEFAULT_AGENT_SETTINGS');
  });

  it('DEFAULT_AGENT_SETTINGS should have required keys', () => {
    const keys = ['enabled', 'autoOptimize', 'llmProvider', 'llmTimeout'];
    for (const key of keys) {
      expect(content.includes(key), `DEFAULT_AGENT_SETTINGS should contain "${key}"`).toBe(true);
    }
  });

  it('temperature should be a reasonable value (0-2)', () => {
    const tempMatch = content.match(/temperature:\s*([\d.]+)/);
    if (tempMatch) {
      const temp = parseFloat(tempMatch[1]);
      expect(temp).toBeGreaterThanOrEqual(0);
      expect(temp).toBeLessThanOrEqual(2);
    }
  });

  it('responseTimeout should be a positive integer', () => {
    const tokensMatch = content.match(/responseTimeout:\s*(\d+)/);
    if (tokensMatch) {
      const timeout = parseInt(tokensMatch[1]);
      expect(timeout).toBeGreaterThan(0);
    }
  });

  it('llmTimeout should be a positive integer', () => {
    const roundsMatch = content.match(/llmTimeout:\s*(\d+)/);
    if (roundsMatch) {
      const rounds = parseInt(roundsMatch[1]);
      expect(rounds).toBeGreaterThan(0);
    }
  });

  it('should define global constants (loaded via script tag, no module.exports)', () => {
    // These constants are loaded via <script> tag and become global const declarations
    expect(content).toContain('const DEFAULT_CHAT_SETTINGS');
    expect(content).toContain('const DEFAULT_AGENT_SETTINGS');
  });
});
