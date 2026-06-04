'use strict';

const { app, BrowserWindow, dialog, ipcMain, nativeTheme, session } = require('electron');

// =============================================================================
// GPU and WebGL fixes - matching working version configuration
// =============================================================================
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('use-angle', 'gl');

const path = require('path');
const fs = require('fs');

const codeXomicsRPC = require('./codexomics-rpc');
const VERSION_INFO = require('./version');
const i18n = require('./i18n/i18n-main');

// =============================================================================
// Extracted module imports
// =============================================================================
const wr = require('./main/window-registry');
const mb = require('./main/menu-builder');
const wm = require('./main/window-management');
const mcp = require('./main/mcp-lifecycle');
const { registerIpcHandlers } = require('./main/ipc-handlers');
const { registerProjectIpcHandlers } = require('./main/project-ipc');
const { registerRendererContentSecurityPolicy } = require('./main/security-utils');

// =============================================================================
// Application constants
// =============================================================================
const APP_NAME = VERSION_INFO.appName;
const PROJECT_DIRECTORY_NAME = 'CodeXomics Projects';
const { MCP_SETTINGS_DEFAULTS } = mcp;

// =============================================================================
// Application state (owned by main orchestrator, shared via deps)
// =============================================================================
let mainWindow = null;

// Unified Claude MCP Server
let unifiedMCPServer = null;
let unifiedServerStatus = 'stopped'; // 'stopped', 'starting', 'running', 'stopping'

// Tool menu templates
const toolMenuTemplates = new Map();

// Active window tracking
const currentActiveWindow = null;

// Queue for files opened before app is ready
let fileOpenQueue = [];

// =============================================================================
// Stub window creation functions (registered but not yet implemented)
// =============================================================================
function createResourceManagerWindow() {
  console.log('[Main] createResourceManagerWindow: not yet implemented');
}

function createDebugWindow() {
  console.log('[Main] createDebugWindow: not yet implemented');
}

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Set up environment variables for system command execution.
 * Adds common BLAST+ installation paths to PATH and sets BLASTDB.
 */
function setupEnvironmentVariables() {
  console.log('[Main] Setting up environment variables for system command execution...');

  const os = require('os');
  const path = require('path');
  const fs = require('fs');

  // Get user's home directory
  const homeDir = os.homedir();

  // Common BLAST+ installation paths
  const commonBlastPaths = [
    '/usr/local/bin',
    '/usr/bin',
    '/opt/homebrew/bin',
    '/usr/local/blast+/bin',
    path.join(homeDir, 'Applications', 'blast+', 'bin'),
    path.join(homeDir, '.local', 'blast+', 'bin'),
    path.join(homeDir, '.local', 'bin'),
    '/opt/blast+/bin',
  ];

  // Add common BLAST+ paths to PATH
  const existingPath = process.env.PATH || '';
  const additionalPaths = commonBlastPaths.filter(blastPath => {
    try {
      return fs.existsSync(blastPath);
    } catch (error) {
      return false;
    }
  });

  if (additionalPaths.length > 0) {
    const newPath = additionalPaths.join(path.delimiter) + path.delimiter + existingPath;
    process.env.PATH = newPath;
    console.log('[Main] Added BLAST+ paths to environment:', additionalPaths);
  }

  // Set BLASTDB environment variable if not already set
  if (!process.env.BLASTDB) {
    const blastDbPath = path.join(homeDir, 'blast', 'db');
    process.env.BLASTDB = blastDbPath;
    console.log('[Main] Set BLASTDB environment variable:', blastDbPath);
  }

  // Log current environment for debugging
  console.log('[Main] Current PATH:', process.env.PATH);
  console.log('[Main] Current BLASTDB:', process.env.BLASTDB);
}

/**
 * Open a GenBank file in the main window.
 * @param {string} filePath - Path to the GenBank file to open
 */
function openGenBankFile(filePath) {
  console.log('[Main] Opening GenBank file:', filePath);

  // Validate file extension
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.gbk' && ext !== '.gb' && ext !== '.genbank' && ext !== '.gbff') {
    console.warn('[Main] File is not a GenBank file:', filePath);
    return;
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error('[Main] File not found:', filePath);
    dialog.showErrorBox('File Not Found', `The file "${filePath}" could not be found.`);
    return;
  }

  // If main window exists and is ready, send file directly
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('file-opened', filePath);
    mainWindow.show();
    mainWindow.focus();
    console.log('[Main] Sent file to main window:', filePath);
  } else {
    // Queue the file to be opened when window is ready
    console.log('[Main] Queuing file for later:', filePath);
    fileOpenQueue.push(filePath);
  }
}

