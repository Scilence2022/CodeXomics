/**
 * Available Tools Display
 *
 * Covers the "Show available tools" feature: the Dynamic Tool registry listing that
 * renders into the thinking-process panel before the first LLM round, plus its
 * dedicated ChatBox setting and the gating logic in displayAvailableToolsInThinking().
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const CHAT_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
const SETTINGS_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatBoxSettingsManager.js');

function loadChatManagerClass() {
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    window: {},
    document: { getElementById: () => null, querySelector: () => null },
    Date,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const src = fs.readFileSync(CHAT_MANAGER_PATH, 'utf8') + '\nglobalThis.__ChatManager = ChatManager;';
  vm.runInContext(src, sandbox, { filename: 'ChatManager.js' });
  return sandbox.__ChatManager;
}

function baseMock(overrides = {}) {
  const captured = [];
  const mock = {
    showThinkingProcess: true,
    showAvailableTools: true,
    dynamicToolsEnabled: true,
    dynamicTools: {},
    services: {
      context: {
        renderAvailableToolsVisualization: (data, opts) =>
          `<<RENDERED title=${opts.title} open=${opts.categoriesOpen} total=${data.total_tools}>>`,
      },
    },
    async listAvailableTools() {
      return {
        success: true,
        total_tools: 7,
        categories: { nav: { name: 'Nav', count: 1, tools: [{ name: 'navigate_to_position' }] } },
        tools: [{ name: 'navigate_to_position' }],
      };
    },
    updateThinkingMessage(block) {
      captured.push(block);
    },
    escapeHtml: s => s,
    getLastUserQuery: () => '',
    getCurrentContext: () => ({}),
    ...overrides,
  };
  return { mock, captured };
}

describe('Available Tools Display - ChatBox setting wiring', () => {
  it('defines the showAvailableTools setting (default true) in ChatBoxSettingsManager', () => {
    const content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    // Present in both the constructor defaults and the resetToDefaults block.
    const occurrences = content.match(/showAvailableTools:\s*true/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    // Checkbox in the settings UI and a human-readable label.
    expect(content).toContain('id="showAvailableTools"');
    expect(content).toContain("showAvailableTools: 'Available Tools Display'");
  });

  it('loads showAvailableTools from the settings manager in ChatManager', () => {
    const content = fs.readFileSync(CHAT_MANAGER_PATH, 'utf-8');
    expect(content).toContain(
      "this.showAvailableTools = this.chatBoxSettingsManager.getSetting('showAvailableTools', true);"
    );
  });
});

describe('Available Tools Display - displayAvailableToolsInThinking gating', () => {
  const ChatManager = loadChatManagerClass();

  it('renders the tools panel into the thinking process when enabled', async () => {
    const { mock, captured } = baseMock();
    await ChatManager.prototype.displayAvailableToolsInThinking.call(mock);
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('Available tools from Dynamic Tool registry (7)');
    expect(captured[0]).toContain('<<RENDERED');
  });

  it('does NOT render when the showAvailableTools setting is disabled', async () => {
    const { mock, captured } = baseMock({ showAvailableTools: false });
    await ChatManager.prototype.displayAvailableToolsInThinking.call(mock);
    expect(captured.length).toBe(0);
  });

  it('does NOT render when the thinking process is hidden', async () => {
    const { mock, captured } = baseMock({ showThinkingProcess: false });
    await ChatManager.prototype.displayAvailableToolsInThinking.call(mock);
    expect(captured.length).toBe(0);
  });

  it('emits a visible note (never silent) when the registry enumeration fails', async () => {
    const { mock, captured } = baseMock({ listAvailableTools: async () => ({ success: false }) });
    await ChatManager.prototype.displayAvailableToolsInThinking.call(mock);
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('Tool registry unavailable');
  });

  it('emits a visible note when the registry is empty', async () => {
    const { mock, captured } = baseMock({
      listAvailableTools: async () => ({ success: true, total_tools: 0, categories: {}, tools: [] }),
    });
    await ChatManager.prototype.displayAvailableToolsInThinking.call(mock);
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('No tools registered');
  });
});
