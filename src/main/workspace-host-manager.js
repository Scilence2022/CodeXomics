'use strict';

const { BrowserWindow, View, WebContentsView, webContents: electronWebContents } = require('electron');
const { EventEmitter } = require('events');
const path = require('path');
const { createSecureWebPreferences } = require('./security-utils');

const HOST_BAR_HEIGHT = 38;
const DEVTOOLS_RIGHT_WIDTH_RATIO = 0.42;
const DEVTOOLS_RIGHT_MIN_WIDTH = 380;
const DEVTOOLS_RIGHT_MAX_WIDTH = 760;
const DEVTOOLS_BOTTOM_HEIGHT_RATIO = 0.42;
const DEVTOOLS_BOTTOM_MIN_HEIGHT = 260;
const DEVTOOLS_BOTTOM_MAX_HEIGHT = 520;
const DEVTOOLS_MIN_APP_WIDTH = 520;
const DEVTOOLS_MIN_APP_HEIGHT = 320;
const DEVTOOLS_SPLITTER_SIZE = 7;
const WINDOW_LAYOUT_RETRY_DELAYS_MS = [0, 50, 150];
const DEVTOOLS_SPLITTER_HTML = encodeURIComponent(`<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: transparent;
      }

      body {
        cursor: ew-resize;
      }
    </style>
  </head>
  <body></body>
</html>`);

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
    autoHideMenuBar: false,
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getDevToolsSplitBounds(contentBounds, handle = null) {
  const canDockRight = contentBounds.width >= DEVTOOLS_MIN_APP_WIDTH + DEVTOOLS_RIGHT_MIN_WIDTH;
  if (canDockRight) {
    const maxWidth = Math.min(
      DEVTOOLS_RIGHT_MAX_WIDTH,
      contentBounds.width - DEVTOOLS_MIN_APP_WIDTH - DEVTOOLS_SPLITTER_SIZE
    );
    const preferredWidth =
      Number.isFinite(handle?.devToolsPreferredWidth) && handle.devToolsPreferredWidth > 0
        ? handle.devToolsPreferredWidth
        : Math.round(contentBounds.width * DEVTOOLS_RIGHT_WIDTH_RATIO);
    const width = clamp(preferredWidth, DEVTOOLS_RIGHT_MIN_WIDTH, maxWidth);
    const appWidth = Math.max(0, contentBounds.width - width - DEVTOOLS_SPLITTER_SIZE);
    return {
      orientation: 'right',
      appBounds: {
        ...contentBounds,
        width: appWidth,
      },
      splitterBounds: {
        x: contentBounds.x + appWidth,
        y: contentBounds.y,
        width: DEVTOOLS_SPLITTER_SIZE,
        height: contentBounds.height,
      },
      devToolsBounds: {
        x: contentBounds.x + appWidth + DEVTOOLS_SPLITTER_SIZE,
        y: contentBounds.y,
        width,
        height: contentBounds.height,
      },
    };
  }

  const maxHeight = Math.max(
    160,
    Math.min(DEVTOOLS_BOTTOM_MAX_HEIGHT, contentBounds.height - DEVTOOLS_MIN_APP_HEIGHT - DEVTOOLS_SPLITTER_SIZE)
  );
  const preferredHeight =
    Number.isFinite(handle?.devToolsPreferredHeight) && handle.devToolsPreferredHeight > 0
      ? handle.devToolsPreferredHeight
      : Math.round(contentBounds.height * DEVTOOLS_BOTTOM_HEIGHT_RATIO);
  const height = clamp(preferredHeight, DEVTOOLS_BOTTOM_MIN_HEIGHT, maxHeight);
  const appHeight = Math.max(0, contentBounds.height - height - DEVTOOLS_SPLITTER_SIZE);
  return {
    orientation: 'bottom',
    appBounds: {
      ...contentBounds,
      height: appHeight,
    },
    splitterBounds: {
      x: contentBounds.x,
      y: contentBounds.y + appHeight,
      width: contentBounds.width,
      height: DEVTOOLS_SPLITTER_SIZE,
    },
    devToolsBounds: {
      x: contentBounds.x,
      y: contentBounds.y + appHeight + DEVTOOLS_SPLITTER_SIZE,
      width: contentBounds.width,
      height,
    },
  };
}

