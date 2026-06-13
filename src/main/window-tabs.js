'use strict';

const { BrowserWindow, ipcMain } = require('electron');
const workspaceHostManager = require('./workspace-host-manager');

let windowRegistry;
let createWindow;
let createMenu;
let getCurrentActiveWindow;
let getCurrentMainWindow;
let setCurrentActiveWindow;

const tabGroups = new Map(); // groupId -> { groupId, windowIds: string[], activeWindowId: string }
const windowToGroup = new Map(); // windowId -> groupId
let groupCounter = 0;
let ipcHandlersRegistered = false;

function setWindowTabsDependencies(deps = {}) {
  if (deps.windowRegistry !== undefined) windowRegistry = deps.windowRegistry;
  if (deps.createWindow !== undefined) createWindow = deps.createWindow;
  if (deps.createMenu !== undefined) createMenu = deps.createMenu;
  if (deps.getCurrentActiveWindow !== undefined) getCurrentActiveWindow = deps.getCurrentActiveWindow;
  if (deps.getCurrentMainWindow !== undefined) getCurrentMainWindow = deps.getCurrentMainWindow;
  if (deps.setCurrentActiveWindow !== undefined) setCurrentActiveWindow = deps.setCurrentActiveWindow;
}

function generateGroupId() {
  groupCounter += 1;
  return `workspace_${groupCounter}_${Date.now()}`;
}

function getWindowEntry(windowId) {
  if (!windowRegistry || !windowId) return null;
  return windowRegistry.get(windowId) || null;
}

function getBrowserWindow(windowId) {
  const entry = getWindowEntry(windowId);
  return entry ? entry.window || entry : null;
}

function getWindowIdFromWebContents(webContents) {
  if (windowRegistry) {
    for (const [windowId, entry] of windowRegistry.entries()) {
      const win = entry.window || entry;
      if (win?.webContents === webContents) return windowId;
    }
  }

  const ownerWindow = BrowserWindow.fromWebContents(webContents);
  if (ownerWindow?.windowId) return ownerWindow.windowId;
  return ownerWindow ? workspaceHostManager.getActiveWindowIdForHost(ownerWindow) : null;
}

function normalizeWindowId(windowOrId) {
  if (!windowOrId) return null;
  if (typeof windowOrId === 'string') return windowOrId;
  return windowOrId.windowId || null;
}

function isValidGenomeWindow(windowId) {
  const win = getBrowserWindow(windowId);
  return !!(win && !win.isDestroyed());
}

function pruneGroup(group) {
  if (!group) return null;
  group.windowIds = group.windowIds.filter(isValidGenomeWindow);

  if (!group.windowIds.length) {
    tabGroups.delete(group.groupId);
    return null;
  }

  if (!group.activeWindowId || !group.windowIds.includes(group.activeWindowId)) {
    group.activeWindowId = group.windowIds[0];
  }

  for (const windowId of Array.from(windowToGroup.keys())) {
    if (windowToGroup.get(windowId) === group.groupId && !group.windowIds.includes(windowId)) {
      windowToGroup.delete(windowId);
    }
  }

  return group;
}

function getOrCreateGroupForWindow(windowId) {
  if (!isValidGenomeWindow(windowId)) return null;

  const existingGroupId = windowToGroup.get(windowId);
  if (existingGroupId) {
    const existingGroup = pruneGroup(tabGroups.get(existingGroupId));
    if (existingGroup) return existingGroup;
  }

  const groupId = generateGroupId();
  const group = {
    groupId,
    windowIds: [windowId],
    activeWindowId: windowId,
  };
  tabGroups.set(groupId, group);
  windowToGroup.set(windowId, groupId);
  return group;
}

function getTitleForWindow(windowId) {
  const entry = getWindowEntry(windowId);
  const win = getBrowserWindow(windowId);
  const genomeName = entry?.genomeName || null;
  if (genomeName) return genomeName;

  const title = win && !win.isDestroyed() ? win.getTitle() : '';
  if (title && title !== 'CodeXomics') return title.replace(/\s+\[win_[^\]]+\]/, '');

  return `Genome ${String(windowId || '').slice(-6) || 'Window'}`;
}

