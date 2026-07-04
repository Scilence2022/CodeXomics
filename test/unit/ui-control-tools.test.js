import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ChatManager = require('../../src/renderer/modules/ChatManager.js');
const UIManager = require('../../src/renderer/modules/UIManager.js');
const BuiltInToolsIntegration = require('../../tools_registry/builtin_tools_integration.js');
const UtilityTools = require('../../src/mcp-tools/utility/UtilityTools.js');
const ToolCapabilityPolicy = require('../../src/renderer/modules/chat/services/ToolCapabilityPolicy.js');

describe('UI control tools', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('shows, hides, and toggles the ChatBox idempotently', async () => {
    document.body.innerHTML = '<section id="llmChatPanel" style="display: flex"></section>';
    const manager = Object.create(ChatManager.prototype);
    manager.configManager = { set: vi.fn() };
    manager.ensureChatPanelInViewport = vi.fn();

    await expect(manager.toggleChatBox({ action: 'hide' })).resolves.toMatchObject({
      success: true,
      new_state: 'hidden',
    });
    expect(document.getElementById('llmChatPanel').style.display).toBe('none');

    await expect(manager.toggleChatBox({ action: 'hide' })).resolves.toMatchObject({
      success: true,
      new_state: 'hidden',
    });
    await expect(manager.toggleChatBox({ action: 'toggle' })).resolves.toMatchObject({
      success: true,
      new_state: 'shown',
    });
    expect(document.getElementById('llmChatPanel').style.display).toBe('flex');
  });

  it('expands and collapses the Sidebar without losing its saved width', async () => {
    document.body.innerHTML = `
      <main class="main-content"></main>
      <aside id="sidebar" style="width: 320px"></aside>
      <div id="sidebarSplitter"></div>
      <button id="splitterToggleBtn"></button>
      <input id="toggleSidebar" type="checkbox" checked>
    `;
    const sidebar = document.getElementById('sidebar');
    Object.defineProperty(sidebar, 'offsetWidth', {
      configurable: true,
      get: () => (sidebar.classList.contains('collapsed') ? 0 : parseInt(sidebar.style.width, 10) || 0),
    });

    const uiManager = new UIManager({});
    const manager = Object.create(ChatManager.prototype);
    manager.app = { uiManager };

    await expect(manager.toggleSidebar({ action: 'collapse' })).resolves.toMatchObject({
      success: true,
      new_state: 'collapsed',
    });
    await manager.toggleSidebar({ action: 'collapse' });
    expect(sidebar.dataset.previousWidth).toBe('320px');

    await expect(manager.toggleSidebar({ action: 'expand' })).resolves.toMatchObject({
      success: true,
      new_state: 'expanded',
    });
    expect(sidebar.style.width).toBe('320px');
    expect(document.getElementById('toggleSidebar').checked).toBe(true);
  });

  it('uses TabManager state to toggle the top banner', async () => {
    const tabManager = {
      bannerCollapsed: false,
      setBannerCollapsed: vi.fn(function (collapsed) {
        this.bannerCollapsed = collapsed;
        return true;
      }),
    };
    const manager = Object.create(ChatManager.prototype);
    manager.app = { tabManager };

    await expect(manager.toggleTopBanner()).resolves.toMatchObject({
      success: true,
      new_state: 'collapsed',
    });
    expect(tabManager.setBannerCollapsed).toHaveBeenCalledWith(true);

    await expect(manager.toggleTopBanner({ action: 'expand' })).resolves.toMatchObject({
      success: true,
      new_state: 'expanded',
    });
    expect(tabManager.setBannerCollapsed).toHaveBeenLastCalledWith(false);
  });

  it('registers, detects, exposes, and explicitly permits all three tools', () => {
    const integration = new BuiltInToolsIntegration();
    const utilityTools = new UtilityTools({}).getTools();
    const policy = new ToolCapabilityPolicy();
    const toolNames = ['toggle_chatbox', 'toggle_sidebar', 'toggle_top_banner'];

    for (const toolName of toolNames) {
      expect(integration.builtInToolsMap.has(toolName)).toBe(true);
      expect(utilityTools[toolName]).toBeDefined();
      expect(policy.getPolicyForTool(toolName).name).toBe('system_utility');
    }

    expect(integration.analyzeBuiltInToolRelevance('Please hide the ChatBox').map(tool => tool.name)).toContain(
      'toggle_chatbox'
    );
    expect(integration.analyzeBuiltInToolRelevance('Collapse the main sidebar').map(tool => tool.name)).toContain(
      'toggle_sidebar'
    );
    expect(integration.analyzeBuiltInToolRelevance('Toggle the top banner').map(tool => tool.name)).toContain(
      'toggle_top_banner'
    );
  });
});
