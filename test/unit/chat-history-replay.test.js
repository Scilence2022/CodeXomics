import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createAgentLoopHarness } = require('../helpers/agent-loop-harness.js');
const sanitizeService = require('../../src/renderer/modules/security/SanitizeService.js');

function savedRound(manager, native) {
  const turn = { id: 'prior', sender: 'user', message: 'Check status' };
  const id = native ? 'abc' : undefined;
  manager.appendToolRoundToHistory([], {
    savedTurn: turn,
    toolsToExecute: [{ tool_name: 'get_current_state', parameters: {}, tool_call_id: id }],
    toolResults: [
      { tool: 'get_current_state', success: false, error: 'No active file', parameters: {}, tool_call_id: id },
    ],
  });
  return JSON.parse(JSON.stringify(turn));
}

describe('restored ChatBox history', () => {
  it.each([true, false])(
    'keeps completed native (%s) or fallback rounds together with their user message',
    async native => {
      const { chatManager: manager } = createAgentLoopHarness();
      const saved = savedRound(manager, native);
      manager.conversationState.historyMessageId = 'active';
      manager.configManager.getChatHistory = () => [
        { sender: 'user', message: 'Older text-only message' },
        saved,
        { sender: 'assistant', message: 'Please open a file.' },
        { sender: 'user', message: 'Check status', id: 'active' },
      ];
      const history = await manager.buildConversationHistory('Check status');
      expect(history.map(msg => msg.content).filter(text => text === 'Check status')).toHaveLength(2);
      expect(history[1].content).toBe('Older text-only message');
      expect(history[4].content).toContain('No active file');
      expect(history[4].role).toBe(native ? 'tool' : 'user');
      history[4].content = 'trimmed';
      expect(saved.toolRounds[0][1].content).toContain('No active file');
      manager.contextModeEnabled = true;
      expect((await manager.buildConversationHistory('Check status')).map(msg => msg.role)).toEqual(['system', 'user']);
    }
  );

  it('skips a damaged round and respects an empty conversation after a separator', async () => {
    const { chatManager: manager } = createAgentLoopHarness();
    const saved = savedRound(manager, true);
    saved.toolRounds[0][1].tool_call_id = 'wrong';
    const messages = [saved];
    manager.configManager.getChatHistory = () => messages;
    expect((await manager.buildConversationHistory('next')).map(msg => msg.role)).toEqual(['system', 'user', 'user']);
    messages.push({ sender: 'system', message: '--- CONVERSATION_SEPARATOR ---' });
    expect((await manager.buildConversationHistory('next')).map(msg => msg.role)).toEqual(['system', 'user']);
  });

  it('restores a checkpoint passively and honors the activity history preference', () => {
    const { chatManager: manager } = createAgentLoopHarness();
    const turn = savedRound(manager, true);
    document.body.innerHTML = '<div id="chatMessages"><div class="message user-message"><p id="prior"></p></div></div>';
    manager.showThinkingProcess = true;
    manager.conversationState.historyMessageId = 'prior';
    manager.configManager.getChatHistory = () => [turn];
    manager.configManager.saveChatCheckpoint = vi.fn();
    window.SanitizeService = sanitizeService;
    const container = document.querySelector('#chatMessages');
    const panel = document.createElement('div');
    panel.className = 'message thinking-process';
    panel.innerHTML =
      '<div class="thinking-header"><span class="activity-summary"></span></div><details open><summary>Round 1</summary>Result</details>';
    container.appendChild(panel);
    manager.saveChatTurn();
    container.replaceChildren();
    manager.restoreChatActivity(container, turn);
    expect(container.textContent).toContain('Interrupted');
    expect(container.textContent).toContain('Result');
    expect(container.querySelector('details').open).toBe(true);
    expect(manager.configManager.saveChatCheckpoint).toHaveBeenCalledTimes(1);
    manager.chatBoxSettingsManager.getSetting = () => false;
    manager.saveChatTurn();
    expect(turn.activityHtml).toBeUndefined();
    expect(turn.toolRounds).toHaveLength(1);
  });
});
