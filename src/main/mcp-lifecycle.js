'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const UnifiedMCPServer = require('../mcp-server');

// External references (set by main module via setMCPDependencies)
let mainWindow;
let unifiedMCPServer;
let unifiedServerStatus;
let windowRegistry;
let updateMCPServerMenu;

// Window registry external functions
let startWindowCleanupInterval;
let stopWindowCleanupInterval;
let syncWindowsWithMCPServer;

// External MCP Servers Functions
let mcpServerManagerWindow = null;

async function startUnifiedMCPServer() {
  try {
    if (unifiedServerStatus === 'running') {
      console.log('Unified Claude MCP Server is already running');
      return { success: true, status: 'running' };
    }

    if (unifiedServerStatus === 'starting') {
      console.log('Unified Claude MCP Server is already starting');
      return { success: false, status: 'starting' };
    }

    unifiedServerStatus = 'starting';

    // Load settings and check for port conflicts
    const settings = loadMCPServerSettings();

    // Pre-flight port check
    const httpCheck = await checkPortAvailable(settings.httpPort);
    const wsCheck = await checkPortAvailable(settings.wsPort);

    if (!httpCheck.available) {
      unifiedServerStatus = 'stopped';
      return {
        success: false,
        message: `HTTP port ${settings.httpPort} is already in use. Please change the port in Settings or free the port.`,
        status: 'stopped',
        conflictPort: settings.httpPort,
        conflictType: 'http',
      };
    }
    if (!wsCheck.available) {
      unifiedServerStatus = 'stopped';
      return {
        success: false,
        message: `WebSocket port ${settings.wsPort} is already in use. Please change the port in Settings or free the port.`,
        status: 'stopped',
        conflictPort: settings.wsPort,
        conflictType: 'ws',
      };
    }

    // Create Unified Claude MCP server with configurable ports
    unifiedMCPServer = new UnifiedMCPServer(settings.httpPort, settings.wsPort, mainWindow);

    // Forward server log events to the Manager window
    unifiedMCPServer.on('log', logEntry => {
      if (mcpServerManagerWindow && !mcpServerManagerWindow.isDestroyed()) {
        mcpServerManagerWindow.webContents.send('mcp-server-log', logEntry);
      }
    });

    // Forward client connection events to the Manager window
    unifiedMCPServer.on('client-connected', data => {
      if (mcpServerManagerWindow && !mcpServerManagerWindow.isDestroyed()) {
        mcpServerManagerWindow.webContents.send('mcp-server-client-update', data);
      }
    });
    unifiedMCPServer.on('client-disconnected', data => {
      if (mcpServerManagerWindow && !mcpServerManagerWindow.isDestroyed()) {
        mcpServerManagerWindow.webContents.send('mcp-server-client-update', data);
      }
    });

    // Multi-window support: Link the authoritative windowRegistry so listWindows() always reads live data
    unifiedMCPServer.setMainWindowRegistry(windowRegistry);

    // Start the server
    await unifiedMCPServer.start();

    unifiedServerStatus = 'running';
    console.log(`Unified Claude MCP Server started successfully on ports ${settings.httpPort} (HTTP) and ${settings.wsPort} (WebSocket)`);

    // Start periodic window cleanup to handle any windows that weren't properly unregistered
    startWindowCleanupInterval();

    // Multi-window support: Also populate the server's local IPC registry for routing with enhanced sync
    const syncResult = syncWindowsWithMCPServer();
    console.log(`📋 [MCP Server] Window sync result: ${syncResult.synced} synced, ${syncResult.failed} failed`);

    // Notify renderer process
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mcp-server-status-changed', {
        status: 'running',
        httpPort: settings.httpPort,
        wsPort: settings.wsPort,
      });
    }

    return { success: true, status: 'running' };
  } catch (error) {
    unifiedServerStatus = 'stopped';
    // Clean up the server instance
    if (unifiedMCPServer) {
      try { await unifiedMCPServer.stop(); } catch (e) { /* ignore stop errors */ }
    }
    unifiedMCPServer = null;
    console.error('Failed to start Unified Claude MCP Server:', error);

    // Parse EADDRINUSE errors to provide conflict info
    const msg = error.message || '';
    let conflictPort = null;
    let conflictType = null;
    if (msg.includes('HTTP port') && msg.includes('already in use')) {
      conflictPort = settings.httpPort;
      conflictType = 'http';
    } else if (msg.includes('WebSocket port') && msg.includes('already in use')) {
      conflictPort = settings.wsPort;
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
    if (unifiedServerStatus === 'stopped') {
      console.log('Unified Claude MCP Server is already stopped');
      return { success: true, status: 'stopped' };
    }

    if (unifiedServerStatus === 'stopping') {
      console.log('Unified Claude MCP Server is already stopping');
      return { success: false, status: 'stopping' };
    }

    unifiedServerStatus = 'stopping';

    // Stop the periodic cleanup interval
    stopWindowCleanupInterval();

    if (unifiedMCPServer) {
      await unifiedMCPServer.stop();
      unifiedMCPServer = null;
    }

    unifiedServerStatus = 'stopped';
    console.log('Unified Claude MCP Server stopped successfully');

    // Notify renderer process
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mcp-server-status-changed', {
        status: 'stopped',
      });
    }

    return { success: true, status: 'stopped' };
  } catch (error) {
    unifiedServerStatus = 'stopped';
    unifiedMCPServer = null;
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  // Load the MCP Server Manager HTML
  mcpServerManagerWindow.loadFile(path.join(__dirname, 'mcp-server-manager.html'));

  // Handle window closed
  mcpServerManagerWindow.on('closed', () => {
    mcpServerManagerWindow = null;
  });

  // Send initial status and request theme
  mcpServerManagerWindow.webContents.on('did-finish-load', () => {
    const settings = loadMCPServerSettings();
    mcpServerManagerWindow.webContents.send('mcp-server-status-update', {
      status: unifiedServerStatus,
      isRunning: unifiedServerStatus === 'running',
      httpPort: unifiedServerStatus === 'running' ? settings.httpPort : null,
      wsPort: unifiedServerStatus === 'running' ? settings.wsPort : null,
      connectedClients: unifiedMCPServer ? unifiedMCPServer.getConnectedClientsCount() : 0,
    });

    // Request current theme from main renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('request-theme-for-pm');
    }
  });
}

// Set external dependencies
function setMCPDependencies(deps) {
  if (deps.mainWindow !== undefined) mainWindow = deps.mainWindow;
  if (deps.unifiedMCPServer !== undefined) unifiedMCPServer = deps.unifiedMCPServer;
  if (deps.unifiedServerStatus !== undefined) unifiedServerStatus = deps.unifiedServerStatus;
  if (deps.windowRegistry !== undefined) windowRegistry = deps.windowRegistry;
  if (deps.updateMCPServerMenu !== undefined) updateMCPServerMenu = deps.updateMCPServerMenu;
  if (deps.startWindowCleanupInterval !== undefined) startWindowCleanupInterval = deps.startWindowCleanupInterval;
  if (deps.stopWindowCleanupInterval !== undefined) stopWindowCleanupInterval = deps.stopWindowCleanupInterval;
  if (deps.syncWindowsWithMCPServer !== undefined) syncWindowsWithMCPServer = deps.syncWindowsWithMCPServer;
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