function getSnapshotForWindow(windowId) {
  if (!windowRegistry || !windowId || !windowRegistry.has(windowId)) {
    return {
      success: false,
      windowId: windowId || null,
      totalWindows: 0,
      group: null,
      tabs: [],
    };
  }

  const group = getOrCreateGroupForWindow(windowId);
  const visibleWindows = Array.from(windowRegistry.entries()).filter(([, entry]) => {
    const win = entry.window || entry;
    return win && !win.isDestroyed();
  });

  const tabs = group.windowIds.map((tabWindowId, index) => {
    const entry = getWindowEntry(tabWindowId);
    const win = getBrowserWindow(tabWindowId);
    return {
      windowId: tabWindowId,
      title: getTitleForWindow(tabWindowId),
      genomeName: entry?.genomeName || null,
      isActive: tabWindowId === group.activeWindowId,
      isFocused: !!(win && !win.isDestroyed() && win.isFocused()),
      isVisible: !!(win && !win.isDestroyed() && win.isVisible()),
      status: entry?.status || null,
      index,
    };
  });

  return {
    success: true,
    windowId,
    groupId: group.groupId,
    totalWindows: visibleWindows.length,
    groupedWindows: group.windowIds.length,
    canDetach: group.windowIds.length > 1,
    group: {
      groupId: group.groupId,
      activeWindowId: group.activeWindowId,
      size: group.windowIds.length,
    },
    tabs,
  };
}

function sendSnapshotToWindow(windowId) {
  const win = getBrowserWindow(windowId);
  if (!win || win.isDestroyed()) return;

  win.webContents.send('window-tabs-updated', getSnapshotForWindow(windowId));
  if (typeof win.sendHostSnapshot === 'function') {
    win.sendHostSnapshot(getSnapshotForWindow(windowId));
  }
}

function broadcastGroup(groupId) {
  const group = pruneGroup(tabGroups.get(groupId));
  if (!group) return;
  group.windowIds.forEach(sendSnapshotToWindow);
}

function broadcastAllWindowTabs() {
  if (!windowRegistry) return;
  for (const [windowId, entry] of windowRegistry.entries()) {
    const win = entry.window || entry;
    if (win && !win.isDestroyed()) {
      sendSnapshotToWindow(windowId);
    }
  }
}

function setActiveWindow(win) {
  if (typeof setCurrentActiveWindow === 'function') {
    setCurrentActiveWindow(win);
  }
  if (typeof createMenu === 'function') {
    createMenu();
  }
}

function getBoundsForActivation(group, fallbackWindowId) {
  const activeWindow = getBrowserWindow(group?.activeWindowId);
  if (activeWindow && !activeWindow.isDestroyed()) return activeWindow.getBounds();

  const fallbackWindow = getBrowserWindow(fallbackWindowId);
  if (fallbackWindow && !fallbackWindow.isDestroyed()) return fallbackWindow.getBounds();

  const currentWindow =
    (typeof getCurrentMainWindow === 'function' && getCurrentMainWindow()) ||
    (typeof getCurrentActiveWindow === 'function' && getCurrentActiveWindow());
  return currentWindow && !currentWindow.isDestroyed() ? currentWindow.getBounds() : null;
}

function showWindowWithoutStealingFocus(win) {
  if (!win || win.isDestroyed() || win.isVisible()) return;

  if (typeof win.showInactive === 'function') {
    win.showInactive();
  } else {
    win.show();
  }
}

function moveWindowToFront(win) {
  if (!win || win.isDestroyed()) return;

  if (typeof win.moveTop === 'function') {
    win.moveTop();
  }
  win.focus();
}

function activateWindowInGroup(windowId, options = {}) {
  const groupId = windowToGroup.get(windowId);
  const group = pruneGroup(tabGroups.get(groupId));
  const targetWindow = getBrowserWindow(windowId);

  if (!group || !targetWindow || targetWindow.isDestroyed()) {
    return { success: false, error: `Window '${windowId}' is not available` };
  }

  const previousActiveWindowId = group.activeWindowId;
  const bounds = options.bounds || getBoundsForActivation(group, windowId);
  group.activeWindowId = windowId;

  for (const tabWindowId of group.windowIds) {
    const win = getBrowserWindow(tabWindowId);
    if (!win || win.isDestroyed()) continue;

    if (bounds) {
      try {
        win.setBounds(bounds, false);
      } catch (error) {
        console.warn(`[WindowTabs] Failed to set bounds for ${tabWindowId}:`, error.message);
      }
    }

    if (tabWindowId === windowId) {
      win.show();
    } else {
      showWindowWithoutStealingFocus(win);
    }
  }

  moveWindowToFront(targetWindow);
  setActiveWindow(targetWindow);
  broadcastGroup(group.groupId);

  return {
    success: true,
    windowId,
    previousActiveWindowId,
    groupId: group.groupId,
    tabs: getSnapshotForWindow(windowId).tabs,
  };
}

