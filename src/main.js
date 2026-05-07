'use strict';

const { app, BrowserWindow, Menu, MenuItem, dialog, ipcMain } = require('electron');

// =============================================================================
// GPU and WebGL fixes - matching working version configuration
// =============================================================================
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('use-angle', 'gl');

const path = require('path');
const fs = require('fs');
const net = require('net');

const UnifiedMCPServer = require('./mcp-server');
const codeXomicsRPC = require('./codexomics-rpc');
const VERSION_INFO = require('./version');
const i18n = require('./i18n/i18n-main');

// =============================================================================
// Module imports (extracted from monolithic main.js → src/main/)
// =============================================================================
const wr = require('./main/window-registry');
const mb = require('./main/menu-builder');
const wm = require('./main/window-management');
const mcp = require('./main/mcp-lifecycle');
const { registerIpcHandlers } = require('./main/ipc-handlers');
const { registerProjectIpcHandlers } = require('./main/project-ipc');

// =============================================================================
// Application Constants
// =============================================================================
const APP_NAME = VERSION_INFO.appName;
const PROJECT_DIRECTORY_NAME = 'CodeXomics Projects';

let mainWindow;
let unifiedMCPServer = null;
let unifiedServerStatus = 'stopped';

// File association support
let fileOpenQueue = [];