function shouldShowDevToolsForHandle(handle) {
  return !!(
    handle &&
    !handle.isDestroyed() &&
    handle.isDevToolsPanelOpen &&
    handle.devToolsView &&
    !handle.devToolsView.webContents.isDestroyed() &&
    !handle.webContents.isDestroyed()
  );
}

function layoutWorkspace(workspaceOrId) {
  const workspace = typeof workspaceOrId === 'string' ? workspaces.get(workspaceOrId) : workspaceOrId;
  if (!workspace || !isUsableWindow(workspace.window)) return;

  const contentBounds = getContentBounds(workspace.window);
  const activeHandle = viewHandles.get(workspace.activeViewId);
  const showActiveDevTools = shouldShowDevToolsForHandle(activeHandle);
  const split = showActiveDevTools ? getDevToolsSplitBounds(contentBounds, activeHandle) : null;
  const appBounds = split?.appBounds || contentBounds;
  const devToolsBounds = split?.devToolsBounds || null;
  const splitterBounds = split?.splitterBounds || null;
  workspace.currentDevToolsSplit = split;

  for (const windowId of workspace.viewIds) {
    const handle = viewHandles.get(windowId);
    if (!handle || handle.isDestroyed()) continue;
    const isActive = windowId === workspace.activeViewId;
    handle.view.setBounds(isActive ? appBounds : contentBounds);
    handle.view.setVisible(isActive);

    if (!handle.devToolsView || handle.devToolsView.webContents.isDestroyed()) continue;
    if (isActive && showActiveDevTools && devToolsBounds) {
      handle.devToolsView.setBounds(devToolsBounds);
      handle.devToolsView.setVisible(true);
      workspace.window.contentView.addChildView(handle.devToolsView);
    } else {
      handle.devToolsView.setVisible(false);
    }
  }

  if (workspace.devToolsSplitterView && !workspace.devToolsSplitterView.webContents.isDestroyed()) {
    if (showActiveDevTools && splitterBounds) {
      const splitterEventBounds = workspace.devToolsDragState ? contentBounds : splitterBounds;
      workspace.devToolsSplitterView.setBounds(splitterEventBounds);
      workspace.devToolsSplitterView.setVisible(true);
      updateDevToolsSplitterLine(workspace, split);
      if (workspace.devToolsSplitterLineView) {
        workspace.window.contentView.addChildView(workspace.devToolsSplitterLineView);
      }
      workspace.window.contentView.addChildView(workspace.devToolsSplitterView);
    } else {
      workspace.devToolsSplitterView.setVisible(false);
      if (workspace.devToolsSplitterLineView) {
        workspace.devToolsSplitterLineView.setVisible(false);
      }
      workspace.devToolsDragState = null;
    }
  }
}

function clearScheduledLayout(workspace) {
  if (!workspace?.layoutRetryTimers) return;
  for (const timer of workspace.layoutRetryTimers) {
    clearTimeout(timer);
  }
  workspace.layoutRetryTimers = [];
}

function scheduleLayoutWorkspace(workspaceOrId, options = {}) {
  const workspace = typeof workspaceOrId === 'string' ? workspaces.get(workspaceOrId) : workspaceOrId;
  if (!workspace || !isUsableWindow(workspace.window)) return;

  clearScheduledLayout(workspace);

  if (options.immediate !== false) {
    layoutWorkspace(workspace);
  }

  // Linux window managers can emit maximize before Electron reports the final content bounds.
  workspace.layoutRetryTimers = WINDOW_LAYOUT_RETRY_DELAYS_MS.map(delay =>
    setTimeout(() => {
      if (!workspace || !isUsableWindow(workspace.window)) return;
      layoutWorkspace(workspace);
      if (delay === WINDOW_LAYOUT_RETRY_DELAYS_MS[WINDOW_LAYOUT_RETRY_DELAYS_MS.length - 1]) {
        workspace.layoutRetryTimers = [];
      }
    }, delay)
  );
}

