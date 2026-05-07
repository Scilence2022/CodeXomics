/**
 * DefaultSettings Constants Unit Tests
 *
 * Validates default configuration values for ChatManager and AgentSettings.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SETTINGS_SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'src/renderer/modules/chat/constants/DefaultSettings.js'),
  'utf-8'
);

// Parse the default settings objects
function parseDefaultChatSettings() {
  const match = SETTINGS_SOURCE.match(/DEFAULT_CHAT_SETTINGS\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return null;
  try {
    return eval('(' + match[1] + ')');
  } catch {
    return null;
  }
}

function parseDefaultAgentSettings() {
  const match = SETTINGS_SOURCE.match(/DEFAULT_AGENT_SETTINGS\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return null;
  try {
    return eval('(' + match[1] + ')');
  } catch {
    return null;
  }
}

describe('DefaultSettings Constants', () => {
  describe('DEFAULT_CHAT_SETTINGS', () => {
    const settings = parseDefaultChatSettings();

    it('should be parseable from source', () => {
      expect(settings).not.toBeNull();
    });

    it('should have display flag properties', () => {
      expect(settings).toHaveProperty('showThinkingProcess');
      expect(settings).toHaveProperty('showToolCalls');
      expect(settings).toHaveProperty('autoScrollToBottom');
    });

    it('display flags should be booleans', () => {
      expect(typeof settings.showThinkingProcess).toBe('boolean');
      expect(typeof settings.showToolCalls).toBe('boolean');
      expect(typeof settings.showTimestamps).toBe('boolean');
      expect(typeof settings.autoScrollToBottom).toBe('boolean');
    });

    it('should have numeric limit properties', () => {
      expect(settings).toHaveProperty('maxHistoryMessages');
      expect(settings).toHaveProperty('responseTimeout');
      expect(typeof settings.maxHistoryMessages).toBe('number');
      expect(typeof settings.responseTimeout).toBe('number');
    });

    it('limits should be positive numbers', () => {
      expect(settings.maxHistoryMessages).toBeGreaterThan(0);
      expect(settings.responseTimeout).toBeGreaterThan(0);
    });

    it('should have system prompt configuration', () => {
      expect(settings).toHaveProperty('customSystemPrompt');
      expect(settings).toHaveProperty('systemPromptIncludeSystemInstructions');
      expect(settings).toHaveProperty('systemPromptSectionOrder');
    });

    it('systemPromptSectionOrder should be an array', () => {
      expect(Array.isArray(settings.systemPromptSectionOrder)).toBe(true);
      expect(settings.systemPromptSectionOrder.length).toBeGreaterThan(0);
    });

    it('should have reasonable default values', () => {
      expect(settings.maxHistoryMessages).toBeLessThanOrEqual(10000);
      expect(settings.responseTimeout).toBeLessThanOrEqual(120000);
    });
  });

  describe('DEFAULT_AGENT_SETTINGS', () => {
    const settings = parseDefaultAgentSettings();

    it('should be parseable from source', () => {
      expect(settings).not.toBeNull();
    });

    it('should have essential agent properties', () => {
      expect(settings).toHaveProperty('enabled');
      expect(settings).toHaveProperty('memoryEnabled');
      expect(settings).toHaveProperty('llmProvider');
      expect(settings).toHaveProperty('llmTemperature');
    });

    it('llmTemperature should be between 0 and 2', () => {
      expect(settings.llmTemperature).toBeGreaterThanOrEqual(0);
      expect(settings.llmTemperature).toBeLessThanOrEqual(2);
    });

    it('llmMaxTokens should be positive', () => {
      expect(settings.llmMaxTokens).toBeGreaterThan(0);
    });

    it('llmRetryAttempts should be reasonable', () => {
      expect(settings.llmRetryAttempts).toBeGreaterThanOrEqual(1);
      expect(settings.llmRetryAttempts).toBeLessThanOrEqual(10);
    });
  });
});
