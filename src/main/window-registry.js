'use strict';
// @ts-check

const { BrowserWindow } = require('electron');

// External references (set by main module)
let mainWindow;
let unifiedMCPServer;

// Multi-window genome support: Enhanced Window Registry
// Tracks all main genome browser windows by windowId with comprehensive state management
const windowRegistry = new Map(); // windowId → { window: BrowserWindow, genomeName: string, createdAt: Date, status: string, lastUpdate: Date, retryCount: number }
let windowIdCounter = 0;

// Pending registration queue for windows that couldn't be registered immediately
const pendingRegistrations = new Map(); // windowId → { window: BrowserWindow, resolve: function, reject: function, retryCount: number }
const MAX_REGISTRATION_RETRIES = 3;
const REGISTRATION_RETRY_DELAY_MS = 500;

// Cleanup interval reference
let windowCleanupInterval = null;

function generateWindowId() {
  return `win_${++windowIdCounter}_${Date.now()}`;
}

// Enhanced window registration with status tracking and retry logic
function registerGenomeWindow(windowId, browserWindow, options = {}) {
  const { skipMCPRegistration = false, skipResolve = false } = options;

  return new Promise((resolve, reject) => {
    // Check if window is already registered
    if (windowRegistry.has(windowId)) {
      console.warn(`📋 [WindowRegistry] Window ${windowId} already registered, updating reference`);
      const existing = windowRegistry.get(windowId);
      existing.window = browserWindow;
      existing.lastUpdate = new Date();
      existing.status = 'updated';
      if (!skipResolve) resolve({ windowId, status: 'updated', isNew: false });
      return;
    }

    // Validate window object
    if (!browserWindow || typeof browserWindow.isDestroyed !== 'function') {
      console.error(`📋 [WindowRegistry] Invalid window object for ${windowId}`);
      if (!skipResolve) reject(new Error('Invalid window object'));
      return;
    }

    // Store registration promise for deferred resolution
    if (!skipResolve) {
      pendingRegistrations.set(windowId, { window: browserWindow, resolve, reject, retryCount: 0 });
    }

    // Check if window is destroyed before registration
    if (browserWindow.isDestroyed()) {
      console.error(`📋 [WindowRegistry] Cannot register destroyed window: ${windowId}`);
      pendingRegistrations.delete(windowId);
      if (!skipResolve) reject(new Error('Window is destroyed'));
      return;
    }

    // Register window with comprehensive metadata
    const registrationInfo = {
      window: browserWindow,
      genomeName: null,
      createdAt: new Date(),
      lastUpdate: new Date(),
      status: 'registering',
      retryCount: 0,
      isMainWindow: browserWindow === mainWindow,
    };

    windowRegistry.set(windowId, registrationInfo);

    // Set up automatic cleanup when window is destroyed
    browserWindow.on('closed', () => {
      console.log(`📋 [WindowRegistry] Window closed event detected for ${windowId}`);
      cleanupWindowRegistration(windowId);
    });

    // Register with MCP server if running and not skipped
    if (!skipMCPRegistration && unifiedMCPServer) {
      try {
        unifiedMCPServer.registerWindow(windowId, browserWindow);
        console.log(`📋 [WindowRegistry] MCP registration successful for ${windowId}`);
      } catch (mcpError) {
        console.warn(`📋 [WindowRegistry] MCP registration failed for ${windowId}: ${mcpError.message}`);
      }
    }

    // Update status to registered
    registrationInfo.status = 'registered';
    pendingRegistrations.delete(windowId);

    console.log(
      `📋 [WindowRegistry] Registered window: ${windowId} (total: ${windowRegistry.size}, status: ${registrationInfo.status})`
    );

    if (!skipResolve) resolve({ windowId, status: 'registered', isNew: true });
  });
}

// Unregister a genome browser window from the registry with cleanup
function unregisterGenomeWindow(windowId) {
  const entry = windowRegistry.get(windowId);

  if (!entry) {
    console.warn(`📋 [WindowRegistry] Window ${windowId} not found in registry`);
    pendingRegistrations.delete(windowId);
    return;
  }

  // Unregister from MCP server if running
  if (unifiedMCPServer && entry.window && !entry.window.isDestroyed()) {
    try {
      unifiedMCPServer.unregisterWindow(windowId);
    } catch (error) {
      console.warn(`📋 [WindowRegistry] MCP unregistration error for ${windowId}: ${error.message}`);
    }
  }

  // Remove from registry
  windowRegistry.delete(windowId);
  pendingRegistrations.delete(windowId);

  console.log(`📋 [WindowRegistry] Unregistered window: ${windowId} (remaining: ${windowRegistry.size})`);
}

// Cleanup window registration (called when window is closed)
function cleanupWindowRegistration(windowId) {
  const entry = windowRegistry.get(windowId);

  if (entry) {
    // Update status to destroyed
    entry.status = 'destroyed';
    entry.lastUpdate = new Date();

    console.log(`📋 [WindowRegistry] Cleaning up destroyed window: ${windowId}`);

    // Unregister from MCP server
    if (unifiedMCPServer) {
      try {
        unifiedMCPServer.unregisterWindow(windowId);
      } catch (error) {
        console.warn(`📋 [WindowRegistry] MCP cleanup error for ${windowId}: ${error.message}`);
      }
    }

    // Remove from registry
    windowRegistry.delete(windowId);
    pendingRegistrations.delete(windowId);

    console.log(`📋 [WindowRegistry] Cleanup complete for ${windowId} (remaining: ${windowRegistry.size})`);
  }
}

