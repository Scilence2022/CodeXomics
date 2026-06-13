'use strict';

const { BrowserWindow, WebContentsView } = require('electron');
const { EventEmitter } = require('events');
const path = require('path');
const { createSecureWebPreferences } = require('./security-utils');

const HOST_BAR_HEIGHT = 38;

let workspaceCounter = 0;
const workspaces = new Map(); // workspaceId -> { workspaceId, window, viewIds, activeViewId }
const viewHandles = new Map(); // windowId -> GenomeViewHandle
const hostToWorkspace = new Map(); // BrowserWindow.id -> workspaceId

function generateWorkspaceId() {
  workspaceCounter += 1;
  return `workspace_host_${workspaceCounter}_${Date.now()}`;
}

function getGenomeWindowTitleBarOptions() {
  if (process.platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 11 },
    };
  }

  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#e8eef6',
      symbolColor: '#334155',
      height: HOST_BAR_HEIGHT,
    },
  };
}

function isUsableWindow(win) {
  return !!(win && typeof win.isDestroyed === 'function' && !win.isDestroyed());
}

function getNativeWindow(target) {
  if (!target) return null;
  if (typeof target.getNativeWindow === 'function') return target.getNativeWindow();
  return target;
}

function getWorkspaceForHost(hostWindow) {
  if (!isUsableWindow(hostWindow)) return null;
  return workspaces.get(hostToWorkspace.get(hostWindow.id)) || null;
}

function getWorkspaceForHandle(handle) {
  if (!handle) return null;
  return workspaces.get(handle.workspaceId) || null;
}

function getWorkspaceForWindowId(windowId) {
  return getWorkspaceForHandle(viewHandles.get(windowId));
}

function getActiveWindowIdForHost(hostWindow) {
  const workspace = getWorkspaceForHost(hostWindow);
  return workspace?.activeViewId || null;
}

function getViewHandle(windowId) {
  return viewHandles.get(windowId) || null;
}

function getAllViewHandles() {
  return Array.from(viewHandles.values()).filter(handle => !handle.isDestroyed());
}

function getContentBounds(hostWindow) {
  if (!isUsableWindow(hostWindow)) {
    return { x: 0, y: HOST_BAR_HEIGHT, width: 0, height: 0 };
  }

  const bounds =
    typeof hostWindow.getContentBounds === 'function' ? hostWindow.getContentBounds() : hostWindow.getBounds();

  return {
    x: 0,
    y: HOST_BAR_HEIGHT,
    width: Math.max(0, bounds.width),
    height: Math.max(0, bounds.height - HOST_BAR_HEIGHT),
  };
}

function layoutWorkspace(workspaceOrId) {
  const workspace = typeof workspaceOrId === 'string' ? workspaces.get(workspaceOrId) : workspaceOrId;
  if (!workspace || !isUsableWindow(workspace.window)) return;

  const contentBounds = getContentBounds(workspace.window);
  for (const windowId of workspace.viewIds) {
    const handle = viewHandles.get(windowId);
    if (!handle || handle.isDestroyed()) continue;
    handle.view.setBounds(contentBounds);
  }
}

function sendHostSnapshot(handle, snapshot) {
  const hostWindow = handle?.getNativeWindow();
  if (!isUsableWindow(hostWindow)) return;
  hostWindow.webContents.send('window-tabs-updated', snapshot);
}

class GenomeViewHandle extends EventEmitter {
  constructor({ windowId, view, workspaceId }) {
    super();
    this.windowId = windowId;
    this.view = view;
    this.webContents = view.webContents;
    this.workspaceId = workspaceId;
    this.__isGenomeViewHandle = true;

    this.webContents.once('destroyed', () => {
      this.emit('closed');
    });
  }

  getNativeWindow() {
    const workspace = getWorkspaceForHandle(this);
    return workspace?.window || null;
  }

  isDestroyed() {
    const hostWindow = this.getNativeWindow();
    return !this.view || this.webContents.isDestroyed() || !isUsableWindow(hostWindow);
  }

