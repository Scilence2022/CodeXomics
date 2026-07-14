'use strict';
// @ts-check

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { createSecureWebPreferences } = require('./security-utils');
const net = require('net');
const UnifiedMCPServer = require('../mcp-server');
const { getMcpAuthConfig } = require('./mcp-auth-config');

// External references (set by main module via setMCPDependencies)
let mainWindow;
let unifiedMCPServer;
let unifiedServerStatus;
let getUnifiedMCPServer = () => unifiedMCPServer;
let setUnifiedMCPServer = value => {
  unifiedMCPServer = value;
};
let getUnifiedServerStatus = () => unifiedServerStatus;
let setUnifiedServerStatus = value => {
  unifiedServerStatus = value;
};
let windowRegistry;
let updateMCPServerMenu;

// Window registry external functions
let startWindowCleanupInterval;
let stopWindowCleanupInterval;
let switchToWindowTab;

// External MCP Servers Functions
let mcpServerManagerWindow = null;
let createMCPServerManagerMenu;
let createMenu;
let getCurrentMainWindow;
let getCurrentActiveWindow;
let setCurrentActiveWindow;

function getMainGenomeTarget() {
  return (typeof getCurrentMainWindow === 'function' && getCurrentMainWindow()) || mainWindow || null;
}

async function startUnifiedMCPServer() {
  // Declared outside the try so the catch block can reference the loaded ports
  // when reporting EADDRINUSE conflicts.
  let settings = null;
  try {
    if (getUnifiedServerStatus() === 'running') {
      console.log('Unified Claude MCP Server is already running');
      return { success: true, status: 'running' };
    }

    if (getUnifiedServerStatus() === 'starting') {
      console.log('Unified Claude MCP Server is already starting');
      return { success: false, status: 'starting' };
    }

    setUnifiedServerStatus('starting');

    // Load settings and check for port conflicts
    settings = loadMCPServerSettings();

    // Pre-flight port check
    const httpCheck = await checkPortAvailable(settings.httpPort);
    const wsCheck = await checkPortAvailable(settings.wsPort);

    if (!httpCheck.available) {
      setUnifiedServerStatus('stopped');
      return {
        success: false,
        message: `HTTP port ${settings.httpPort} is already in use. Please change the port in Settings or free the port.`,
        status: 'stopped',
        conflictPort: settings.httpPort,
        conflictType: 'http',
      };
    }
    if (!wsCheck.available) {
      setUnifiedServerStatus('stopped');
      return {
        success: false,
        message: `WebSocket port ${settings.wsPort} is already in use. Please change the port in Settings or free the port.`,
        status: 'stopped',
        conflictPort: settings.wsPort,
        conflictType: 'ws',
      };
    }

    // Local bypass is opt-in. External agents must use a configured bearer key
    // so their principal can later be scoped to read/propose/commit actions.
    const server = new UnifiedMCPServer(settings.httpPort, settings.wsPort, getMainGenomeTarget(), getMcpAuthConfig());
    setUnifiedMCPServer(server);

    // Forward server log events to the Manager window
    server.on('log', logEntry => {
      if (mcpServerManagerWindow && !mcpServerManagerWindow.isDestroyed()) {
        mcpServerManagerWindow.webContents.send('mcp-server-log', logEntry);
      }
    });

    // Forward client connection events to the Manager window
    server.on('client-connected', data => {
      if (mcpServerManagerWindow && !mcpServerManagerWindow.isDestroyed()) {
        mcpServerManagerWindow.webContents.send('mcp-server-client-update', data);
      }
    });
    server.on('client-disconnected', data => {
      if (mcpServerManagerWindow && !mcpServerManagerWindow.isDestroyed()) {
        mcpServerManagerWindow.webContents.send('mcp-server-client-update', data);
      }
    });

    // Multi-window support: Link the authoritative windowRegistry so listWindows() always reads live data
    server.setMainWindowRegistry(windowRegistry);
    if (typeof switchToWindowTab === 'function') {
      server.switchWindowTab = switchToWindowTab;
    }

    // Start the server
    await server.start();

    setUnifiedServerStatus('running');
    console.log(
      `Unified Claude MCP Server started successfully on ports ${settings.httpPort} (HTTP) and ${settings.wsPort} (WebSocket)`
    );

    // Start periodic window cleanup to handle any windows that weren't properly unregistered
    startWindowCleanupInterval();

    // Populate the local routing cache as well as retaining the live,
    // authoritative registry reference above.
    let syncedWindows = 0;
    for (const [windowId, info] of windowRegistry.entries()) {
      const window = info?.window || info;
      if (window && !window.isDestroyed()) {
        server.registerWindow(windowId, window);
        syncedWindows += 1;
      }
    }
    console.log(`📋 [MCP Server] Window sync result: ${syncedWindows} synced, 0 failed`);

    // Notify renderer process
    const targetWindow = getMainGenomeTarget();
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('mcp-server-status-changed', {
        status: 'running',
        httpPort: settings.httpPort,
        wsPort: settings.wsPort,
      });
    }

    return { success: true, status: 'running' };
  } catch (error) {
    setUnifiedServerStatus('stopped');
    // Clean up the server instance
    const server = getUnifiedMCPServer();
    if (server) {
      try {
        await server.stop();
      } catch (e) {
        /* ignore stop errors */
      }
    }
    setUnifiedMCPServer(null);
    console.error('Failed to start Unified Claude MCP Server:', error);

    // Parse EADDRINUSE errors to provide conflict info
    const msg = error.message || '';
    let conflictPort = null;
    let conflictType = null;
    if (msg.includes('HTTP port') && msg.includes('already in use')) {
      conflictPort = settings ? settings.httpPort : null;
      conflictType = 'http';
    } else if (msg.includes('WebSocket port') && msg.includes('already in use')) {
      conflictPort = settings ? settings.wsPort : null;
      conflictType = 'ws';
    }

    return {
      success: false,
      status: 'stopped',
      message: msg,
      ...(conflictPort ? { conflictPort, conflictType } : {}),
    };
  }
}

