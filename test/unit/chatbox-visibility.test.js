import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { runInNewContext } from 'node:vm';

const CHAT_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
const RENDERER_PATH = path.join(process.cwd(), 'src/renderer/renderer-modular.js');
const CONFIG_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/ConfigManager.js');
const CHATBOX_LAYOUT_PATH = path.join(process.cwd(), 'src/renderer/css/legacy/03-gene-annotation-actions.css');

describe('ChatBox visibility startup behavior', () => {
  it('creates the ChatBox in a visible state on startup', () => {
    const content = fs.readFileSync(CHAT_MANAGER_PATH, 'utf-8');

    expect(content).toContain("const existingChatPanel = document.getElementById('llmChatPanel');");
    expect(content).toContain("existingChatPanel.style.display = 'flex';");
    expect(content).toContain("chatPanel.style.display = 'flex';");
    expect(content).toContain("this.configManager.set('chat.visible', true);");
  });

  it('initializes optional services defensively before ChatBox interaction setup', () => {
    const content = fs.readFileSync(CHAT_MANAGER_PATH, 'utf-8');
    const uiIndex = content.indexOf('this.initializeUI();');
    const servicesIndex = content.indexOf('this.initializeServices();');

    expect(content).toContain('initializeServices()');
    // eslint-disable-next-line no-template-curly-in-string -- asserting the literal source text is present
    expect(content).toContain('console.warn(`[ChatManager] ${className} not available; ${key} service disabled`);');
    // eslint-disable-next-line no-template-curly-in-string -- asserting the literal source text is present
    expect(content).toContain('console.warn(`[ChatManager] Failed to initialize ${className}:`, error);');
    expect(uiIndex).toBeGreaterThan(-1);
    expect(servicesIndex).toBeGreaterThan(-1);
    expect(servicesIndex).toBeLessThan(uiIndex);
  });

  it('falls back to document.body if the app container is unavailable', () => {
    const content = fs.readFileSync(CHAT_MANAGER_PATH, 'utf-8');

    expect(content).toContain("const appDiv = document.getElementById('app') || document.body;");
  });

  it('clamps ChatBox geometry into the viewport on startup and forced show', () => {
    const content = fs.readFileSync(CHAT_MANAGER_PATH, 'utf-8');

    expect(content).toContain('normalizeChatSize(');
    expect(content).toContain('normalizeChatPosition(');
    expect(content).toContain('ensureChatPanelInViewport(chatPanel);');
    expect(content).toContain('ensureChatPanelInViewport(existingChatPanel);');
  });

  it('uses the real ChatBox panel selector when revealing chat from renderer flows', () => {
    const content = fs.readFileSync(RENDERER_PATH, 'utf-8');

    expect(content).toContain('this.chatManager.showChatBox();');
    expect(content).toContain("document.getElementById('llmChatPanel')");
    expect(content).not.toContain("document.querySelector('.chat-container')");
  });

  it('falls back to localStorage when the file configuration save is rejected', async () => {
    const content = fs.readFileSync(CONFIG_MANAGER_PATH, 'utf-8');
    const ConfigManager = runInNewContext(`${content}\nConfigManager`, {
      window: { electronAPI: { saveConfigData: async () => ({ success: false, error: 'disk is read-only' }) } },
      console: { error() {} },
    });
    const manager = Object.create(ConfigManager.prototype);
    manager.waitForInitialization = async () => {};
    manager.buildPersistableConfig = () => ({ llm: { providers: {} } });
    manager.validateAndCleanData = data => data;
    manager.saveToLocalStorage = () => ({ success: true, credentialsPersisted: false });

    await expect(manager.saveConfig()).resolves.toEqual({ success: true, credentialsPersisted: false });
  });

  it('keeps only the compact composer controls visible when minimized', () => {
    const content = fs.readFileSync(CHATBOX_LAYOUT_PATH, 'utf-8');

    expect(content).toContain('.chat-panel.minimized .chat-input-container {');
    expect(content).toContain('display: block !important;');
    expect(content).toContain('.chat-panel.minimized .chat-input-options,');
    expect(content).toContain('.chat-panel.minimized .chat-actions,');
    expect(content).toContain('.chat-panel.minimized .chat-abort-btn {');
  });
});