  isVisible() {
    const workspace = getWorkspaceForHandle(this);
    return !!(
      workspace &&
      isUsableWindow(workspace.window) &&
      workspace.window.isVisible() &&
      workspace.activeViewId === this.windowId
    );
  }

  isFocused() {
    const hostWindow = this.getNativeWindow();
    return !!(this.isVisible() && hostWindow && hostWindow.isFocused());
  }

  getBounds() {
    const hostWindow = this.getNativeWindow();
    return isUsableWindow(hostWindow) ? hostWindow.getBounds() : { x: 0, y: 0, width: 1400, height: 900 };
  }

  setBounds(bounds, animate = false) {
    const hostWindow = this.getNativeWindow();
    if (isUsableWindow(hostWindow)) {
      hostWindow.setBounds(bounds, animate);
      layoutWorkspace(this.workspaceId);
    }
  }

  center() {
    const hostWindow = this.getNativeWindow();
    if (isUsableWindow(hostWindow)) hostWindow.center();
  }

  getTitle() {
    const title = this.webContents.getTitle();
    return title || this.getNativeWindow()?.getTitle() || 'CodeXomics';
  }

  setTitle(title) {
    const hostWindow = this.getNativeWindow();
    if (isUsableWindow(hostWindow)) hostWindow.setTitle(title);
  }

  show() {
    activateGenomeView(this.windowId);
  }

  showInactive() {
    const hostWindow = this.getNativeWindow();
    if (!isUsableWindow(hostWindow) || hostWindow.isVisible()) return;
    if (typeof hostWindow.showInactive === 'function') hostWindow.showInactive();
    else hostWindow.show();
  }

  hide() {
    const hostWindow = this.getNativeWindow();
    if (isUsableWindow(hostWindow)) hostWindow.hide();
  }

  focus() {
    activateGenomeView(this.windowId);
    const hostWindow = this.getNativeWindow();
    if (isUsableWindow(hostWindow)) {
      hostWindow.focus();
      this.webContents.focus();
    }
  }

  close() {
    closeGenomeView(this.windowId);
  }

  destroy() {
    this.close();
  }

  loadFile(filePath, options) {
    return this.webContents.loadFile(filePath, options);
  }

  loadURL(url, options) {
    return this.webContents.loadURL(url, options);
  }

  detachToNewHost(bounds = null) {
    return detachGenomeViewToNewHost(this.windowId, bounds);
  }

  attachToHostOf(anchorHandle) {
    return moveGenomeViewToWorkspace(this.windowId, anchorHandle?.workspaceId || null);
  }

  sendHostSnapshot(snapshot) {
    sendHostSnapshot(this, snapshot);
  }
}

function createHostWindow(options = {}) {
  const workspaceId = generateWorkspaceId();
  const hostWindow = new BrowserWindow({
    width: options.width || 1400,
    height: options.height || 900,
    minWidth: 800,
    minHeight: 600,
    ...getGenomeWindowTitleBarOptions(),
    webPreferences: createSecureWebPreferences(),
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
  });

  const workspace = {
    workspaceId,
    window: hostWindow,
    viewIds: [],
    activeViewId: null,
  };
  workspaces.set(workspaceId, workspace);
  hostToWorkspace.set(hostWindow.id, workspaceId);
  hostWindow.__codexomicsWorkspaceId = workspaceId;
  hostWindow.__codexomicsActiveGenomeViewId = null;

  hostWindow.loadFile(path.join(__dirname, '..', 'renderer/workspace-host.html'));
  hostWindow.on('resize', () => layoutWorkspace(workspace));
  hostWindow.on('maximize', () => layoutWorkspace(workspace));
  hostWindow.on('unmaximize', () => layoutWorkspace(workspace));
  hostWindow.on('restore', () => layoutWorkspace(workspace));
  hostWindow.on('enter-full-screen', () => layoutWorkspace(workspace));
  hostWindow.on('leave-full-screen', () => layoutWorkspace(workspace));
  hostWindow.on('focus', () => {
    const activeHandle = viewHandles.get(workspace.activeViewId);
    if (activeHandle && !activeHandle.isDestroyed()) {
      activeHandle.webContents.focus();
    }
  });
  hostWindow.on('closed', () => {
    for (const windowId of [...workspace.viewIds]) {
      removeGenomeView(windowId, { destroyWebContents: true });
    }
    hostToWorkspace.delete(hostWindow.id);
    workspaces.delete(workspaceId);
  });

  return workspace;
}