async function stopUnifiedMCPServer() {
  try {
    if (getUnifiedServerStatus() === 'stopped') {
      console.log('Unified Claude MCP Server is already stopped');
      return { success: true, status: 'stopped' };
    }

    if (getUnifiedServerStatus() === 'stopping') {
      console.log('Unified Claude MCP Server is already stopping');
      return { success: false, status: 'stopping' };
    }

    setUnifiedServerStatus('stopping');

    // Stop the periodic cleanup interval
    stopWindowCleanupInterval();

    const server = getUnifiedMCPServer();
    if (server) {
      await server.stop();
      setUnifiedMCPServer(null);
    }

    setUnifiedServerStatus('stopped');
    console.log('Unified Claude MCP Server stopped successfully');

    // Notify renderer process
    const targetWindow = getMainGenomeTarget();
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('mcp-server-status-changed', {
        status: 'stopped',
      });
    }

    return { success: true, status: 'stopped' };
  } catch (error) {
    setUnifiedServerStatus('stopped');
    setUnifiedMCPServer(null);
    console.error('Failed to stop Unified Claude MCP Server:', error);
    return { success: false, status: 'stopped', error: error.message };
  }
}

// ===== MCP Server Settings =====
const MCP_SETTINGS_DEFAULTS = { httpPort: 3002, wsPort: 3003 };

function loadMCPServerSettings() {
  const settingsPath = path.join(app.getPath('userData'), 'mcp-server-settings.json');
  try {
    if (fs.existsSync(settingsPath)) {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return { ...MCP_SETTINGS_DEFAULTS, ...data };
    }
  } catch (e) {
    console.error('Failed to load MCP server settings:', e);
  }
  return { ...MCP_SETTINGS_DEFAULTS };
}

function saveMCPServerSettings(settings) {
  const settingsPath = path.join(app.getPath('userData'), 'mcp-server-settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
}

// ===== Port Conflict Detection =====
function checkPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', err => {
      if (err.code === 'EADDRINUSE') {
        resolve({ available: false, port });
      } else {
        resolve({ available: false, port, error: err.message });
      }
    });
    server.once('listening', () => {
      server.close();
      resolve({ available: true, port });
    });
    server.listen(port, '127.0.0.1');
  });
}