function attachWindowToGroup(windowId, groupId, options = {}) {
  if (!isValidGenomeWindow(windowId)) {
    return { success: false, error: `Window '${windowId}' is not available` };
  }

  let group = tabGroups.get(groupId);
  if (!group) {
    group = getOrCreateGroupForWindow(windowId);
  }

  const existingGroupId = windowToGroup.get(windowId);
  if (existingGroupId && existingGroupId !== group.groupId) {
    const existingGroup = tabGroups.get(existingGroupId);
    if (existingGroup) {
      existingGroup.windowIds = existingGroup.windowIds.filter(id => id !== windowId);
      pruneGroup(existingGroup);
    }
  }

  if (!group.windowIds.includes(windowId)) {
    group.windowIds.push(windowId);
  }
  windowToGroup.set(windowId, group.groupId);

  const win = getBrowserWindow(windowId);
  const anchorWindow = getBrowserWindow(group.activeWindowId) || getBrowserWindow(group.windowIds[0]);
  if (win && anchorWindow && win !== anchorWindow && typeof win.attachToHostOf === 'function') {
    const attachResult = win.attachToHostOf(anchorWindow);
    if (attachResult && attachResult.success === false) {
      return attachResult;
    }
  }

  if (options.activate !== false) {
    return activateWindowInGroup(windowId, options);
  }

  const activeWindow = getBrowserWindow(group.activeWindowId);
  const activeBounds = activeWindow && !activeWindow.isDestroyed() ? activeWindow.getBounds() : null;
  if (win && !win.isDestroyed()) {
    if (activeBounds) {
      try {
        win.setBounds(activeBounds, false);
      } catch (error) {
        console.warn(`[WindowTabs] Failed to set inactive bounds for ${windowId}:`, error.message);
      }
    }
    showWindowWithoutStealingFocus(win);
  }
  broadcastGroup(group.groupId);
  return { success: true, windowId, groupId: group.groupId };
}

function registerWindowTab(browserWindow, options = {}) {
  const windowId = normalizeWindowId(browserWindow);
  if (!windowId || !browserWindow || browserWindow.isDestroyed()) {
    return { success: false, error: 'Invalid genome window for tab registration' };
  }

  if (!browserWindow.__codexomicsWindowTabsHooked) {
    browserWindow.__codexomicsWindowTabsHooked = true;
    browserWindow.on('closed', () => {
      unregisterWindowTab(windowId);
    });
  }

  let groupId = options.groupId || null;
  const sourceWindowId = normalizeWindowId(options.sourceWindow);

  if (!groupId && sourceWindowId && sourceWindowId !== windowId) {
    groupId = getOrCreateGroupForWindow(sourceWindowId)?.groupId || null;
  }

  if (!groupId) {
    groupId = getOrCreateGroupForWindow(windowId)?.groupId || null;
  }

  return attachWindowToGroup(windowId, groupId, {
    activate: options.activate !== false,
    bounds: options.bounds,
  });
}

function unregisterWindowTab(windowId) {
  const groupId = windowToGroup.get(windowId);
  if (!groupId) return;

  const group = tabGroups.get(groupId);
  windowToGroup.delete(windowId);

  if (!group) return;
  group.windowIds = group.windowIds.filter(id => id !== windowId);

  if (group.activeWindowId === windowId) {
    group.activeWindowId = group.windowIds[0] || null;
  }

  const remainingGroup = pruneGroup(group);
  if (remainingGroup) {
    broadcastGroup(remainingGroup.groupId);
  } else {
    broadcastAllWindowTabs();
  }
}

function switchToWindowTab(targetWindowId, senderWindowId = null) {
  if (!targetWindowId) {
    return { success: false, error: 'targetWindowId is required' };
  }

  if (senderWindowId) {
    const senderGroup = getOrCreateGroupForWindow(senderWindowId);
    const targetGroupId = windowToGroup.get(targetWindowId);
    if (senderGroup && targetGroupId !== senderGroup.groupId) {
      return {
        success: false,
        error: `Window '${targetWindowId}' is not in the current window tab group`,
      };
    }
  }

  return activateWindowInGroup(targetWindowId);
}

function offsetBounds(bounds, offset = 34) {
  if (!bounds) return null;
  return {
    x: bounds.x + offset,
    y: bounds.y + offset,
    width: bounds.width,
    height: bounds.height,
  };
}