function sendHostSnapshot(handle, snapshot) {
  const hostWindow = handle?.getNativeWindow();
  if (!isUsableWindow(hostWindow)) return;
  hostWindow.webContents.send('window-tabs-updated', snapshot);
}

function createDevToolsSplitterView(workspace) {
  const splitterView = new WebContentsView({
    webPreferences: createSecureWebPreferences(),
  });
  splitterView.setBackgroundColor('#00000000');
  splitterView.setVisible(false);
  splitterView.webContents.loadURL(`data:text/html;charset=utf-8,${DEVTOOLS_SPLITTER_HTML}`);
  splitterView.webContents.on('before-mouse-event', (event, mouse) => {
    if (mouse.type === 'mouseDown' && mouse.button === 'left') {
      event.preventDefault();
      startDevToolsSplitterDrag(workspace, mouse);
      return;
    }

    if (!workspace.devToolsDragState) return;
    event.preventDefault();

    if (mouse.type === 'mouseMove') {
      updateDevToolsSplitterDrag(workspace, mouse);
    } else if (mouse.type === 'mouseUp') {
      updateDevToolsSplitterDrag(workspace, mouse);
      finishDevToolsSplitterDrag(workspace);
    }
  });
  return splitterView;
}

function createDevToolsSplitterLineView() {
  const lineView = new View();
  lineView.setBackgroundColor('#111');
  lineView.setVisible(false);
  return lineView;
}

function getActiveDevToolsHandle(workspace) {
  if (!workspace) return null;
  const handle = viewHandles.get(workspace.activeViewId);
  return shouldShowDevToolsForHandle(handle) ? handle : null;
}

function getDevToolsDragLimits(contentBounds, orientation) {
  if (orientation === 'right') {
    return {
      min: DEVTOOLS_RIGHT_MIN_WIDTH,
      max: Math.min(DEVTOOLS_RIGHT_MAX_WIDTH, contentBounds.width - DEVTOOLS_MIN_APP_WIDTH - DEVTOOLS_SPLITTER_SIZE),
    };
  }

  return {
    min: DEVTOOLS_BOTTOM_MIN_HEIGHT,
    max: Math.max(
      160,
      Math.min(DEVTOOLS_BOTTOM_MAX_HEIGHT, contentBounds.height - DEVTOOLS_MIN_APP_HEIGHT - DEVTOOLS_SPLITTER_SIZE)
    ),
  };
}

function updateDevToolsSplitterLine(workspace, split) {
  const lineView = workspace?.devToolsSplitterLineView;
  if (!lineView || !split?.splitterBounds) return;

  if (split.orientation === 'right') {
    lineView.setBounds({
      x: split.splitterBounds.x + Math.floor(DEVTOOLS_SPLITTER_SIZE / 2),
      y: split.splitterBounds.y,
      width: 1,
      height: split.splitterBounds.height,
    });
  } else {
    lineView.setBounds({
      x: split.splitterBounds.x,
      y: split.splitterBounds.y + Math.floor(DEVTOOLS_SPLITTER_SIZE / 2),
      width: split.splitterBounds.width,
      height: 1,
    });
  }

  lineView.setVisible(true);
}

function getMouseContentPoint(workspace, mouse = {}) {
  const eventBounds = workspace?.devToolsSplitterView?.getBounds?.() || { x: 0, y: 0 };
  return {
    x: eventBounds.x + Number(mouse.x || 0),
    y: eventBounds.y + Number(mouse.y || 0),
  };
}

function getDevToolsDragFocusTargetId(workspace, handle) {
  const focusedWebContents = electronWebContents.getFocusedWebContents();
  const allowedIds = new Set(
    [workspace?.window?.webContents?.id, handle?.webContents?.id, handle?.devToolsView?.webContents?.id].filter(
      Number.isFinite
    )
  );

  if (focusedWebContents && allowedIds.has(focusedWebContents.id)) {
    return focusedWebContents.id;
  }

  return handle?.webContents?.id || null;
}

