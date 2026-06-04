import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CHAT_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
const RENDERER_PATH = path.join(process.cwd(), 'src/renderer/renderer-modular.js');

describe('ChatBox visibility startup behavior', () => {
  it('creates the ChatBox in a visible state on startup', () => {
    const content = fs.readFileSync(CHAT_MANAGER_PATH, 'utf-8');

    expect(content).toContain("const existingChatPanel = document.getElementById('llmChatPanel');");
    expect(content).toContain("existingChatPanel.style.display = 'flex';");
    expect(content).toContain("chatPanel.style.display = 'flex';");
    expect(content).toContain("this.configManager.set('chat.visible', true);");
  });

  it('renders ChatBox before optional service initialization can fail', () => {
    const content = fs.readFileSync(CHAT_MANAGER_PATH, 'utf-8');
    const uiIndex = content.indexOf('this.initializeUI();');
    const servicesIndex = content.indexOf('this.initializeServices();');

    expect(content).toContain('initializeServices()');
    expect(uiIndex).toBeGreaterThan(-1);
    expect(servicesIndex).toBeGreaterThan(-1);
    expect(uiIndex).toBeLessThan(servicesIndex);
  });

  it('falls back to document.body if the app container is unavailable', () => {
    const content = fs.readFileSync(CHAT_MANAGER_PATH, 'utf-8');

    expect(content).toContain("const appDiv = document.getElementById('app') || document.body;");
  });

  it('uses the real ChatBox panel selector when revealing chat from renderer flows', () => {
    const content = fs.readFileSync(RENDERER_PATH, 'utf-8');

    expect(content).toContain('this.chatManager.showChatBox();');
    expect(content).toContain("document.getElementById('llmChatPanel')");
    expect(content).not.toContain("document.querySelector('.chat-container')");
  });
});