// =============================================================================
// Wire module dependencies
// =============================================================================
function wireDependencies() {
  // Window registry
  wr.setDependencies({
    get mainWindow() { return mainWindow; },
    get unifiedMCPServer() { return unifiedMCPServer; },
    get unifiedServerStatus() { return unifiedServerStatus; },
  });

  // Menu builder
  mb.setMenuDependencies({
    APP_NAME,
    VERSION_INFO,
    get mainWindow() { return mainWindow; },
    get unifiedMCPServer() { return unifiedMCPServer; },
    get unifiedServerStatus() { return unifiedServerStatus; },
    i18n,
    createWindow: wm.createWindow,
    createCircosWindow: wm.createCircosWindow,
    createKEGGWindow: wm.createKEGGWindow,
    createGOWindow: wm.createGOWindow,
    createUniProtWindow: wm.createUniProtWindow,
    createInterProWindow: wm.createInterProWindow,
    createNCBIWindow: wm.createNCBIWindow,
    createSTRINGWindow: wm.createSTRINGWindow,
    createDAVIDWindow: wm.createDAVIDWindow,
    createReactomeWindow: wm.createReactomeWindow,
    createPDBWindow: wm.createPDBWindow,
    createGeneAnnotationRefineWindow: wm.createGeneAnnotationRefineWindow,
    createBlastDownloaderWindow: wm.createBlastDownloaderWindow,
    createBlastConfigWindow: wm.createBlastConfigWindow,
    createProGenFixerWindow: wm.createProGenFixerWindow,
    createDeepGeneResearchWindow: wm.createDeepGeneResearchWindow,
    createChopchopWindow: wm.createChopchopWindow,
    createCustomExternalToolWindow: wm.createCustomExternalToolWindow,
    createProjectManagerWindow: wm.createProjectManagerWindow,
    arrangeWindowsOptimal: wm.arrangeWindowsOptimal,
    arrangeWindowsSideBySide: wm.arrangeWindowsSideBySide,
    arrangeMainWindowFocus: wm.arrangeMainWindowFocus,
    arrangeProjectManagerFocus: wm.arrangeProjectManagerFocus,
    arrangeWindowsVertical: wm.arrangeWindowsVertical,
    arrangeWindowsCascade: wm.arrangeWindowsCascade,
    resetWindowPositions: wm.resetWindowPositions,
    get PROJECT_DIRECTORY_NAME() { return PROJECT_DIRECTORY_NAME; },
  });

  // Window management
  wm.setWindowMgmtDependencies({
    get mainWindow() { return mainWindow; },
    get unifiedMCPServer() { return unifiedMCPServer; },
    get unifiedServerStatus() { return unifiedServerStatus; },
    windowRegistry: wr.windowRegistry,
    pendingRegistrations: wr.pendingRegistrations,
    registerGenomeWindow: wr.registerGenomeWindow,
    unregisterGenomeWindow: wr.unregisterGenomeWindow,
    getWindowRegistryStatus: wr.getWindowRegistryStatus,
    syncWindowsWithMCPServer: wr.syncWindowsWithMCPServer,
    registerGenomeWindowDeferred: wr.registerGenomeWindowDeferred,
    APP_NAME,
    VERSION_INFO,
    PROJECT_DIRECTORY_NAME,
    i18n,
    loadMCPServerSettings: mcp.loadMCPServerSettings,
    saveMCPServerSettings: mcp.saveMCPServerSettings,
  });

  // MCP lifecycle
  mcp.setMCPDependencies({
    get mainWindow() { return mainWindow; },
    get unifiedMCPServer() { return unifiedMCPServer; },
    get unifiedServerStatus() { return unifiedServerStatus; },
    set unifiedServerStatus(v) { unifiedServerStatus = v; },
    set unifiedMCPServer(s) { unifiedMCPServer = s; },
    UnifiedMCPServer,
    codeXomicsRPC,
    VERSION_INFO,
    APP_NAME,
    PROJECT_DIRECTORY_NAME,
    windowRegistry: wr.windowRegistry,
    registerGenomeWindow: wr.registerGenomeWindow,
    getWindowRegistryStatus: wr.getWindowRegistryStatus,
    syncWindowsWithMCPServer: wr.syncWindowsWithMCPServer,
    i18n,
  });

  // Register IPC handlers
  const ipcDeps = {
    get mainWindow() { return mainWindow; },
    get unifiedMCPServer() { return unifiedMCPServer; },
    get unifiedServerStatus() { return unifiedServerStatus; },
    set unifiedServerStatus(v) { unifiedServerStatus = v; },
    set unifiedMCPServer(s) { unifiedMCPServer = s; },
    windowRegistry: wr.windowRegistry,
    pendingRegistrations: wr.pendingRegistrations,
    fileOpenQueue,
    registerGenomeWindow: wr.registerGenomeWindow,
    unregisterGenomeWindow: wr.unregisterGenomeWindow,
    getWindowRegistryStatus: wr.getWindowRegistryStatus,
    syncWindowsWithMCPServer: wr.syncWindowsWithMCPServer,
    registerGenomeWindowDeferred: wr.registerGenomeWindowDeferred,
    // Window creation functions
    createMCPServerManagerWindow: mcp.createMCPServerManagerWindow,
    createCircosWindow: wm.createCircosWindow,
    createKEGGWindow: wm.createKEGGWindow,
    createGOWindow: wm.createGOWindow,
    createUniProtWindow: wm.createUniProtWindow,
    createInterProWindow: wm.createInterProWindow,
    createNCBIWindow: wm.createNCBIWindow,
    createSTRINGWindow: wm.createSTRINGWindow,
    createDAVIDWindow: wm.createDAVIDWindow,
    createReactomeWindow: wm.createReactomeWindow,
    createPDBWindow: wm.createPDBWindow,
    createGeneAnnotationRefineWindow: wm.createGeneAnnotationRefineWindow,
    createBlastDownloaderWindow: wm.createBlastDownloaderWindow,
    createBlastConfigWindow: wm.createBlastConfigWindow,
    createProGenFixerWindow: wm.createProGenFixerWindow,
    createDeepGeneResearchWindow: wm.createDeepGeneResearchWindow,
    createChopchopWindow: wm.createChopchopWindow,
    createCustomExternalToolWindow: wm.createCustomExternalToolWindow,
    createWindow: wm.createWindow,
    createProjectManagerWindow: wm.createProjectManagerWindow,
    // Menu builder
    createMenu: mb.createMenu,
    createCircosPlotterMenu: mb.createCircosPlotterMenu,
    createToolWindowMenu: mb.createToolWindowMenu,
    createDeepGeneResearchMenu: mb.createDeepGeneResearchMenu,
    createProjectManagerMenu: mb.createProjectManagerMenu,
    // Layout
    arrangeWindowsOptimal: wm.arrangeWindowsOptimal,
    arrangeWindowsSideBySide: wm.arrangeWindowsSideBySide,
    arrangeMainWindowFocus: wm.arrangeMainWindowFocus,
    arrangeProjectManagerFocus: wm.arrangeProjectManagerFocus,
    arrangeWindowsVertical: wm.arrangeWindowsVertical,
    arrangeWindowsCascade: wm.arrangeWindowsCascade,
    resetWindowPositions: wm.resetWindowPositions,
    // Settings
    loadMCPServerSettings: mcp.loadMCPServerSettings,
    saveMCPServerSettings: mcp.saveMCPServerSettings,
    // Other
    APP_NAME, VERSION_INFO, PROJECT_DIRECTORY_NAME,
    MCP_SETTINGS_DEFAULTS: mcp.MCP_SETTINGS_DEFAULTS,
    i18n,
    openGenBankFile,
    processFileQueue,
  };

  registerIpcHandlers(ipcDeps);

  const projectIpcDeps = {
    get mainWindow() { return mainWindow; },
    windowRegistry: wr.windowRegistry,
    createProjectManagerWindow: wm.createProjectManagerWindow,
    createWindow: wm.createWindow,
    createMenu: mb.createMenu,
    openGenBankFile,
    MCP_SETTINGS_DEFAULTS: mcp.MCP_SETTINGS_DEFAULTS,
    APP_NAME, PROJECT_DIRECTORY_NAME, VERSION_INFO,
  };

  registerProjectIpcHandlers(projectIpcDeps);
}