function startDevToolsSplitterDrag(workspace, mouse) {
  const handle = getActiveDevToolsHandle(workspace);
  const split = workspace?.currentDevToolsSplit;
  if (!workspace || !handle || !split) return;

  const point = getMouseContentPoint(workspace, mouse);
  workspace.devToolsDragState = {
    orientation: split.orientation,
    startWidth: split.devToolsBounds.width,
    startHeight: split.devToolsBounds.height,
    startX: point.x,
    startY: point.y,
    focusedWebContentsId: getDevToolsDragFocusTargetId(workspace, handle),
  };
  layoutWorkspace(workspace);
}

function updateDevToolsSplitterDrag(workspace, mouse) {
  const handle = getActiveDevToolsHandle(workspace);
  if (!workspace || !handle || !workspace.devToolsDragState) return;

  const contentBounds = getContentBounds(workspace.window);
  const point = getMouseContentPoint(workspace, mouse);
  const { orientation, startWidth, startHeight, startX, startY } = workspace.devToolsDragState;
  const limits = getDevToolsDragLimits(contentBounds, orientation);

  if (orientation === 'right') {
    handle.devToolsPreferredWidth = clamp(startWidth - (point.x - startX), limits.min, limits.max);
  } else {
    handle.devToolsPreferredHeight = clamp(startHeight - (point.y - startY), limits.min, limits.max);
  }

  layoutWorkspace(workspace);
}

function restoreDevToolsSplitterFocus(workspace, focusedWebContentsId) {
  if (!workspace || !isUsableWindow(workspace.window) || !workspace.window.isFocused()) return;

  const targetWebContents = focusedWebContentsId ? electronWebContents.fromId(focusedWebContentsId) : null;
  if (targetWebContents && !targetWebContents.isDestroyed()) {
    targetWebContents.focus();
    return;
  }

  const activeHandle = viewHandles.get(workspace.activeViewId);
  if (activeHandle && !activeHandle.isDestroyed()) {
    activeHandle.webContents.focus();
  }
}

function finishDevToolsSplitterDrag(workspace, options = {}) {
  if (!workspace) return;
  const focusedWebContentsId = workspace.devToolsDragState?.focusedWebContentsId || null;
  workspace.devToolsDragState = null;
  layoutWorkspace(workspace);

  if (options.restoreFocus !== false) {
    setImmediate(() => restoreDevToolsSplitterFocus(workspace, focusedWebContentsId));
  }
}

function openHostDevToolsDetached(hostWindow) {
  if (!isUsableWindow(hostWindow) || hostWindow.__codexomicsOpeningDetachedHostDevTools) return;

  hostWindow.__codexomicsOpeningDetachedHostDevTools = true;
  setImmediate(() => {
    try {
      if (!isUsableWindow(hostWindow)) return;
      if (hostWindow.webContents.isDevToolsOpened()) {
        hostWindow.webContents.closeDevTools();
      }
      hostWindow.__codexomicsHostDevToolsDetached = true;
      hostWindow.webContents.openDevTools({
        mode: 'detach',
        activate: true,
        title: 'CodeXomics Workspace DevTools',
      });
    } catch (error) {
      console.warn('[WorkspaceHost] Failed to detach host DevTools:', error.message);
    } finally {
      setTimeout(() => {
        if (isUsableWindow(hostWindow)) {
          hostWindow.__codexomicsOpeningDetachedHostDevTools = false;
        }
      }, 0);
    }
  });
}

function toggleDevToolsForHost(hostWindow) {
  const workspace = getWorkspaceForHost(getNativeWindow(hostWindow));
  if (!workspace || !isUsableWindow(workspace.window)) {
    return { handled: false, error: 'Workspace host is not available' };
  }

  const activeHandle = viewHandles.get(workspace.activeViewId);
  if (!activeHandle || activeHandle.isDestroyed()) {
    return { handled: false, error: 'Active genome view is not available' };
  }

  try {
    if (activeHandle.isDevToolsPanelOpen || activeHandle.webContents.isDevToolsOpened()) {
      closeDevToolsPanel(activeHandle);
    } else {
      if (!attachDevToolsView(activeHandle)) {
        return { handled: false, error: 'DevTools view is not available' };
      }
      activeHandle.isDevToolsPanelOpen = true;
      layoutWorkspace(workspace);
      activeHandle.webContents.openDevTools({
        mode: 'detach',
        activate: true,
        title: `CodeXomics DevTools - ${activeHandle.windowId}`,
      });
    }
    layoutWorkspace(workspace);
    return { handled: true, windowId: activeHandle.windowId };
  } catch (error) {
    activeHandle.isDevToolsPanelOpen = false;
    layoutWorkspace(workspace);
    console.warn(`[WorkspaceHost] Failed to toggle DevTools for ${activeHandle.windowId}:`, error.message);
    return { handled: false, error: error.message };
  }
}