// Deferred registration with retry logic for windows that aren't ready yet
function registerGenomeWindowDeferred(windowId, browserWindow, maxRetries = MAX_REGISTRATION_RETRIES) {
  return new Promise((resolve, reject) => {
    let retryCount = 0;

    const attemptRegistration = () => {
      // Check if window is destroyed
      if (browserWindow.isDestroyed()) {
        console.warn(`📋 [WindowRegistry] Deferred registration aborted: window ${windowId} destroyed`);
        reject(new Error('Window destroyed before registration'));
        return;
      }

      // Check if window webContents is ready
      if (!browserWindow.webContents || browserWindow.webContents.isLoading()) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(
            `📋 [WindowRegistry] Deferred registration attempt ${retryCount}/${maxRetries} for ${windowId} (window still loading)`
          );
          setTimeout(attemptRegistration, REGISTRATION_RETRY_DELAY_MS);
          return;
        } else {
          console.warn(
            `📋 [WindowRegistry] Deferred registration max retries reached for ${windowId}, registering anyway`
          );
        }
      }

      // Attempt registration
      try {
        registerGenomeWindow(windowId, browserWindow)
          .then(result => {
            console.log(`📋 [WindowRegistry] Deferred registration successful for ${windowId}`);
            resolve(result);
          })
          .catch(error => {
            console.error(`📋 [WindowRegistry] Deferred registration failed for ${windowId}: ${error.message}`);
            reject(error);
          });
      } catch (error) {
        console.error(`📋 [WindowRegistry] Deferred registration exception for ${windowId}: ${error.message}`);
        reject(error);
      }
    };

    attemptRegistration();
  });
}

// Start periodic cleanup of destroyed windows
function startWindowCleanupInterval(intervalMs = 10000) {
  if (windowCleanupInterval) {
    clearInterval(windowCleanupInterval);
  }

  windowCleanupInterval = setInterval(() => {
    let cleanedCount = 0;

    for (const [windowId, info] of windowRegistry.entries()) {
      if (info.window && info.window.isDestroyed()) {
        console.log(`📋 [WindowRegistry] Periodic cleanup found destroyed window: ${windowId}`);
        cleanupWindowRegistration(windowId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`📋 [WindowRegistry] Periodic cleanup removed ${cleanedCount} destroyed windows`);
    }
  }, intervalMs);

  console.log(`📋 [WindowRegistry] Started periodic cleanup interval (${intervalMs}ms)`);
}

// Stop periodic cleanup
function stopWindowCleanupInterval() {
  if (windowCleanupInterval) {
    clearInterval(windowCleanupInterval);
    windowCleanupInterval = null;
    console.log(`📋 [WindowRegistry] Stopped periodic cleanup interval`);
  }
}

// Get comprehensive window registry status for diagnostics
function getWindowRegistryStatus() {
  const windows = [];
  let validCount = 0;
  let destroyedCount = 0;
  let pendingCount = pendingRegistrations.size;

  for (const [windowId, info] of windowRegistry.entries()) {
    const isDestroyed = info.window ? info.window.isDestroyed() : true;
    if (isDestroyed) destroyedCount++;
    else validCount++;

    windows.push({
      windowId,
      genomeName: info.genomeName,
      status: info.status,
      isDestroyed,
      createdAt: info.createdAt ? info.createdAt.toISOString() : null,
      lastUpdate: info.lastUpdate ? info.lastUpdate.toISOString() : null,
      age: info.createdAt ? Date.now() - info.createdAt.getTime() : null,
    });
  }

  return {
    total: windowRegistry.size,
    valid: validCount,
    destroyed: destroyedCount,
    pending: pendingCount,
    windows,
    timestamp: new Date().toISOString(),
  };
}

// Ensure all windows are properly registered with MCP server
function syncWindowsWithMCPServer() {
  if (!unifiedMCPServer) {
    console.log(`📋 [WindowRegistry] MCP server not available, skipping sync`);
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const [windowId, info] of windowRegistry.entries()) {
    if (!info.window || info.window.isDestroyed()) {
      console.warn(`📋 [WindowRegistry] Skipping sync for destroyed window: ${windowId}`);
      continue;
    }

    try {
      unifiedMCPServer.registerWindow(windowId, info.window);
      synced++;
    } catch (error) {
      console.error(`📋 [WindowRegistry] Failed to sync window ${windowId} with MCP: ${error.message}`);
      failed++;
    }
  }

  console.log(`📋 [WindowRegistry] MCP sync complete: ${synced} synced, ${failed} failed`);
  return { synced, failed };
}

// Set external dependencies
function setDependencies({ mainWindow: mw, unifiedMCPServer: ums }) {
  if (mw !== undefined) mainWindow = mw;
  if (ums !== undefined) unifiedMCPServer = ums;
}

module.exports = {
  windowRegistry,
  windowIdCounter,
  pendingRegistrations,
  MAX_REGISTRATION_RETRIES,
  REGISTRATION_RETRY_DELAY_MS,
  generateWindowId,
  registerGenomeWindow,
  unregisterGenomeWindow,
  cleanupWindowRegistration,
  registerGenomeWindowDeferred,
  startWindowCleanupInterval,
  stopWindowCleanupInterval,
  getWindowRegistryStatus,
  syncWindowsWithMCPServer,
  setDependencies,
};
