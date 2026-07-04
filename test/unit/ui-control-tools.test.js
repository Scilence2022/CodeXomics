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

  it('releases the docked ChatBox layout space when hidden', async () => {
    document.body.innerHTML = `
      <div id="chatDockSplitter" style="display: flex"></div>
      <aside id="chatDockContainer" style="display: flex">
        <section id="llmChatPanel" class="docked" style="display: flex"></section>
      </aside>
    `;
    const manager = Object.create(ChatManager.prototype);
    manager.isDocked = true;
    manager.configManager = { set: vi.fn() };
    manager.ensureChatPanelInViewport = vi.fn();
    manager.notifyDockLayoutChanged = vi.fn();

    await manager.toggleChatBox({ action: 'hide' });

    expect(document.getElementById('llmChatPanel').style.display).toBe('none');
    expect(document.getElementById('chatDockContainer').style.display).toBe('none');
    expect(document.getElementById('chatDockSplitter').style.display).toBe('none');
    expect(manager.notifyDockLayoutChanged).toHaveBeenCalledWith('visibility');

    await manager.toggleChatBox({ action: 'show' });

    expect(document.getElementById('llmChatPanel').style.display).toBe('flex');
    expect(document.getElementById('chatDockContainer').style.display).toBe('flex');
    expect(document.getElementById('chatDockSplitter').style.display).toBe('flex');
  });

  it('docks, floats, and toggles the ChatBox layout while preserving hidden visibility', async () => {
    document.body.innerHTML = `
      <div id="app">
        <section id="llmChatPanel" style="display: none; left: 12px; top: 18px; width: 420px; height: 560px"></section>
      </div>
      <div id="chatDockSplitter" style="display: none"></div>
      <aside id="chatDockContainer" style="display: none"></aside>
      <button id="dockChatBtn"></button>
      <button id="resetChatPositionBtn"></button>
    `;
    const manager = Object.create(ChatManager.prototype);
    manager.isDocked = false;
    const store = new Map();
    manager.configManager = {
      get: vi.fn((key, fallback) => (store.has(key) ? store.get(key) : fallback)),
      set: vi.fn((key, value) => store.set(key, value)),
    };
    manager.getDefaultChatPosition = vi.fn(() => ({ x: 24, y: 32 }));
    manager.hideDockIndicator = vi.fn();
    manager.hideUndockIndicator = vi.fn();
    manager.setupDockSplitterDragging = vi.fn();
    manager.notifyDockLayoutChanged = vi.fn();

    await expect(manager.setChatBoxLayout({ mode: 'docked' })).resolves.toMatchObject({
      success: true,
      new_state: 'docked',
      visible: false,
    });
    expect(manager.isDocked).toBe(true);
    expect(document.getElementById('llmChatPanel').style.display).toBe('none');
    expect(document.getElementById('chatDockContainer').style.display).toBe('none');

    await expect(manager.setChatBoxLayout({ mode: 'floating' })).resolves.toMatchObject({
      success: true,
      new_state: 'floating',
      visible: false,
    });
    expect(manager.isDocked).toBe(false);
    expect(document.getElementById('app').contains(document.getElementById('llmChatPanel'))).toBe(true);
  });

  it('minimizes and restores the ChatBox idempotently', async () => {
    document.body.innerHTML = `
      <section id="llmChatPanel" style="display: flex"></section>
      <button id="minimizeChatBtn" title="Minimize window"><i class="fas fa-minus"></i></button>
    `;
    const manager = Object.create(ChatManager.prototype);

    await expect(manager.setChatBoxMinimized({ action: 'minimize' })).resolves.toMatchObject({
      success: true,
      new_state: 'minimized',
    });
    await manager.setChatBoxMinimized({ action: 'minimize' });
    expect(document.getElementById('llmChatPanel').classList.contains('minimized')).toBe(true);
    expect(document.querySelector('#minimizeChatBtn i').className).toBe('fas fa-window-maximize');

    await expect(manager.setChatBoxMinimized({ action: 'restore' })).resolves.toMatchObject({
      success: true,
      new_state: 'restored',
    });
    expect(document.getElementById('llmChatPanel').classList.contains('minimized')).toBe(false);
    expect(document.querySelector('#minimizeChatBtn i').className).toBe('fas fa-minus');

    await expect(manager.setChatBoxMinimized({ action: 'maximize' })).resolves.toMatchObject({
      success: true,
      new_state: 'restored',
    });
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

  it('shows, hides, and toggles individual Sidebar panels', async () => {
    document.body.innerHTML = `
      <main class="main-content sidebar-collapsed"></main>
      <aside id="sidebar" class="collapsed" style="width: 0px; min-width: 0px; overflow: hidden">
        <section class="sidebar-section" id="tracksSection" style="display: none"></section>
        <section class="sidebar-section" id="featuresSection" style="display: block"></section>
      </aside>
      <div id="sidebarSplitter" class="collapsed"></div>
      <button id="splitterToggleBtn"></button>
      <input id="toggleSidebar" type="checkbox">
    `;
    const sidebar = document.getElementById('sidebar');
    Object.defineProperty(sidebar, 'offsetWidth', {
      configurable: true,
      get: () => (sidebar.classList.contains('collapsed') ? 0 : parseInt(sidebar.style.width, 10) || 0),
    });
    const uiManager = new UIManager({ tabManager: { updateCurrentTabSidebarPanel: vi.fn() } });
    const manager = Object.create(ChatManager.prototype);
    manager.app = { uiManager };

    await expect(manager.toggleSidebarPanel({ panel_name: 'tracks', action: 'open' })).resolves.toMatchObject({
      success: true,
      panel_name: 'tracks',
      new_state: 'shown',
    });
    expect(document.getElementById('tracksSection').style.display).toBe('block');
    expect(sidebar.classList.contains('collapsed')).toBe(false);

    await expect(manager.toggleSidebarPanel({ panel_name: 'tracks', action: 'close' })).resolves.toMatchObject({
      success: true,
      panel_name: 'tracks',
      new_state: 'hidden',
    });
    expect(document.getElementById('tracksSection').style.display).toBe('none');

    await expect(manager.toggleSidebarPanel({ panel_name: 'features', action: 'toggle' })).resolves.toMatchObject({
      success: true,
      panel_name: 'features',
      new_state: 'hidden',
    });
    expect(document.getElementById('featuresSection').style.display).toBe('none');
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
    const toolNames = [
      'toggle_chatbox',
      'set_chatbox_layout',
      'set_chatbox_minimized',
      'toggle_sidebar',
      'toggle_sidebar_panel',
      'toggle_top_banner',
    ];

    for (const toolName of toolNames) {
      expect(integration.builtInToolsMap.has(toolName)).toBe(true);
      expect(utilityTools[toolName]).toBeDefined();
      expect(policy.getPolicyForTool(toolName).name).toBe('system_utility');
    }

    expect(integration.analyzeBuiltInToolRelevance('Please hide the ChatBox').map(tool => tool.name)).toContain(
      'toggle_chatbox'
    );
    expect(integration.analyzeBuiltInToolRelevance('Dock the ChatBox').map(tool => tool.name)).toContain(
      'set_chatbox_layout'
    );
    expect(integration.analyzeBuiltInToolRelevance('Minimize the ChatBox').map(tool => tool.name)).toContain(
      'set_chatbox_minimized'
    );
    expect(integration.analyzeBuiltInToolRelevance('Collapse the main sidebar').map(tool => tool.name)).toContain(
      'toggle_sidebar'
    );
    expect(
      integration.analyzeBuiltInToolRelevance('Show the tracks panel in the sidebar').map(tool => tool.name)
    ).toContain('toggle_sidebar_panel');
    expect(integration.analyzeBuiltInToolRelevance('Toggle the top banner').map(tool => tool.name)).toContain(
      'toggle_top_banner'
    );
  });
});