function closeDevToolsPanel(handle) {
  if (!handle) return false;
  const workspace = getWorkspaceForHandle(handle);
  handle.isDevToolsPanelOpen = false;

  try {
    if (!handle.webContents.isDestroyed() && handle.webContents.isDevToolsOpened()) {
      handle.webContents.closeDevTools();
    }
  } catch (error) {
    console.warn(`[WorkspaceHost] Failed to close DevTools for ${handle.windowId}:`, error.message);
  }

  if (handle.devToolsView && !handle.devToolsView.webContents.isDestroyed()) {
    try {
      workspace?.window?.contentView?.removeChildView(handle.devToolsView);
    } catch (error) {
      console.warn(`[WorkspaceHost] Failed to remove DevTools view for ${handle.windowId}:`, error.message);
    }

    handle.devToolsView.webContents.close({ waitForBeforeUnload: false });
    handle.devToolsView = null;
  }

  if (workspace) {
    workspace.devToolsDragState = null;
    layoutWorkspace(workspace);
  }

  return true;
}

function isDevToolsToggleShortcut(input = {}) {
  const key = String(input.key || '').toLowerCase();
  if (key === 'f12') return true;
  if (key !== 'i') return false;

  if (process.platform === 'darwin') {
    return !!(input.meta && input.alt);
  }
  return !!(input.control && input.shift);
}

function attachDevToolsView(handle) {
  if (!handle || handle.webContents.isDestroyed()) return false;
  if (handle.devToolsView && !handle.devToolsView.webContents.isDestroyed()) return true;

  const devToolsView = new WebContentsView();
  devToolsView.setVisible(false);

  try {
    handle.webContents.setDevToolsWebContents(devToolsView.webContents);
  } catch (error) {
    console.warn(`[WorkspaceHost] Failed to attach DevTools view for ${handle.windowId}:`, error.message);
    handle.devToolsView = null;
    return false;
  }

  handle.devToolsView = devToolsView;
  devToolsView.webContents.on('before-input-event', (event, input) => {
    if (!isDevToolsToggleShortcut(input)) return;
    event.preventDefault();
    closeDevToolsPanel(handle);
  });
  devToolsView.webContents.once('destroyed', () => {
    if (handle.devToolsView === devToolsView) {
      handle.isDevToolsPanelOpen = false;
      handle.devToolsView = null;
      layoutWorkspace(handle.workspaceId);
    }
  });

  return true;
}