function resolveWorkspaceForNewView(options = {}) {
  const sourceHandle = options.sourceHandle || null;
  const sourceWorkspace = sourceHandle ? getWorkspaceForHandle(sourceHandle) : null;
  if (sourceWorkspace && isUsableWindow(sourceWorkspace.window)) return sourceWorkspace;

  if (options.workspaceId && workspaces.has(options.workspaceId)) {
    const workspace = workspaces.get(options.workspaceId);
    if (isUsableWindow(workspace.window)) return workspace;
  }

  return createHostWindow(options);
}

function addHandleToWorkspace(handle, workspace, { activate = true } = {}) {
  if (!workspace || !isUsableWindow(workspace.window)) return;

  const currentWorkspace = getWorkspaceForHandle(handle);
  if (currentWorkspace && currentWorkspace.workspaceId !== workspace.workspaceId) {
    currentWorkspace.window.contentView.removeChildView(handle.view);
    currentWorkspace.viewIds = currentWorkspace.viewIds.filter(id => id !== handle.windowId);
    if (currentWorkspace.activeViewId === handle.windowId) {
      currentWorkspace.activeViewId = currentWorkspace.viewIds[0] || null;
      currentWorkspace.window.__codexomicsActiveGenomeViewId = currentWorkspace.activeViewId;
    }
    if (!currentWorkspace.viewIds.length && isUsableWindow(currentWorkspace.window)) {
      currentWorkspace.window.close();
    }
  }

  if (!workspace.viewIds.includes(handle.windowId)) {
    workspace.viewIds.push(handle.windowId);
  }
  handle.workspaceId = workspace.workspaceId;
  workspace.window.contentView.addChildView(handle.view);
  layoutWorkspace(workspace);

  if (activate) {
    activateGenomeView(handle.windowId);
  } else {
    handle.view.setVisible(false);
  }
}

function createGenomeView({ windowId, sourceHandle = null, activate = true, filePath = null } = {}) {
  if (!windowId) throw new Error('windowId is required to create a genome view');

  const workspace = resolveWorkspaceForNewView({ sourceHandle });
  const view = new WebContentsView({
    webPreferences: createSecureWebPreferences(),
  });
  const handle = new GenomeViewHandle({ windowId, view, workspaceId: workspace.workspaceId });
  viewHandles.set(windowId, handle);

  addHandleToWorkspace(handle, workspace, { activate: false });

  const rendererPath = path.join(__dirname, '..', 'renderer/index.html');
  view.webContents.loadFile(rendererPath, {
    query: {
      workspaceView: '1',
      windowId,
    },
  });

  view.webContents.once('did-finish-load', () => {
    view.webContents.send('set-window-id', windowId);
    view.webContents.send('ping-test');
    if (filePath) {
      view.webContents.send('load-file', filePath);
    }
  });

  view.webContents.on('focus', () => {
    activateGenomeView(windowId, { focusHost: false });
  });
  view.webContents.on('page-title-updated', () => {
    const activeWorkspace = getWorkspaceForHandle(handle);
    if (activeWorkspace?.activeViewId === windowId && isUsableWindow(activeWorkspace.window)) {
      activeWorkspace.window.setTitle(handle.getTitle());
    }
  });
  view.webContents.on('render-process-gone', (event, details) => {
    console.error(`[WorkspaceHost] Genome view ${windowId} render process gone: ${details.reason}`);
  });

  if (process.argv.includes('--dev')) {
    view.webContents.openDevTools({ mode: 'detach' });
  }

  if (activate) {
    activateGenomeView(windowId);
  }

  return handle;
}