// =============================================================================
// Environment Setup
// =============================================================================
function setupEnvironmentVariables() {
  console.log('Setting up environment variables...');
  const os = require('os');
  const homeDir = os.homedir();
  const commonBlastPaths = [
    '/usr/local/bin', '/usr/bin', '/opt/homebrew/bin',
    '/usr/local/blast+/bin',
    path.join(homeDir, 'Applications', 'blast+', 'bin'),
    path.join(homeDir, '.local', 'blast+', 'bin'),
    path.join(homeDir, '.local', 'bin'), '/opt/blast+/bin',
  ];
  const existingPath = process.env.PATH || '';
  const additionalPaths = commonBlastPaths.filter(p => {
    try { return fs.existsSync(p); } catch { return false; }
  });
  if (additionalPaths.length > 0) {
    process.env.PATH = additionalPaths.join(path.delimiter) + path.delimiter + existingPath;
  }
  if (!process.env.BLASTDB) {
    process.env.BLASTDB = path.join(homeDir, 'blast', 'db');
  }
}

// =============================================================================
// File Association Handlers
// =============================================================================
function openGenBankFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.gbk' && ext !== '.gb' && ext !== '.genbank' && ext !== '.gbff') return;
  if (!fs.existsSync(filePath)) {
    dialog.showErrorBox('File Not Found', `"${filePath}" could not be found.`);
    return;
  }
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('file-opened', filePath);
    mainWindow.show();
    mainWindow.focus();
  } else {
    fileOpenQueue.push(filePath);
  }
}

function processFileQueue() {
  if (fileOpenQueue.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
    fileOpenQueue.forEach(fp => mainWindow.webContents.send('file-opened', fp));
    fileOpenQueue = [];
  }
}

// Command-line file handling
const commandLineFiles = process.argv.slice(1).filter(arg =>
  !arg.startsWith('--') && !arg.includes('electron') && arg !== '.' &&
  (arg.endsWith('.gbk') || arg.endsWith('.gb') || arg.endsWith('.genbank') || arg.endsWith('.gbff'))
);
if (commandLineFiles.length > 0) {
  commandLineFiles.forEach(fp => fileOpenQueue.push(fp));
}

// =============================================================================
// App Lifecycle
// =============================================================================
app.whenReady().then(async () => {
  setupEnvironmentVariables();

  // Initialize i18n
  try {
    await i18n.init();
    i18n.setupIPC(newLang => {
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('language-changed', newLang);
      });
      mb.createMenu();
    });
    console.log('[Main] i18n initialized');
  } catch (error) {
    console.error('[Main] i18n init failed:', error);
  }

  // Wire all module dependencies
  wireDependencies();

  // Check for --open-project argument
  const args = process.argv.slice(1);
  const openProjectIndex = args.indexOf('--open-project');
  let projectToOpen = null;
  if (openProjectIndex !== -1 && args[openProjectIndex + 1]) {
    projectToOpen = args[openProjectIndex + 1];
  }

  // Create main window and menu
  let createdWindow = wm.createWindow();
  if (createdWindow && createdWindow.then) {
    mainWindow = await createdWindow;
  } else {
    mainWindow = createdWindow;
  }
  mb.createMenu();

  // Process queued files
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.once('did-finish-load', () => processFileQueue());
  }

  // Open project if specified
  if (projectToOpen) {
    setTimeout(() => {
      const pmWindow = wm.createProjectManagerWindow();
      if (pmWindow) {
        pmWindow.webContents.once('did-finish-load', () => {
          pmWindow.webContents.send('menu-open-project', projectToOpen);
        });
      }
    }, 1000);
  }

  // macOS dock click
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      wm.createWindow();
    }
  });
});

// File association (macOS)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  openGenBankFile(filePath);
});

// Window close behavior
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Graceful shutdown
app.on('before-quit', async () => {
  if (unifiedMCPServer) {
    console.log('Shutting down MCP Server...');
    try {
      await unifiedMCPServer.stop();
      unifiedMCPServer = null;
      unifiedServerStatus = 'stopped';
    } catch (error) {
      console.error('Error stopping MCP server:', error);
    }
  }
});

// =============================================================================
// P1: Application Infrastructure IPC Handlers
// Added for contextIsolation migration — serves locale data via IPC
// =============================================================================
ipcMain.handle('get-locale-data', async (event, language, namespace) => {
  try {
    const localePath = path.join(__dirname, 'locales', language, `${namespace}.json`);
    if (!fs.existsSync(localePath)) {
      return { success: false, error: `Locale not found: ${localePath}` };
    }
    return { success: true, data: JSON.parse(fs.readFileSync(localePath, 'utf-8')) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-locale-languages', async () => {
  try {
    const localePath = path.join(__dirname, 'locales');
    if (!fs.existsSync(localePath)) return { success: false, error: 'Locales directory not found' };
    const langs = fs.readdirSync(localePath, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
    return { success: true, data: langs };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-paths', async () => {
  try {
    return {
      success: true,
      data: {
        appPath: app.getAppPath(),
        userData: app.getPath('userData'),
        documents: app.getPath('documents'),
        home: require('os').homedir(),
        resourcesPath: process.resourcesPath || path.join(__dirname, '..'),
        localesPath: path.join(__dirname, 'locales'),
        pluginsPath: path.join(app.getPath('userData'), 'plugins'),
        toolsRegistryPath: path.join(__dirname, '..', 'tools_registry'),
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