class GenomeViewHandle extends EventEmitter {
  constructor({ windowId, view, workspaceId }) {
    super();
    this.windowId = windowId;
    this.view = view;
    this.webContents = view.webContents;
    this.workspaceId = workspaceId;
    this.__isGenomeViewHandle = true;
    this.isDevToolsPanelOpen = false;
    this.devToolsView = null;
    attachDevToolsView(this);

    this.webContents.once('destroyed', () => {
      this.emit('closed');
    });
    this.webContents.on('devtools-opened', () => {
      this.isDevToolsPanelOpen = true;
      layoutWorkspace(this.workspaceId);
      if (this.devToolsView && !this.devToolsView.webContents.isDestroyed()) {
        this.devToolsView.webContents.focus();
      }
    });
    this.webContents.on('devtools-closed', () => {
      this.isDevToolsPanelOpen = false;
      layoutWorkspace(this.workspaceId);
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

  attachToHostOf(anchorHandle, options = {}) {
    return moveGenomeViewToWorkspace(this.windowId, anchorHandle?.workspaceId || null, options);
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
    currentDevToolsSplit: null,
    devToolsDragState: null,
    layoutRetryTimers: [],
    devToolsSplitterLineView: null,
    devToolsSplitterView: null,
  };
  workspace.devToolsSplitterLineView = createDevToolsSplitterLineView();
  workspace.devToolsSplitterView = createDevToolsSplitterView(workspace);
  workspaces.set(workspaceId, workspace);
  hostToWorkspace.set(hostWindow.id, workspaceId);
  hostWindow.__codexomicsWorkspaceId = workspaceId;
  hostWindow.__codexomicsActiveGenomeViewId = null;
  hostWindow.contentView.addChildView(workspace.devToolsSplitterLineView);
  workspace.devToolsSplitterLineView.setVisible(false);
  hostWindow.contentView.addChildView(workspace.devToolsSplitterView);
  workspace.devToolsSplitterView.setVisible(false);

  hostWindow.loadFile(path.join(__dirname, '..', 'renderer/workspace-host.html'));
  hostWindow.webContents.on('devtools-opened', () => {
    if (hostWindow.__codexomicsHostDevToolsDetached || hostWindow.__codexomicsOpeningDetachedHostDevTools) return;
    openHostDevToolsDetached(hostWindow);
  });
  hostWindow.webContents.on('devtools-closed', () => {
    if (!hostWindow.__codexomicsOpeningDetachedHostDevTools) {
      hostWindow.__codexomicsHostDevToolsDetached = false;
    }
  });
  hostWindow.on('resize', () => scheduleLayoutWorkspace(workspace));
  hostWindow.on('maximize', () => scheduleLayoutWorkspace(workspace));
  hostWindow.on('unmaximize', () => scheduleLayoutWorkspace(workspace));
  hostWindow.on('restore', () => scheduleLayoutWorkspace(workspace));
  hostWindow.on('enter-full-screen', () => scheduleLayoutWorkspace(workspace));
  hostWindow.on('leave-full-screen', () => scheduleLayoutWorkspace(workspace));
  hostWindow.on('blur', () => finishDevToolsSplitterDrag(workspace, { restoreFocus: false }));
  hostWindow.on('focus', () => {
    const activeHandle = viewHandles.get(workspace.activeViewId);
    if (activeHandle && !activeHandle.isDestroyed()) {
      activeHandle.webContents.focus();
    }
  });
  hostWindow.on('closed', () => {
    clearScheduledLayout(workspace);
    for (const windowId of [...workspace.viewIds]) {
      removeGenomeView(windowId, { destroyWebContents: true });
    }
    if (workspace.devToolsSplitterView && !workspace.devToolsSplitterView.webContents.isDestroyed()) {
      workspace.devToolsSplitterView.webContents.close({ waitForBeforeUnload: false });
    }
    if (workspace.devToolsSplitterLineView) {
      workspace.devToolsSplitterLineView.setVisible(false);
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
    if (handle.devToolsView && !handle.devToolsView.webContents.isDestroyed()) {
      currentWorkspace.window.contentView.removeChildView(handle.devToolsView);
    }
    currentWorkspace.viewIds = currentWorkspace.viewIds.filter(id => id !== handle.windowId);
    if (currentWorkspace.activeViewId === handle.windowId) {
      currentWorkspace.activeViewId = currentWorkspace.viewIds[0] || null;
      currentWorkspace.window.__codexomicsActiveGenomeViewId = currentWorkspace.activeViewId;
      if (currentWorkspace.activeViewId) {
        activateGenomeView(currentWorkspace.activeViewId, { focusHost: false });
      }
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
  if (handle.devToolsView && !handle.devToolsView.webContents.isDestroyed()) {
    workspace.window.contentView.addChildView(handle.devToolsView);
    handle.devToolsView.setVisible(false);
  }
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
      if (handle.devToolsView && !handle.devToolsView.webContents.isDestroyed()) {
        workspace.window.contentView.removeChildView(handle.devToolsView);
      }
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
  if (handle.devToolsView && !handle.devToolsView.webContents.isDestroyed()) {
    handle.devToolsView.webContents.close({ waitForBeforeUnload: false });
  }
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
  scheduleLayoutWorkspace,
  sendHostSnapshot,
  toggleDevToolsForHost,
};
