import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const WORKSPACE_HOST_MANAGER_PATH = path.join(process.cwd(), 'src/main/workspace-host-manager.js');
const MENU_BUILDER_PATH = path.join(process.cwd(), 'src/main/menu-builder.js');
const WORKSPACE_HOST_PATH = path.join(process.cwd(), 'src/renderer/workspace-host.html');
const WINDOW_TAB_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/WindowTabManager.js');
const TABS_CSS_PATH = path.join(process.cwd(), 'src/renderer/css/tabs.css');

describe('Windows window chrome', () => {
  it('uses native Windows/Linux title and menu chrome for genome host windows', () => {
    const content = fs.readFileSync(WORKSPACE_HOST_MANAGER_PATH, 'utf8');

    expect(content).toContain("titleBarStyle: 'hiddenInset'");
    expect(content).toContain('autoHideMenuBar: false');
    expect(content).not.toContain('titleBarOverlay');
    expect(content).not.toContain("titleBarStyle: 'hidden',");
  });

  it('retries genome view layout after Linux maximize state changes', () => {
    const content = fs.readFileSync(WORKSPACE_HOST_MANAGER_PATH, 'utf8');

    expect(content).toContain('function scheduleLayoutWorkspace');
    expect(content).toContain('WINDOW_LAYOUT_RETRY_DELAYS_MS = [0, 50, 150]');
    expect(content).toContain("hostWindow.on('resize', () => scheduleLayoutWorkspace(workspace));");
    expect(content).toContain("hostWindow.on('maximize', () => scheduleLayoutWorkspace(workspace));");
    expect(content).toContain("hostWindow.on('unmaximize', () => scheduleLayoutWorkspace(workspace));");
    expect(content).toContain("hostWindow.on('restore', () => scheduleLayoutWorkspace(workspace));");
    expect(content).toContain("hostWindow.on('enter-full-screen', () => scheduleLayoutWorkspace(workspace));");
    expect(content).toContain("hostWindow.on('leave-full-screen', () => scheduleLayoutWorkspace(workspace));");
  });

  it('keeps macOS-only app menu items out of the Windows main menu template', () => {
    const content = fs.readFileSync(MENU_BUILDER_PATH, 'utf8');
    const createMenuStart = content.indexOf('function createMenu()');
    const createMenuEnd = content.indexOf('// Create specialized menu for Deep Gene Research window');
    const createMenuBody = content.slice(createMenuStart, createMenuEnd);

    expect(createMenuStart).toBeGreaterThan(-1);
    expect(createMenuEnd).toBeGreaterThan(createMenuStart);
    expect(createMenuBody).not.toContain('label: APP_NAME');
    expect(createMenuBody).not.toContain("role: 'services'");
    expect(createMenuBody).toContain("process.platform !== 'darwin'");
  });

  it('separates Windows tab-bar layout from titlebar-overlay safe area layout', () => {
    const workspaceHost = fs.readFileSync(WORKSPACE_HOST_PATH, 'utf8');
    const windowTabManager = fs.readFileSync(WINDOW_TAB_MANAGER_PATH, 'utf8');
    const tabsCss = fs.readFileSync(TABS_CSS_PATH, 'utf8');

    expect(workspaceHost).toContain('padding: 4px 8px 0 8px;');
    expect(workspaceHost).toContain('platform-win32');
    expect(workspaceHost).toContain('platform-titlebar-overlay');
    expect(workspaceHost).toContain('padding-right: 178px;');

    expect(windowTabManager).toContain('window-tabs-platform-win32');
    expect(windowTabManager).toContain('window-tabs-titlebar-overlay');

    expect(tabsCss).toContain('.window-tabs-platform-win32 .window-tab-bar');
    expect(tabsCss).toContain('.window-tabs-titlebar-overlay .window-tab-bar');
    expect(tabsCss).toContain('padding-right: 178px;');
  });
});
