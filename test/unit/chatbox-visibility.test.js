import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CHAT_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
const RENDERER_PATH = path.join(process.cwd(), 'src/renderer/renderer-modular.js');
const CONFIG_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/ConfigManager.js');

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

  it('falls back to localStorage when hardened renderer blocks file config APIs', () => {
    const content = fs.readFileSync(CONFIG_MANAGER_PATH, 'utf-8');

    expect(content).toContain('File-based configuration unavailable, falling back to localStorage');
    expect(content).toContain('File-based configuration save unavailable, falling back to localStorage');
    expect(content).toContain('return false;');
  });
});