function createMCPServerManagerWindow() {
  if (mcpServerManagerWindow && !mcpServerManagerWindow.isDestroyed()) {
    mcpServerManagerWindow.focus();
    return;
  }

  mcpServerManagerWindow = new BrowserWindow({
    width: 900,
    height: 750,
    title: 'CodeXomics MCP Server Manager',
    webPreferences: createSecureWebPreferences(),
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  // Load the MCP Server Manager HTML
  mcpServerManagerWindow.loadFile(path.join(__dirname, '..', 'mcp-server-manager.html'));

  // Set up the application menu when window is ready
  if (createMCPServerManagerMenu) {
    mcpServerManagerWindow.once('ready-to-show', () => {
      mcpServerManagerWindow.show();
      createMCPServerManagerMenu(mcpServerManagerWindow);
    });

    mcpServerManagerWindow.on('focus', () => {
      if (getCurrentActiveWindow() !== mcpServerManagerWindow) {
        setCurrentActiveWindow(mcpServerManagerWindow);
        createMCPServerManagerMenu(mcpServerManagerWindow);
        console.log('Switched to MCP Server Manager menu');
      }
    });
  }

  // Handle window closed - restore main menu
  mcpServerManagerWindow.on('closed', () => {
    if (getCurrentActiveWindow() === mcpServerManagerWindow) {
      setCurrentActiveWindow(null);
    }
    mcpServerManagerWindow = null;
    if (createMenu && getMainGenomeTarget() && !getMainGenomeTarget().isDestroyed()) {
      createMenu();
      console.log('Switched back to main window menu from MCP Server Manager');
    }
  });

  // Send initial status and request theme
  mcpServerManagerWindow.webContents.on('did-finish-load', () => {
    const settings = loadMCPServerSettings();
    mcpServerManagerWindow.webContents.send('mcp-server-status-update', {
      status: getUnifiedServerStatus(),
      isRunning: getUnifiedServerStatus() === 'running',
      httpPort: getUnifiedServerStatus() === 'running' ? settings.httpPort : null,
      wsPort: getUnifiedServerStatus() === 'running' ? settings.wsPort : null,
      connectedClients: getUnifiedMCPServer() ? getUnifiedMCPServer().getConnectedClientsCount() : 0,
    });

    // Request current theme from main renderer
    const targetWindow = getMainGenomeTarget();
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('request-theme-for-pm');
    }
  });
}

// Set external dependencies
function setMCPDependencies(deps) {
  if (deps.mainWindow !== undefined) mainWindow = deps.mainWindow;
  if (deps.unifiedMCPServer !== undefined) unifiedMCPServer = deps.unifiedMCPServer;
  if (deps.unifiedServerStatus !== undefined) unifiedServerStatus = deps.unifiedServerStatus;
  if (typeof deps.getUnifiedMCPServer === 'function') getUnifiedMCPServer = deps.getUnifiedMCPServer;
  if (typeof deps.setUnifiedMCPServer === 'function') setUnifiedMCPServer = deps.setUnifiedMCPServer;
  if (typeof deps.getUnifiedServerStatus === 'function') getUnifiedServerStatus = deps.getUnifiedServerStatus;
  if (typeof deps.setUnifiedServerStatus === 'function') setUnifiedServerStatus = deps.setUnifiedServerStatus;
  if (deps.windowRegistry !== undefined) windowRegistry = deps.windowRegistry;
  if (deps.updateMCPServerMenu !== undefined) updateMCPServerMenu = deps.updateMCPServerMenu;
  if (deps.startWindowCleanupInterval !== undefined) startWindowCleanupInterval = deps.startWindowCleanupInterval;
  if (deps.stopWindowCleanupInterval !== undefined) stopWindowCleanupInterval = deps.stopWindowCleanupInterval;
  if (deps.switchToWindowTab !== undefined) switchToWindowTab = deps.switchToWindowTab;
  if (deps.createMCPServerManagerMenu !== undefined) createMCPServerManagerMenu = deps.createMCPServerManagerMenu;
  if (deps.createMenu !== undefined) createMenu = deps.createMenu;
  if (deps.getCurrentMainWindow !== undefined) getCurrentMainWindow = deps.getCurrentMainWindow;
  if (deps.getCurrentActiveWindow !== undefined) getCurrentActiveWindow = deps.getCurrentActiveWindow;
  if (deps.setCurrentActiveWindow !== undefined) setCurrentActiveWindow = deps.setCurrentActiveWindow;
}

module.exports = {
  startUnifiedMCPServer,
  stopUnifiedMCPServer,
  updateMCPServerMenu,
  createMCPServerManagerWindow,
  loadMCPServerSettings,
  saveMCPServerSettings,
  checkPortAvailable,
  MCP_SETTINGS_DEFAULTS,
  setMCPDependencies,
};