/**
 * Process any queued files that were opened before the app was ready.
 */
function processFileQueue() {
  if (fileOpenQueue.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
    console.log(`[Main] Processing ${fileOpenQueue.length} queued file(s)`);
    fileOpenQueue.forEach(filePath => {
      mainWindow.webContents.send('file-opened', filePath);
    });
    fileOpenQueue = [];
  }
}

// =============================================================================
// Standalone IPC handlers (not in any extracted module)
// =============================================================================

// Handle getting project directory name
ipcMain.handle('getProjectDirectoryName', async () => {
  try {
    const documentsPath = app.getPath('documents');

    // Check which project directory exists
    const possibleNames = ['CodeXomics Projects', 'GenomeExplorer Projects', 'Genome Explorer Projects'];

    for (const name of possibleNames) {
      const testPath = path.join(documentsPath, name);
      if (fs.existsSync(testPath)) {
        console.log(`[Main] Found existing project directory: ${name}`);
        return { success: true, directoryName: name };
      }
    }

    // If none exist, use the default
    const defaultName = PROJECT_DIRECTORY_NAME;
    console.log(`[Main] Using default project directory name: ${defaultName}`);
    return { success: true, directoryName: defaultName };
  } catch (error) {
    console.error('[Main] Error getting project directory name:', error);
    return { success: false, error: error.message };
  }
});

// =============================================================================
// Dependency wiring helper
// =============================================================================

function buildModuleDeps() {
  return {
    // Core state (values captured at call time — use getters for mutable state below)
    mainWindow,
    currentActiveWindow,
    fileOpenQueue,
    toolMenuTemplates,

    // Mutable state getters (always return live value when called)
    getUnifiedMCPServer: () => unifiedMCPServer,
    setUnifiedMCPServer: v => {
      unifiedMCPServer = v;
    },
    getUnifiedServerStatus: () => unifiedServerStatus,
    setUnifiedServerStatus: v => {
      unifiedServerStatus = v;
    },

    // Constants
    APP_NAME,
    VERSION_INFO,
    PROJECT_DIRECTORY_NAME,
    MCP_SETTINGS_DEFAULTS,
    i18n,

    // Window registry
    windowRegistry: wr.windowRegistry,
    pendingRegistrations: wr.pendingRegistrations,
    generateWindowId: wr.generateWindowId,
    registerGenomeWindow: wr.registerGenomeWindow,
    unregisterGenomeWindow: wr.unregisterGenomeWindow,
    cleanupWindowRegistration: wr.cleanupWindowRegistration,
    getWindowRegistryStatus: wr.getWindowRegistryStatus,
    syncWindowsWithMCPServer: wr.syncWindowsWithMCPServer,
    startWindowCleanupInterval: wr.startWindowCleanupInterval,
    stopWindowCleanupInterval: wr.stopWindowCleanupInterval,

    // Window management (window creation functions)
    createWindow: wm.createWindow,
    getCurrentMainWindow: wm.getCurrentMainWindow,
    getCurrentActiveWindow: wm.getCurrentActiveWindow,
    setCurrentActiveWindow: wm.setCurrentActiveWindow,
    sendToCurrentMainWindow: wm.sendToCurrentMainWindow,
    createProjectManagerWindow: wm.createProjectManagerWindow,
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
    createGenomicDownloadWindow: wm.createGenomicDownloadWindow,
    createResourceManagerWindow,
    createDebugWindow,
    getCustomExternalToolsMenuItems: wm.getCustomExternalToolsMenuItems,
    arrangeWindowsOptimal: wm.arrangeWindowsOptimal,
    arrangeWindowsSideBySide: wm.arrangeWindowsSideBySide,
    arrangeMainWindowFocus: wm.arrangeMainWindowFocus,
    arrangeProjectManagerFocus: wm.arrangeProjectManagerFocus,
    arrangeWindowsVertical: wm.arrangeWindowsVertical,
    arrangeWindowsCascade: wm.arrangeWindowsCascade,
    resetWindowPositions: wm.resetWindowPositions,

    // Menu functions
    createMenu: mb.createMenu,
    createCircosPlotterMenu: mb.createCircosPlotterMenu,
    createToolWindowMenu: mb.createToolWindowMenu,
    createProjectManagerMenu: mb.createProjectManagerMenu,
    createDeepGeneResearchMenu: mb.createDeepGeneResearchMenu,
    createMCPServerManagerMenu: mb.createMCPServerManagerMenu,
    updateMCPServerMenu: mcp.updateMCPServerMenu,

    // MCP lifecycle
    startUnifiedMCPServer: mcp.startUnifiedMCPServer,
    stopUnifiedMCPServer: mcp.stopUnifiedMCPServer,
    createMCPServerManagerWindow: mcp.createMCPServerManagerWindow,
    loadMCPServerSettings: mcp.loadMCPServerSettings,
    saveMCPServerSettings: mcp.saveMCPServerSettings,
    checkPortAvailable: mcp.checkPortAvailable,

    // RPC interface
    codeXomicsRPC,

    // File queue
    processFileQueue,

    // Other
    analyzerPendingData: new Map(),
  };
}