function activateGenomeView(windowId, options = {}) {
  const handle = viewHandles.get(windowId);
  if (!handle || handle.isDestroyed()) return null;

  const workspace = getWorkspaceForHandle(handle);
  if (!workspace || !isUsableWindow(workspace.window)) return null;

  workspace.activeViewId = windowId;
  workspace.window.__codexomicsActiveGenomeViewId = windowId;
  workspace.window.setTitle(handle.getTitle());

  for (const viewId of workspace.viewIds) {
    const childHandle = viewHandles.get(viewId);
    if (!childHandle || childHandle.isDestroyed()) continue;
    childHandle.view.setVisible(viewId === windowId);
  }

  layoutWorkspace(workspace);
  if (!workspace.window.isVisible()) {
    workspace.window.show();
  }
  if (options.focusHost !== false) {
    workspace.window.focus();
    handle.webContents.focus();
  }

  return handle;
}

function moveGenomeViewToWorkspace(windowId, targetWorkspaceId, options = {}) {
  const handle = viewHandles.get(windowId);
  if (!handle || handle.isDestroyed()) {
    return { success: false, error: `Genome view '${windowId}' is not available` };
  }

  const targetWorkspace = workspaces.get(targetWorkspaceId);
  if (!targetWorkspace || !isUsableWindow(targetWorkspace.window)) {
    return { success: false, error: 'Target workspace is not available' };
  }

  addHandleToWorkspace(handle, targetWorkspace, { activate: options.activate !== false });
  return { success: true, windowId, workspaceId: targetWorkspace.workspaceId };
}

function detachGenomeViewToNewHost(windowId, bounds = null) {
  const handle = viewHandles.get(windowId);
  if (!handle || handle.isDestroyed()) {
    return { success: false, error: `Genome view '${windowId}' is not available` };
  }

  const newWorkspace = createHostWindow({
    width: bounds?.width,
    height: bounds?.height,
  });
  if (bounds && isUsableWindow(newWorkspace.window)) {
    newWorkspace.window.setBounds(bounds, false);
  }

  addHandleToWorkspace(handle, newWorkspace, { activate: true });
  return { success: true, windowId, workspaceId: newWorkspace.workspaceId };
}

function removeGenomeView(windowId, options = {}) {
  const handle = viewHandles.get(windowId);
  if (!handle) return;

  const workspace = getWorkspaceForHandle(handle);
  if (workspace && isUsableWindow(workspace.window)) {
    try {
      workspace.window.contentView.removeChildView(handle.view);
    } catch (error) {
      console.warn(`[WorkspaceHost] Failed to remove genome view ${windowId}:`, error.message);
    }
    workspace.viewIds = workspace.viewIds.filter(id => id !== windowId);
    if (workspace.activeViewId === windowId) {
      workspace.activeViewId = workspace.viewIds[0] || null;
      workspace.window.__codexomicsActiveGenomeViewId = workspace.activeViewId;
      if (workspace.activeViewId) activateGenomeView(workspace.activeViewId);
    }

    if (!workspace.viewIds.length && !workspace.window.isDestroyed()) {
      workspace.window.close();
    }
  }

  viewHandles.delete(windowId);
  if (options.destroyWebContents !== false && !handle.webContents.isDestroyed()) {
    handle.webContents.close({ waitForBeforeUnload: false });
  }
}

function closeGenomeView(windowId) {
  removeGenomeView(windowId, { destroyWebContents: true });
}

module.exports = {
  HOST_BAR_HEIGHT,
  workspaces,
  viewHandles,
  createGenomeView,
  getViewHandle,
  getAllViewHandles,
  getNativeWindow,
  getActiveWindowIdForHost,
  getWorkspaceForWindowId,
  moveGenomeViewToWorkspace,
  detachGenomeViewToNewHost,
  activateGenomeView,
  closeGenomeView,
  layoutWorkspace,
  sendHostSnapshot,
};