function detachWindowTab(targetWindowId, senderWindowId = null) {
  if (!targetWindowId) {
    return { success: false, error: 'targetWindowId is required' };
  }

  const groupId = windowToGroup.get(targetWindowId);
  const group = pruneGroup(tabGroups.get(groupId));
  if (!group || group.windowIds.length <= 1) {
    return { success: true, windowId: targetWindowId, detached: false, message: 'Window is already detached' };
  }

  const targetWindow = getBrowserWindow(targetWindowId);
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { success: false, error: `Window '${targetWindowId}' is not available` };
  }

  const senderWindow = senderWindowId ? getBrowserWindow(senderWindowId) : null;
  const baseBounds =
    (senderWindow && !senderWindow.isDestroyed() && senderWindow.getBounds()) ||
    targetWindow.getBounds() ||
    getBoundsForActivation(group, targetWindowId);

  const wasActive = group.activeWindowId === targetWindowId;
  group.windowIds = group.windowIds.filter(id => id !== targetWindowId);
  windowToGroup.delete(targetWindowId);

  if (wasActive) {
    group.activeWindowId = group.windowIds[0] || null;
  }
  pruneGroup(group);

  const detachedGroup = getOrCreateGroupForWindow(targetWindowId);
  detachedGroup.windowIds = [targetWindowId];
  detachedGroup.activeWindowId = targetWindowId;
  windowToGroup.set(targetWindowId, detachedGroup.groupId);

  if (wasActive && group.windowIds.length > 0) {
    const replacementWindow = getBrowserWindow(group.activeWindowId);
    if (replacementWindow && !replacementWindow.isDestroyed()) {
      if (baseBounds) replacementWindow.setBounds(baseBounds);
      replacementWindow.show();
    }
  }

  const detachedBounds = offsetBounds(baseBounds);
  if (typeof targetWindow.detachToNewHost === 'function') {
    const detachResult = targetWindow.detachToNewHost(detachedBounds);
    if (detachResult && detachResult.success === false) {
      return detachResult;
    }
  } else if (detachedBounds) {
    targetWindow.setBounds(detachedBounds);
  }
  targetWindow.show();
  targetWindow.focus();
  setActiveWindow(targetWindow);

  broadcastGroup(group.groupId);
  broadcastGroup(detachedGroup.groupId);

  return {
    success: true,
    detached: true,
    windowId: targetWindowId,
    groupId: detachedGroup.groupId,
  };
}

function attachAllWindowsToGroup(anchorWindowId) {
  if (!anchorWindowId || !isValidGenomeWindow(anchorWindowId)) {
    return { success: false, error: 'No active genome window is available for grouping' };
  }

  const anchorGroup = getOrCreateGroupForWindow(anchorWindowId);
  const anchorWindow = getBrowserWindow(anchorWindowId);
  const bounds = anchorWindow && !anchorWindow.isDestroyed() ? anchorWindow.getBounds() : null;

  for (const [windowId, entry] of windowRegistry.entries()) {
    const win = entry.window || entry;
    if (!win || win.isDestroyed() || !win.windowId) continue;
    attachWindowToGroup(windowId, anchorGroup.groupId, { activate: false });
  }

  return activateWindowInGroup(anchorWindowId, { bounds });
}

function createWindowLevelTab(senderWindowId) {
  if (typeof createWindow !== 'function') {
    return { success: false, error: 'Window creation is not available' };
  }

  const sourceWindow = getBrowserWindow(senderWindowId);
  const group = getOrCreateGroupForWindow(senderWindowId);
  const newWindow = createWindow({
    workspaceTabGroupId: group?.groupId || null,
    workspaceSourceWindow: sourceWindow || null,
  });

  return {
    success: true,
    windowId: newWindow?.windowId || null,
    groupId: group?.groupId || null,
  };
}

function notifyWindowGenomeNameChanged(windowId) {
  const groupId = windowToGroup.get(windowId);
  if (groupId) {
    broadcastGroup(groupId);
  } else {
    sendSnapshotToWindow(windowId);
  }
}

function registerWindowTabIpcHandlers() {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;

  ipcMain.handle('window-tabs:list', async event => {
    return getSnapshotForWindow(getWindowIdFromWebContents(event.sender));
  });

  ipcMain.handle('window-tabs:switch', async (event, targetWindowId) => {
    return switchToWindowTab(targetWindowId, getWindowIdFromWebContents(event.sender));
  });

  ipcMain.handle('window-tabs:detach', async (event, targetWindowId) => {
    const senderWindowId = getWindowIdFromWebContents(event.sender);
    return detachWindowTab(targetWindowId || senderWindowId, senderWindowId);
  });

  ipcMain.handle('window-tabs:attach-all', async event => {
    return attachAllWindowsToGroup(getWindowIdFromWebContents(event.sender));
  });

  ipcMain.handle('window-tabs:new-tab', async event => {
    return createWindowLevelTab(getWindowIdFromWebContents(event.sender));
  });
}

module.exports = {
  tabGroups,
  windowToGroup,
  setWindowTabsDependencies,
  registerWindowTabIpcHandlers,
  registerWindowTab,
  unregisterWindowTab,
  switchToWindowTab,
  detachWindowTab,
  attachAllWindowsToGroup,
  createWindowLevelTab,
  getSnapshotForWindow,
  broadcastAllWindowTabs,
  notifyWindowGenomeNameChanged,
};