// =============================================================================
// App event listeners
// =============================================================================

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'light';
  registerRendererContentSecurityPolicy(session);

  // Set up environment variables for system command execution
  setupEnvironmentVariables();

  // Initialize i18n system before creating windows
  try {
    await i18n.init();
    // Setup IPC handlers for language change events
    i18n.setupIPC(newLang => {
      // Notify all windows about language change
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('language-changed', newLang);
      });
      // Rebuild menus with new language
      mb.createMenu();
      console.log(`[Main] Menus rebuilt for language: ${newLang}`);
    });
    console.log('[Main] i18n system initialized');
  } catch (error) {
    console.error('[Main] i18n initialization failed:', error);
  }

  // Check if app was launched with --open-project argument
  const args = process.argv.slice(1);
  const openProjectIndex = args.indexOf('--open-project');
  let projectToOpen = null;

  if (openProjectIndex !== -1 && args[openProjectIndex + 1]) {
    projectToOpen = args[openProjectIndex + 1];
    console.log('[Main] App launched with project file:', projectToOpen);
  }

  // Wire all modules BEFORE creating windows (so deps like generateWindowId exist)
  const deps = buildModuleDeps();
  mb.setMenuDependencies(deps);
  wm.setWindowMgmtDependencies(deps);
  mcp.setMCPDependencies(deps);
  registerIpcHandlers(deps);
  registerProjectIpcHandlers(deps);

  // Create the main application window
  mainWindow = wm.createWindow();

  // Wire window registry (needs mainWindow reference)
  wr.setDependencies({ mainWindow, unifiedMCPServer });

  // Create initial menu
  mb.createMenu();

  // Process queued files from file associations
  processFileQueue();

  // If a project file was specified, open Project Manager with that project
  if (projectToOpen) {
    setTimeout(() => {
      const pmWindow = wm.createProjectManagerWindow();
      if (pmWindow) {
        pmWindow.webContents.once('did-finish-load', () => {
          pmWindow.webContents.send('menu-open-project', projectToOpen);
          console.log('[Main] Sent open-project command to Project Manager');
        });
      }
    }, 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = wm.createWindow();
      // Re-wire with new mainWindow reference
      wr.setDependencies({ mainWindow, unifiedMCPServer });
      const updatedDeps = buildModuleDeps();
      mb.setMenuDependencies(updatedDeps);
      wm.setWindowMgmtDependencies(updatedDeps);
    }
  });
});

// =============================================================================
// File Association Handlers
// =============================================================================

// Handle files opened via OS file association on macOS
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  console.log('[Main] macOS open-file event:', filePath);
  openGenBankFile(filePath);
});

// Handle files passed as command-line arguments on Windows/Linux
const commandLineFiles = process.argv.slice(1).filter(arg => {
  return (
    !arg.startsWith('--') &&
    !arg.includes('electron') &&
    arg !== '.' &&
    (arg.endsWith('.gbk') || arg.endsWith('.gb') || arg.endsWith('.genbank') || arg.endsWith('.gbff'))
  );
});

if (commandLineFiles.length > 0) {
  console.log('[Main] Command-line GenBank files:', commandLineFiles);
  commandLineFiles.forEach(filePath => {
    fileOpenQueue.push(filePath);
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up Unified MCP server when app is quitting
app.on('before-quit', async () => {
  // Clean up Unified Claude MCP server
  if (unifiedMCPServer) {
    console.log('[Main] Shutting down Unified Claude MCP Server...');
    try {
      await unifiedMCPServer.stop();
      unifiedMCPServer = null;
      unifiedServerStatus = 'stopped';
    } catch (error) {
      console.error('[Main] Error stopping Unified Claude MCP Server:', error);
    }
  }
});
