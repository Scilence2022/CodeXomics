'use strict';

const { BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const dialog = require('electron').dialog;
const { createSecureWebPreferences } = require('./security-utils');

// External references (set by main module via setWindowMgmtDependencies)
let mainWindow;
let currentActiveWindow;
let toolMenuTemplates;


// External function references (set by main module)
let generateWindowId;
let registerGenomeWindow;
let unregisterGenomeWindow;
let cleanupWindowRegistration;
let createMenu;
let createCircosPlotterMenu;
let createToolWindowMenu;
let createProjectManagerMenu;
let createDeepGeneResearchMenu;

let codeXomicsRPC;
let processFileQueue;


function setWindowMgmtDependencies(deps) {
  if (deps.mainWindow !== undefined) mainWindow = deps.mainWindow;
  if (deps.currentActiveWindow !== undefined) currentActiveWindow = deps.currentActiveWindow;
  if (deps.toolMenuTemplates !== undefined) toolMenuTemplates = deps.toolMenuTemplates;
  if (deps.generateWindowId !== undefined) generateWindowId = deps.generateWindowId;
  if (deps.registerGenomeWindow !== undefined) registerGenomeWindow = deps.registerGenomeWindow;
  if (deps.unregisterGenomeWindow !== undefined) unregisterGenomeWindow = deps.unregisterGenomeWindow;
  if (deps.cleanupWindowRegistration !== undefined) cleanupWindowRegistration = deps.cleanupWindowRegistration;
  if (deps.createMenu !== undefined) createMenu = deps.createMenu;
  if (deps.createCircosPlotterMenu !== undefined) createCircosPlotterMenu = deps.createCircosPlotterMenu;
  if (deps.createToolWindowMenu !== undefined) createToolWindowMenu = deps.createToolWindowMenu;
  if (deps.createProjectManagerMenu !== undefined) createProjectManagerMenu = deps.createProjectManagerMenu;
  if (deps.createDeepGeneResearchMenu !== undefined) createDeepGeneResearchMenu = deps.createDeepGeneResearchMenu;
  if (deps.codeXomicsRPC !== undefined) codeXomicsRPC = deps.codeXomicsRPC;
  if (deps.processFileQueue !== undefined) processFileQueue = deps.processFileQueue;
}

function createWindow() {
  // Generate a unique window ID for multi-window support
  const windowId = generateWindowId();

  // Create the browser window
  const newWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: createSecureWebPreferences({ cache: false }),
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
  });

  // Update the module-level mainWindow to point to the newest window
  mainWindow = newWindow;

  // Store windowId on the BrowserWindow object for easy lookup
  newWindow.windowId = windowId;

  // Register in window registry with enhanced error handling
  registerGenomeWindow(windowId, newWindow, { skipResolve: true });
  console.log(`📋 [createMainWindow] Window ${windowId} registered in registry`);

  // Load the app
  newWindow.loadFile(path.join(__dirname, '..', 'renderer/index.html'));

  // Show window when ready to prevent visual flash
  newWindow.once('ready-to-show', () => {
    newWindow.show();

    // Send windowId to renderer process for MCPBridge identification
    newWindow.webContents.send('set-window-id', windowId);

    // Initialize RPC interface after window is ready
    codeXomicsRPC.setMainWindow(newWindow);
    codeXomicsRPC.initialize();

    // Process any files that were queued before window was ready
    setTimeout(() => {
      processFileQueue();
    }, 500);
  });

  // Open DevTools for debugging (can be disabled in production)
  if (process.argv.includes('--dev')) {
    newWindow.webContents.openDevTools();
  }

  // When this specific window gains focus, make it the active main window and
  // rebuild the menu so that menu actions target this window.  We close over
  // `newWindow` (not the mutable `mainWindow`) so the handler always refers to
  // the correct instance even after additional windows are created.
  newWindow.on('focus', () => {
    if (currentActiveWindow !== newWindow) {
      currentActiveWindow = newWindow;
      createMenu(); // Rebuild menu so sendToCurrentMainWindow routes to this window
      console.log(`Switched to main window menu (windowId: ${windowId})`);
    }
  });

  // webContents focus also covers clicking inside the window's content area
  newWindow.webContents.on('focus', () => {
    if (currentActiveWindow !== newWindow) {
      currentActiveWindow = newWindow;
      createMenu();
      console.log(`Switched to main window menu via webContents focus (windowId: ${windowId})`);
    }
  });

  // Handle window closed
  newWindow.on('closed', () => {
    console.log(`📋 [createMainWindow] Window ${windowId} closed`);
    unregisterGenomeWindow(windowId);
    // Only clear the module-level mainWindow pointer if it still refers to this
    // closing window.  When multiple windows are open, mainWindow may already
    // point to a different (surviving) window.
    if (mainWindow === newWindow) {
      mainWindow = null;
    }
    if (currentActiveWindow === newWindow) {
      currentActiveWindow = null;
    }
  });

  // Handle errors
  newWindow.webContents.on('crashed', (event, killed) => {
    console.error(`📋 [createMainWindow] Window ${windowId} crashed (killed: ${killed})`);
    cleanupWindowRegistration(windowId);
  });

  newWindow.webContents.on('render-process-gone', (event, details) => {
    console.error(`📋 [createMainWindow] Window ${windowId} render process gone: ${details.reason}`);
    cleanupWindowRegistration(windowId);
  });

  return newWindow;
}

// Helper function to get the current active main window

function getCurrentMainWindow() {
  // First try to use the tracked current active window if it's genuinely a main window
  if (
    currentActiveWindow &&
    !currentActiveWindow.isDestroyed() &&
    currentActiveWindow.windowId // Only the true main window gets a windowId assigned
  ) {
    return currentActiveWindow;
  }

  // Fall back to the original mainWindow
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  // Last resort: find any main window using the windowId marker
  const mainWindows = BrowserWindow.getAllWindows().filter(win => !win.isDestroyed() && win.windowId);

  return mainWindows.length > 0 ? mainWindows[0] : null;
}

// Helper functions for surfacing settings-related notifications to the renderer.
// Mirrors the equivalent helpers in ipc-handlers.js; defined here because the
// settings flows in this module call them directly.
function showSettingsWarning(title, message) {
  const win = getCurrentMainWindow();
  if (win && win.webContents) {
    win.webContents.send('show-notification', {
      type: 'warning',
      title,
      message,
      duration: 5000,
    });
  }
}

function showSettingsError(title, message) {
  const win = getCurrentMainWindow();
  if (win && win.webContents) {
    win.webContents.send('show-notification', {
      type: 'error',
      title,
      message,
      duration: 8000,
    });
  }
}

// Helper function to safely send message to current main window

function sendToCurrentMainWindow(channel, ...args) {
  const currentWindow = getCurrentMainWindow();
  if (currentWindow && !currentWindow.isDestroyed()) {
    currentWindow.webContents.send(channel, ...args);
  } else {
    console.warn(`Cannot send message '${channel}': No active main window found`);
  }
}

// Helper function to generate custom external tools menu items

function getCustomExternalToolsMenuItems() {
  const customTools = global.customExternalTools || [];
  const menuItems = [];

  // Filter custom tools only
  const customOnlyTools = customTools.filter(tool => tool.type === 'custom');

  if (customOnlyTools.length > 0) {
    // Add separator before custom tools if there are any
    menuItems.push({ type: 'separator' });

    // Add each custom tool as a menu item
    customOnlyTools.forEach(tool => {
      // Create a copy of the tool data to avoid closure issues
      const toolData = {
        type: tool.type,
        id: tool.id,
        name: tool.name,
        url: tool.url,
      };

      menuItems.push({
        label: tool.name,
        click: () => {
          createCustomExternalToolWindow(toolData);
        },
      });
    });
  }

  return menuItems;
}

// Create menu

function createCircosWindow() {
  try {
    // Create new window for the Circos genome plotter
    const circosWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: createSecureWebPreferences(),
      title: 'Circos Genome Plotter - CodeXomics',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      show: false,
    });

    const circosPath = path.join(__dirname, '..', 'circos-plotter.html');

    // Load the Circos plotter HTML
    circosWindow.loadFile(circosPath);

    // Show window when ready
    circosWindow.once('ready-to-show', () => {
      circosWindow.show();
      // 为 Circos Plotter 设置专门的菜单系统
      createCircosPlotterMenu(circosWindow);
      currentActiveWindow = circosWindow;
    });

    // Circos窗口获得焦点时切换到Circos菜单
    circosWindow.on('focus', () => {
      if (currentActiveWindow !== circosWindow) {
        currentActiveWindow = circosWindow;
        createCircosPlotterMenu(circosWindow);
        console.log('Switched to Circos Plotter menu');
      }
    });

    // Open DevTools for debugging
    circosWindow.webContents.openDevTools();

    // Handle window closed
    circosWindow.on('closed', () => {
      console.log('Circos Genome Plotter window closed');
      if (currentActiveWindow === circosWindow) {
        currentActiveWindow = null;
        // 切换回主窗口菜单
        if (mainWindow && !mainWindow.isDestroyed()) {
          createMenu();
          console.log('Switched back to main window menu');
        }
      }
    });
  } catch (error) {
    console.error('Failed to open Circos Genome Plotter:', error);
  }
}

// NOTE: Circos-related IPC handlers (get-circos-genome-data, navigate-to-chromosome,
// navigate-to-gene, get-gene-sequence, get-region-sequence) have been moved to
// src/main/ipc-handlers.js (Section 11) to avoid duplicate registration errors.
// See: https://github.com/electron/electron/blob/main/docs/api/ipc-main.md#ipcmainhandlechannel-listener

// ========== BIOLOGICAL DATABASES TOOLS ==========

// Create KEGG Pathway Analysis Window

function createKEGGWindow() {
  try {
    const keggWindow = new BrowserWindow({
      width: 1600,
      height: 1000,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: createSecureWebPreferences(),
      title: 'KEGG Pathway Analysis - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
    });

    keggWindow.loadFile(path.join(__dirname, '..', 'bioinformatics-tools/kegg-analyzer.html'));

    keggWindow.once('ready-to-show', () => {
      keggWindow.show();
      // 为KEGG工具窗口设置独立菜单
      createToolWindowMenu(keggWindow, 'KEGG Pathway Analysis');
    });

    keggWindow.webContents.openDevTools();

    keggWindow.on('closed', () => {
      console.log('KEGG Pathway Analysis window closed');
    });
  } catch (error) {
    console.error('Failed to open KEGG Pathway Analysis:', error);
  }
}

// Create Gene Ontology (GO) Analysis Window

function createGOWindow() {
  try {
    const goWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: createSecureWebPreferences(),
      title: 'Gene Ontology (GO) Analyzer - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
    });

    goWindow.loadFile(path.join(__dirname, '..', 'bioinformatics-tools/go-analyzer.html'));

    goWindow.once('ready-to-show', () => {
      goWindow.show();
      // 为GO工具窗口设置独立菜单
      createToolWindowMenu(goWindow, 'Gene Ontology Analyzer');
    });

    goWindow.webContents.openDevTools();

    goWindow.on('closed', () => {
      console.log('GO Analyzer window closed');
    });
  } catch (error) {
    console.error('Failed to open GO Analyzer:', error);
  }
}

// Create UniProt Database Search Window

function createUniProtWindow() {
  try {
    const uniprotWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: createSecureWebPreferences(),
      title: 'Search UniProt Database - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
    });

    uniprotWindow.loadFile(path.join(__dirname, '..', 'bioinformatics-tools/uniprot-search.html'));

    uniprotWindow.once('ready-to-show', () => {
      uniprotWindow.show();
      // 为UniProt工具窗口设置独立菜单
      createToolWindowMenu(uniprotWindow, 'Search UniProt Database');
    });

    uniprotWindow.webContents.openDevTools();

    uniprotWindow.on('closed', () => {
      console.log('UniProt Search window closed');
    });
  } catch (error) {
    console.error('Failed to open UniProt Search:', error);
  }
}

// Create InterPro Domain Analysis Window

function createInterProWindow() {
  try {
    const interproWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: createSecureWebPreferences(),
      title: 'InterPro Domain Analysis - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
    });

    interproWindow.loadFile(path.join(__dirname, '..', 'bioinformatics-tools/interpro-analyzer.html'));

    interproWindow.once('ready-to-show', () => {
      interproWindow.show();
      // 为InterPro工具窗口设置独立菜单
      createToolWindowMenu(interproWindow, 'InterPro Domain Analysis');
    });

    interproWindow.webContents.openDevTools();

    interproWindow.on('closed', () => {
      console.log('InterPro Analyzer window closed');
    });
  } catch (error) {
    console.error('Failed to open InterPro Analyzer:', error);
  }
}

// Create NCBI Database Browser Window

function createNCBIWindow() {
  try {
    const ncbiWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: createSecureWebPreferences(),
      title: 'Search NCBI Database - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
    });

    ncbiWindow.loadFile(path.join(__dirname, '..', 'bioinformatics-tools/ncbi-browser.html'));

    ncbiWindow.once('ready-to-show', () => {
      ncbiWindow.show();
      // 为NCBI工具窗口设置独立菜单
      createToolWindowMenu(ncbiWindow, 'Search NCBI Database');
    });

    ncbiWindow.webContents.openDevTools();

    ncbiWindow.on('closed', () => {
      console.log('NCBI Browser window closed');
    });
  } catch (error) {
    console.error('Failed to open NCBI Browser:', error);
  }
}

// ========== ANALYSIS TOOLS ==========

// Create STRING Protein Networks Window

function createSTRINGWindow() {
  try {
    const stringWindow = new BrowserWindow({
      width: 1600,
      height: 1000,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: createSecureWebPreferences(),
      title: 'STRING Protein Networks - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
    });

    stringWindow.loadFile(path.join(__dirname, '..', 'bioinformatics-tools/string-networks.html'));

    stringWindow.once('ready-to-show', () => {
      stringWindow.show();
      // 为STRING工具窗口设置独立菜单
      createToolWindowMenu(stringWindow, 'STRING Protein Networks');
    });

    stringWindow.webContents.openDevTools();

    stringWindow.on('closed', () => {
      console.log('STRING Networks window closed');
    });
  } catch (error) {
    console.error('Failed to open STRING Networks:', error);
  }
}

// Create DAVID Functional Analysis Window

function createDAVIDWindow() {
  try {
    const davidWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: createSecureWebPreferences(),
      title: 'DAVID Functional Analysis - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
    });

    davidWindow.loadFile(path.join(__dirname, '..', 'bioinformatics-tools/david-analyzer.html'));

    davidWindow.once('ready-to-show', () => {
      davidWindow.show();
      // 为DAVID工具窗口设置独立菜单
      createToolWindowMenu(davidWindow, 'DAVID Functional Analysis');
    });

    davidWindow.webContents.openDevTools();

    davidWindow.on('closed', () => {
      console.log('DAVID Analyzer window closed');
    });
  } catch (error) {
    console.error('Failed to open DAVID Analyzer:', error);
  }
}

// Create Reactome Pathway Browser Window

function createReactomeWindow() {
  try {
    const reactomeWindow = new BrowserWindow({
      width: 1600,
      height: 1000,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: createSecureWebPreferences(),
      title: 'Reactome Pathway Browser - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
    });

    reactomeWindow.loadFile(path.join(__dirname, '..', 'bioinformatics-tools/reactome-browser.html'));

    reactomeWindow.once('ready-to-show', () => {
      reactomeWindow.show();
      // 为Reactome工具窗口设置独立菜单
      createToolWindowMenu(reactomeWindow, 'Reactome Pathway Browser');
    });

    reactomeWindow.webContents.openDevTools();

    reactomeWindow.on('closed', () => {
      console.log('Reactome Browser window closed');
    });
  } catch (error) {
    console.error('Failed to open Reactome Browser:', error);
  }
}

// Create PDB Structure Viewer Window

function createPDBWindow() {
  try {
    const pdbWindow = new BrowserWindow({
      width: 1600,
      height: 1000,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: createSecureWebPreferences(),
      title: 'PDB Structure Viewer - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
    });

    pdbWindow.loadFile(path.join(__dirname, '..', 'bioinformatics-tools/pdb-viewer.html'));

    pdbWindow.once('ready-to-show', () => {
      pdbWindow.show();
      // 为PDB工具窗口设置独立菜单
      createToolWindowMenu(pdbWindow, 'PDB Structure Viewer');
    });

    pdbWindow.webContents.openDevTools();

    pdbWindow.on('closed', () => {
      console.log('PDB Structure Viewer window closed');
    });
  } catch (error) {
    console.error('Failed to open PDB Structure Viewer:', error);
  }
}

// Create Gene Annotation Refine Window

function createGeneAnnotationRefineWindow() {
  try {
    const geneAnnotationRefineWindow = new BrowserWindow({
      width: 1600,
      height: 1000,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: createSecureWebPreferences(),
      title: 'Gene Annotation Refine - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
    });

    geneAnnotationRefineWindow.loadFile(path.join(__dirname, '..', 'bioinformatics-tools/gene-annotation-refine.html'));

    geneAnnotationRefineWindow.once('ready-to-show', () => {
      geneAnnotationRefineWindow.show();
      // Set specialized menu for Gene Annotation Refine tool window
      createToolWindowMenu(geneAnnotationRefineWindow, 'Gene Annotation Refine');
    });

    geneAnnotationRefineWindow.webContents.openDevTools();

    geneAnnotationRefineWindow.on('closed', () => {
      console.log('Gene Annotation Refine window closed');
    });
  } catch (error) {
    console.error('Failed to open Gene Annotation Refine:', error);
  }
}

// Create BLAST+ Downloader Window

function createBlastDownloaderWindow() {
  try {
    const blastDownloaderWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 600,
      webPreferences: createSecureWebPreferences(),
      title: 'BLAST+ Tools Downloader - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
    });

    blastDownloaderWindow.loadFile(path.join(__dirname, '..', 'blast-downloader.html'));

    blastDownloaderWindow.once('ready-to-show', () => {
      blastDownloaderWindow.show();
      // Set specialized menu for BLAST downloader window
      createToolWindowMenu(blastDownloaderWindow, 'BLAST+ Downloader');
    });

    blastDownloaderWindow.on('closed', () => {
      // 清理菜单模板
      toolMenuTemplates.delete(blastDownloaderWindow.id);

      // 如果关闭的是当前活动窗口，恢复主窗口菜单
      if (currentActiveWindow === blastDownloaderWindow) {
        currentActiveWindow = null;
        createMenu(); // 直接调用createMenu()来恢复主窗口菜单
      }
      console.log('BLAST+ Downloader window closed');
    });

    console.log('BLAST+ Downloader window created');
  } catch (error) {
    console.error('Failed to open BLAST+ Downloader:', error);
  }
}

// Create BLAST Configuration Window

function createBlastConfigWindow() {
  try {
    const blastConfigWindow = new BrowserWindow({
      width: 1000,
      height: 750,
      minWidth: 900,
      minHeight: 650,
      webPreferences: createSecureWebPreferences(),
      title: 'Configure BLAST Tools - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: false,
    });

    blastConfigWindow.loadFile(path.join(__dirname, '..', 'blast-config.html'));

    blastConfigWindow.once('ready-to-show', () => {
      blastConfigWindow.show();
      // Set specialized menu for BLAST config window
      createToolWindowMenu(blastConfigWindow, 'BLAST Configuration');
    });

    blastConfigWindow.on('closed', () => {
      // Clean up menu template
      toolMenuTemplates.delete(blastConfigWindow.id);

      // If this was the active window, restore main window menu
      if (currentActiveWindow === blastConfigWindow) {
        currentActiveWindow = null;
        createMenu();
      }
      console.log('BLAST Configuration window closed');
    });

    console.log('BLAST Configuration window created');
  } catch (error) {
    console.error('Failed to open BLAST Configuration:', error);
  }
}

// Create specialized menu for Deep Gene Research window

async function createProGenFixerWindow() {
  try {
    console.log('🚀 Starting ProGenFixer window creation...');
    let progenFixerUrl = 'https://progenfixer.biodesign.ac.cn'; // Default fallback

    try {
      // Get the URL from General Settings
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && mainWindow.webContents) {
        console.log('📋 Getting settings from main window...');
        const settings = await mainWindow.webContents.executeJavaScript(`
          if (window.genomeBrowser && window.genomeBrowser.generalSettingsManager) {
            window.genomeBrowser.generalSettingsManager.getSettings();
          } else {
            Promise.resolve({});
          }
        `);

        console.log('📋 Settings retrieved:', settings);

        if (settings && settings.progenFixerUrl) {
          progenFixerUrl = settings.progenFixerUrl;
          console.log('✅ Using ProGenFixer URL from settings:', progenFixerUrl);
        } else {
          console.log('⚠️ No ProGenFixer URL found in settings, using default:', progenFixerUrl);
          showSettingsWarning(
            'ProGenFixer URL not configured',
            'Using default URL (https://progenfixer.biodesign.ac.cn). You can configure the URL in General Settings → Features → External Tools.'
          );
        }
      } else {
        console.log('⚠️ Main window not available, using default URL:', progenFixerUrl);
        showSettingsWarning(
          'Main window not available',
          'Using default URL (https://progenfixer.biodesign.ac.cn). Please ensure the main window is open.'
        );
      }
    } catch (error) {
      console.warn('❌ Failed to get ProGenFixer URL from settings, using default:', error.message);
      showSettingsError(
        'Failed to load ProGenFixer settings',
        `Using default URL (https://progenfixer.biodesign.ac.cn) due to error: ${error.message}. Please check your settings configuration.`
      );
    }

    console.log('🔧 Creating ProGenFixer window with URL:', progenFixerUrl);

    const progenFixerWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: createSecureWebPreferences({
        experimentalFeatures: true,
        enableBlinkFeatures: 'ClipboardRead,ClipboardWrite',
      }),
      title: 'ProGenFixer - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
    });

    console.log('✅ ProGenFixer BrowserWindow created successfully');

    // Load the ProGenFixer URL
    console.log('🌐 Loading ProGenFixer URL...');
    await progenFixerWindow.loadURL(progenFixerUrl);
    console.log('✅ ProGenFixer URL loaded successfully');

    // Show the window when ready
    progenFixerWindow.once('ready-to-show', () => {
      console.log('🎉 ProGenFixer window ready to show');
      progenFixerWindow.show();
      progenFixerWindow.focus();
      console.log('✅ ProGenFixer window opened successfully');
    });

    // Also try to show immediately after load
    console.log('🚀 Attempting immediate show...');
    progenFixerWindow.show();
    progenFixerWindow.focus();

    // Fallback: Show window after a timeout if ready-to-show doesn't fire
    setTimeout(() => {
      if (!progenFixerWindow.isDestroyed() && !progenFixerWindow.isVisible()) {
        console.log('⚠️ ProGenFixer window ready-to-show timeout, forcing show');
        progenFixerWindow.show();
        progenFixerWindow.focus();
      }
    }, 3000);

    // Handle window closed
    progenFixerWindow.on('closed', () => {
      console.log('🔒 ProGenFixer window closed');
    });

    // Handle navigation errors
    progenFixerWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('❌ ProGenFixer window failed to load:', errorDescription);
      console.error('❌ Error code:', errorCode);
      console.error('❌ Validated URL:', validatedURL);

      // Show user-friendly error page
      progenFixerWindow.loadURL(`data:text/html,
        <html>
          <head>
            <title>ProGenFixer - Connection Error</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                     text-align: center; padding: 50px; background: #f5f5f5; color: #333; }
              h1 { color: #e74c3c; }
              .error-code { color: #7f8c8d; font-size: 14px; }
              button { padding: 10px 20px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; }
            </style>
          </head>
          <body>
            <h1>🔧 ProGenFixer Unavailable</h1>
            <p>Could not connect to ProGenFixer at:</p>
            <p><strong>${validatedURL}</strong></p>
            <p class="error-code">Error ${errorCode}: ${errorDescription}</p>
            <div style="margin-top: 30px;">
              <button onclick="window.location.reload()" style="background: #3498db; color: white;">
                🔄 Retry
              </button>
              <button onclick="window.close()" style="background: #95a5a6; color: white;">
                ❌ Close
              </button>
            </div>
            <div style="margin-top: 20px; font-size: 14px; color: #7f8c8d;">
              <p>Please check if the ProGenFixer service is accessible.</p>
              <p>You can configure the URL in General Settings → Features → External Tools.</p>
            </div>
          </body>
        </html>
      `);
    });

    // Add additional event listeners for debugging
    progenFixerWindow.webContents.on('did-start-loading', () => {
      console.log('🔄 ProGenFixer window started loading...');
    });

    progenFixerWindow.webContents.on('did-finish-load', () => {
      console.log('✅ ProGenFixer window finished loading');
    });

    progenFixerWindow.webContents.on('dom-ready', () => {
      console.log('📄 ProGenFixer window DOM ready');
    });

    console.log('🎯 ProGenFixer window creation process completed');
  } catch (error) {
    console.error('❌ Error creating ProGenFixer window:', error);
    console.error('❌ Error stack:', error.stack);

    // Show error dialog
    dialog.showErrorBox(
      'Error Opening ProGenFixer',
      `Failed to create ProGenFixer window: ${error.message}\n\nPlease check if the service is accessible at https://progenfixer.biodesign.ac.cn`
    );
  }
}

async function createDeepGeneResearchWindow(params = {}) {
  try {
    console.log('🚀 Starting Deep Gene Research window creation...');
    // Get the URL from General Settings
    let deepGeneResearchUrl = 'http://43.196.74.134:3000'; // Default fallback

    try {
      // Get the main window to access GeneralSettingsManager directly
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && mainWindow.webContents) {
        console.log('📋 Getting settings from main window...');
        const settings = await mainWindow.webContents.executeJavaScript(`
          if (window.genomeBrowser && window.genomeBrowser.generalSettingsManager) {
            window.genomeBrowser.generalSettingsManager.getSettings();
          } else {
            Promise.resolve({});
          }
        `);

        console.log('📋 Settings retrieved:', settings);

        if (settings && settings.deepGeneResearchUrl) {
          deepGeneResearchUrl = settings.deepGeneResearchUrl;
          console.log('✅ Using Deep Gene Research URL from settings:', deepGeneResearchUrl);
        } else {
          console.log('⚠️ No Deep Gene Research URL found in settings, using default:', deepGeneResearchUrl);
          // Show notification to user about using default URL
          showSettingsWarning(
            'Deep Gene Research URL not configured',
            'Using default URL (http://43.196.74.134:3000). You can configure the URL in General Settings → Features → External Tools.'
          );
        }
      } else {
        console.log('⚠️ Main window not available, using default URL:', deepGeneResearchUrl);
        showSettingsWarning(
          'Main window not available',
          'Using default URL (http://43.196.74.134:3000). Please ensure the main window is open.'
        );
      }
    } catch (error) {
      console.warn('❌ Failed to get Deep Gene Research URL from settings, using default:', error.message);
      // Show error notification to user
      showSettingsError(
        'Failed to load Deep Gene Research settings',
        `Using default URL (http://43.196.74.134:3000) due to error: ${error.message}. Please check your settings configuration.`
      );
    }

    // Add parameters to URL if provided
    if (params.gene || params.organism) {
      const urlParams = new URLSearchParams();
      if (params.gene) {
        urlParams.append('gene', params.gene);
      }
      if (params.organism) {
        urlParams.append('organism', params.organism);
      }
      deepGeneResearchUrl += '?' + urlParams.toString();
    }

    console.log('🔧 Creating Deep Gene Research window with URL:', deepGeneResearchUrl);

    const deepGeneResearchWindow = new BrowserWindow({
      width: 1600,
      height: 1000,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: createSecureWebPreferences({
        experimentalFeatures: true,
        enableBlinkFeatures: 'ClipboardRead,ClipboardWrite',
      }),
      title: 'Deep Gene Research - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      autoHideMenuBar: false,
    });

    console.log('✅ Deep Gene Research BrowserWindow created successfully');

    // Load the Deep Gene Research URL
    console.log('🌐 Loading Deep Gene Research URL...');
    await deepGeneResearchWindow.loadURL(deepGeneResearchUrl);
    console.log('✅ Deep Gene Research URL loaded successfully');

    // Show the window when ready
    deepGeneResearchWindow.once('ready-to-show', () => {
      console.log('🎉 Deep Gene Research window ready to show');
      deepGeneResearchWindow.show();
      deepGeneResearchWindow.focus();
      // Set specialized menu for Deep Gene Research window
      createDeepGeneResearchMenu(deepGeneResearchWindow);
      console.log('✅ Deep Gene Research window opened successfully');

      // Enable keyboard shortcuts for copy/paste
      deepGeneResearchWindow.webContents.executeJavaScript(`
        // Enable clipboard access
        if (navigator.clipboard) {
          console.log('Clipboard API available');
        }
        
        // Add keyboard event listeners for copy/paste
        document.addEventListener('keydown', function(e) {
          // Ctrl+C or Cmd+C
          if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            console.log('Copy shortcut detected');
            document.execCommand('copy');
          }
          // Ctrl+V or Cmd+V
          if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            console.log('Paste shortcut detected');
            document.execCommand('paste');
          }
          // Ctrl+A or Cmd+A
          if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            console.log('Select All shortcut detected');
            document.execCommand('selectAll');
          }
          // Ctrl+X or Cmd+X
          if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
            console.log('Cut shortcut detected');
            document.execCommand('cut');
          }
        });
        
        console.log('Deep Gene Research window keyboard shortcuts enabled');
      `);
    });

    // Also try to show immediately after load
    console.log('🚀 Attempting immediate show...');
    deepGeneResearchWindow.show();
    deepGeneResearchWindow.focus();

    // Fallback: Show window after a timeout if ready-to-show doesn't fire
    setTimeout(() => {
      if (!deepGeneResearchWindow.isDestroyed() && !deepGeneResearchWindow.isVisible()) {
        console.log('⚠️ Deep Gene Research window ready-to-show timeout, forcing show');
        deepGeneResearchWindow.show();
        deepGeneResearchWindow.focus();
        // Also set menu if it hasn't been set yet
        createDeepGeneResearchMenu(deepGeneResearchWindow);
      }
    }, 3000);

    // Handle window closed
    deepGeneResearchWindow.on('closed', () => {
      // Clean up menu template
      toolMenuTemplates.delete(deepGeneResearchWindow.id);

      // If this was the current active window, restore main window menu
      if (currentActiveWindow === deepGeneResearchWindow) {
        currentActiveWindow = null;
        createMenu(); // Restore main window menu
      }
      console.log('Deep Gene Research window closed');
    });

    // Handle navigation errors
    deepGeneResearchWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('❌ Deep Gene Research window failed to load:', errorDescription);
      console.error('❌ Error code:', errorCode);
      console.error('❌ Validated URL:', validatedURL);

      // Show error page
      deepGeneResearchWindow.loadURL(`data:text/html,
        <html>
          <head><title>Deep Gene Research - Connection Error</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #e74c3c;">🔗 Connection Error</h1>
            <p>Unable to connect to Deep Gene Research service.</p>
            <p><strong>URL:</strong> ${deepGeneResearchUrl}</p>
            <p><strong>Error:</strong> ${errorDescription}</p>
            <div style="margin-top: 30px;">
              <button onclick="window.location.reload()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">
                🔄 Retry
              </button>
              <button onclick="window.close()" style="padding: 10px 20px; background: #95a5a6; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">
                ❌ Close
              </button>
            </div>
            <div style="margin-top: 20px; font-size: 14px; color: #7f8c8d;">
              <p>Please check if the Deep Gene Research service is running at the configured URL.</p>
              <p>You can configure the URL in General Settings → Features → External Tools.</p>
            </div>
          </body>
        </html>
      `);
    });

    // Add additional event listeners for debugging
    deepGeneResearchWindow.webContents.on('did-start-loading', () => {
      console.log('🔄 Deep Gene Research window started loading...');
    });

    deepGeneResearchWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Deep Gene Research window finished loading');
    });

    deepGeneResearchWindow.webContents.on('dom-ready', () => {
      console.log('📄 Deep Gene Research window DOM ready');
    });

    // Track window visibility and focus
    deepGeneResearchWindow.on('show', () => {
      console.log('👁️ Deep Gene Research window shown');
    });

    deepGeneResearchWindow.on('hide', () => {
      console.log('🙈 Deep Gene Research window hidden');
    });

    deepGeneResearchWindow.on('focus', () => {
      console.log('🎯 Deep Gene Research window focused');
    });

    deepGeneResearchWindow.on('blur', () => {
      console.log('😴 Deep Gene Research window blurred');
    });

    // Check window state after creation
    setTimeout(() => {
      console.log('🔍 Deep Gene Research window state check:');
      console.log(`  - Destroyed: ${deepGeneResearchWindow.isDestroyed()}`);
      console.log(`  - Visible: ${deepGeneResearchWindow.isVisible()}`);
      console.log(`  - Focused: ${deepGeneResearchWindow.isFocused()}`);
      console.log(`  - Minimized: ${deepGeneResearchWindow.isMinimized()}`);
    }, 4000);

    console.log('🎯 Deep Gene Research window creation process completed');
  } catch (error) {
    console.error('Error creating Deep Gene Research window:', error);

    // Show error dialog
    dialog.showErrorBox(
      'Error Opening Deep Gene Research',
      `Failed to create Deep Gene Research window: ${error.message}\n\nPlease check if the service is running at http://localhost:3000/`
    );
  }
}

// Create CHOPCHOP CRISPR Toolbox window

async function createChopchopWindow() {
  try {
    console.log('🚀 Starting CHOPCHOP window creation...');
    let chopchopUrl = 'https://chopchop.cbu.uib.no/'; // Default fallback

    try {
      // Get the main window to access GeneralSettingsManager directly
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && mainWindow.webContents) {
        console.log('📋 Getting settings from main window...');
        const settings = await mainWindow.webContents.executeJavaScript(`
          if (window.genomeBrowser && window.genomeBrowser.generalSettingsManager) {
            window.genomeBrowser.generalSettingsManager.getSettings();
          } else {
            Promise.resolve({});
          }
        `);

        console.log('📋 Settings retrieved:', settings);

        if (settings && settings.chopchopUrl) {
          chopchopUrl = settings.chopchopUrl;
          console.log('✅ Using CHOPCHOP URL from settings:', chopchopUrl);
        } else {
          console.log('⚠️ No CHOPCHOP URL found in settings, using default:', chopchopUrl);
          showSettingsWarning(
            'CHOPCHOP URL not configured',
            'Using default URL (https://chopchop.cbu.uib.no/). You can configure the URL in General Settings → Features → External Tools.'
          );
        }
      } else {
        console.log('⚠️ Main window not available, using default URL:', chopchopUrl);
        showSettingsWarning(
          'Main window not available',
          'Using default URL (https://chopchop.cbu.uib.no/). Please ensure the main window is open.'
        );
      }
    } catch (error) {
      console.warn('❌ Failed to get CHOPCHOP URL from settings, using default:', error.message);
      showSettingsError(
        'Failed to load CHOPCHOP settings',
        `Using default URL (https://chopchop.cbu.uib.no/) due to error: ${error.message}. Please check your settings configuration.`
      );
    }

    console.log('🔧 Creating CHOPCHOP window with URL:', chopchopUrl);

    const chopchopWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: createSecureWebPreferences({
        experimentalFeatures: true,
        enableBlinkFeatures: 'ClipboardRead,ClipboardWrite',
      }),
      title: 'CHOPCHOP CRISPR Toolbox - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
    });

    console.log('✅ CHOPCHOP BrowserWindow created successfully');

    // Load the CHOPCHOP URL
    console.log('🌐 Loading CHOPCHOP URL...');
    await chopchopWindow.loadURL(chopchopUrl);
    console.log('✅ CHOPCHOP URL loaded successfully');

    // Show the window when ready
    chopchopWindow.once('ready-to-show', () => {
      console.log('🎉 CHOPCHOP window ready to show');
      chopchopWindow.show();
      chopchopWindow.focus();
      console.log('✅ CHOPCHOP window opened successfully');
    });

    // Also try to show immediately after load
    console.log('🚀 Attempting immediate show...');
    chopchopWindow.show();
    chopchopWindow.focus();

    // Fallback: Show window after a timeout if ready-to-show doesn't fire
    setTimeout(() => {
      if (!chopchopWindow.isDestroyed() && !chopchopWindow.isVisible()) {
        console.log('⚠️ CHOPCHOP window ready-to-show timeout, forcing show');
        chopchopWindow.show();
        chopchopWindow.focus();
      }
    }, 3000);

    // Handle window closed
    chopchopWindow.on('closed', () => {
      console.log('🔒 CHOPCHOP window closed');
    });

    // Handle navigation errors
    chopchopWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('❌ CHOPCHOP window failed to load:', errorDescription);
      console.error('❌ Error code:', errorCode);
      console.error('❌ Validated URL:', validatedURL);
      showSettingsError(
        'Failed to load CHOPCHOP CRISPR Toolbox',
        `Could not load ${validatedURL}. Please check the URL in General Settings → Features → External Tools.`
      );
    });

    // Add additional event listeners for debugging
    chopchopWindow.webContents.on('did-start-loading', () => {
      console.log('🔄 CHOPCHOP window started loading...');
    });

    chopchopWindow.webContents.on('did-finish-load', () => {
      console.log('✅ CHOPCHOP window finished loading');
    });

    chopchopWindow.webContents.on('dom-ready', () => {
      console.log('📄 CHOPCHOP window DOM ready');
    });

    // Track window visibility and focus
    chopchopWindow.on('show', () => {
      console.log('👁️ CHOPCHOP window shown');
    });

    chopchopWindow.on('hide', () => {
      console.log('🙈 CHOPCHOP window hidden');
    });

    chopchopWindow.on('focus', () => {
      console.log('🎯 CHOPCHOP window focused');
    });

    chopchopWindow.on('blur', () => {
      console.log('😴 CHOPCHOP window blurred');
    });

    // Check window state after creation
    setTimeout(() => {
      console.log('🔍 CHOPCHOP window state check:');
      console.log(`  - Destroyed: ${chopchopWindow.isDestroyed()}`);
      console.log(`  - Visible: ${chopchopWindow.isVisible()}`);
      console.log(`  - Focused: ${chopchopWindow.isFocused()}`);
      console.log(`  - Minimized: ${chopchopWindow.isMinimized()}`);
      console.log(`  - Maximized: ${chopchopWindow.isMaximized()}`);
    }, 1000);

    console.log('🎯 CHOPCHOP window creation process completed');
  } catch (error) {
    console.error('❌ Error creating CHOPCHOP window:', error);
    console.error('❌ Error stack:', error.stack);
    showSettingsError('Error opening CHOPCHOP CRISPR Toolbox', `Failed to open CHOPCHOP window: ${error.message}`);
  }
}

// Create custom external tool window

async function createCustomExternalToolWindow(toolData) {
  try {
    console.log('🔧 [CustomTool] Creating custom external tool window:', toolData.name);

    // Validate tool data
    if (!toolData || !toolData.name || !toolData.url) {
      console.error('❌ [CustomTool] Invalid tool data:', toolData);
      showSettingsError('Invalid Tool Configuration', 'Tool data is missing required properties (name or url)');
      return;
    }

    const customToolWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: createSecureWebPreferences({
        experimentalFeatures: true,
        enableBlinkFeatures: 'ClipboardRead,ClipboardWrite',
      }),
      title: `${toolData.name} - CodeXomics`,
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
    });

    // Load the tool URL
    await customToolWindow.loadURL(toolData.url);

    // Show the window when ready
    customToolWindow.once('ready-to-show', () => {
      customToolWindow.show();
      customToolWindow.focus();
      console.log(`✅ Custom external tool opened: ${toolData.name}`);
    });

    // Handle window closed
    customToolWindow.on('closed', () => {
      console.log(`🔒 Custom external tool window closed: ${toolData.name}`);
    });

    // Handle navigation errors
    customToolWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error(`❌ Custom external tool failed to load: ${errorDescription}`);
      showSettingsError(
        `Failed to load ${toolData.name}`,
        `Could not load ${validatedURL}. Please check the URL configuration.`
      );
    });

    console.log(`✅ Custom external tool window created: ${toolData.name}`);
  } catch (error) {
    console.error(`❌ Error creating custom external tool window for ${toolData.name}:`, error);
    showSettingsError(`Error opening ${toolData.name}`, `Failed to open ${toolData.name}: ${error.message}`);
  }
}

// ========== IPC EVENT HANDLERS FOR TOOL WINDOWS ==========

// IPC handlers for opening tool windows (for testing and external access)
ipcMain.on('open-interpro-window', () => {
  console.log('IPC: Opening InterPro window...');
  createInterProWindow();
});

ipcMain.on('open-kegg-window', () => {
  console.log('IPC: Opening KEGG window...');
  createKEGGWindow();
});

ipcMain.on('open-go-window', () => {
  console.log('IPC: Opening GO window...');
  createGOWindow();
});

ipcMain.on('open-uniprot-window', () => {
  console.log('IPC: Opening UniProt window...');
  createUniProtWindow();
});

ipcMain.on('open-ncbi-window', () => {
  console.log('IPC: Opening NCBI window...');
  createNCBIWindow();
});

ipcMain.on('open-string-window', () => {
  console.log('IPC: Opening STRING window...');
  createSTRINGWindow();
});

ipcMain.on('open-david-window', () => {
  console.log('IPC: Opening DAVID window...');
  createDAVIDWindow();
});

ipcMain.on('open-reactome-window', () => {
  console.log('IPC: Opening Reactome window...');
  createReactomeWindow();
});

ipcMain.on('open-pdb-window', () => {
  console.log('IPC: Opening PDB window...');
  createPDBWindow();
});

ipcMain.on('open-blast-downloader-window', () => {
  console.log('IPC: Opening BLAST+ Downloader window...');
  createBlastDownloaderWindow();
});

ipcMain.on('open-gene-annotation-refine', (event, data) => {
  console.log('IPC: Opening Gene Annotation Refine window...', data);
  createGeneAnnotationRefineWindow();
});

ipcMain.on('open-deep-gene-research-window', async (event, params = {}) => {
  console.log('IPC: Opening Deep Gene Research window with params:', params);
  await createDeepGeneResearchWindow(params);
});

// ========== CHATBOX INTEGRATION IPC HANDLERS ==========

// Store pending data for analyzer windows
const analyzerPendingData = new Map();

// Handle analyzer window ready notification
ipcMain.on('window-ready', (event, toolName) => {
  console.log(`[ChatBox Integration] ${toolName} window ready`);

  // Check if there's pending data for this tool
  if (analyzerPendingData.has(toolName)) {
    const data = analyzerPendingData.get(toolName);
    event.sender.send('load-analysis-data', data);
    analyzerPendingData.delete(toolName);
    console.log(`[ChatBox Integration] Sent pending data to ${toolName}`);
  }
});

// Handle request for pending data
ipcMain.on('request-pending-data', (event, toolName) => {
  console.log(`[ChatBox Integration] ${toolName} requesting pending data`);

  if (analyzerPendingData.has(toolName)) {
    const data = analyzerPendingData.get(toolName);
    event.sender.send('load-analysis-data', data);
    analyzerPendingData.delete(toolName);
  }
});

// Handle analysis request from analyzer tools to ChatBox
ipcMain.on('analyze-in-chatbox', (event, request) => {
  console.log('[ChatBox Integration] Received analysis request:', request);

  const mainWindow = getCurrentMainWindow();
  if (mainWindow && mainWindow.webContents) {
    // Send the query to ChatBox with metadata
    mainWindow.webContents.send('chatbox-analyze-request', {
      query: request.query,
      toolName: request.toolName,
      data: request.data,
      timestamp: request.timestamp,
    });

    console.log(`[ChatBox Integration] Forwarded request to ChatBox from ${request.toolName}`);
  } else {
    console.error('[ChatBox Integration] Main window not available');
  }
});

// Handle request for LLM interpretation
ipcMain.on('request-llm-interpretation', (event, request) => {
  console.log('[ChatBox Integration] LLM interpretation requested:', request);

  const mainWindow = getCurrentMainWindow();
  if (mainWindow && mainWindow.webContents) {
    // Format the interpretation request
    const interpretQuery =
      `Please provide a detailed biological interpretation of the following ${request.toolName} results:\n\n` +
      `Analysis Type: ${request.context.analysisType}\n` +
      `Number of Results: ${request.context.resultCount}\n\n` +
      `Please explain the biological significance and functional implications of these findings.`;

    mainWindow.webContents.send('chatbox-interpret-request', {
      query: interpretQuery,
      data: request.data,
      context: request.context,
      toolName: request.toolName,
      responseTarget: event.sender,
    });

    console.log(`[ChatBox Integration] Sent interpretation request to ChatBox`);
  }
});

// Handle LLM interpretation response back to analyzer tool
ipcMain.on('llm-interpretation-response', (event, response) => {
  console.log('[ChatBox Integration] LLM interpretation response received');

  if (response.targetWindow && response.targetWindow.send) {
    response.targetWindow.send('llm-interpretation-result', {
      interpretation: response.interpretation,
      timestamp: new Date().toISOString(),
    });
  }
});

// Handle request to send analysis data from ChatBox to analyzer tool
ipcMain.on('send-to-analyzer', (event, request) => {
  console.log('[ChatBox Integration] Sending data to analyzer:', request.toolName);

  // Store the data for when the window opens
  analyzerPendingData.set(request.toolName, {
    results: request.data,
    source: 'chatbox',
    originalQuery: request.originalQuery,
    timestamp: new Date().toISOString(),
  });

  // Open the appropriate analyzer window
  switch (request.toolName.toLowerCase()) {
    case 'kegg pathway analysis':
    case 'kegg-analyzer':
      createKEGGWindow();
      break;
    case 'gene ontology analysis':
    case 'go-analyzer':
      createGOWindow();
      break;
    case 'interpro domain analysis':
    case 'interpro-analyzer':
      createInterProWindow();
      break;
    default:
      console.warn(`[ChatBox Integration] Unknown analyzer tool: ${request.toolName}`);
  }
});

// IPC handler for Deep Gene Research window menu actions
ipcMain.on('deep-gene-research-menu-action', (event, action) => {
  console.log('Deep Gene Research menu action:', action);

  const webContents = event.sender;

  switch (action) {
    case 'copy':
      webContents.copy();
      break;
    case 'paste':
      webContents.paste();
      break;
    case 'cut':
      webContents.cut();
      break;
    case 'select-all':
      webContents.selectAll();
      break;
    case 'find':
      webContents.findInPage('');
      break;
    case 'find-next':
      webContents.findInPage('', { forward: true });
      break;
    case 'reload':
      webContents.reload();
      break;
    case 'force-reload':
      webContents.reloadIgnoringCache();
      break;
    case 'toggle-dev-tools':
      webContents.toggleDevTools();
      break;
    case 'reset-zoom':
      webContents.setZoomLevel(0);
      break;
    case 'zoom-in':
      webContents.setZoomLevel(webContents.getZoomLevel() + 0.5);
      break;
    case 'zoom-out':
      webContents.setZoomLevel(webContents.getZoomLevel() - 0.5);
      break;
    case 'toggle-fullscreen':
      {
      const window = BrowserWindow.fromWebContents(webContents);
      if (window) {
        window.setFullScreen(!window.isFullScreen());
      }
      break;
      }
    default:
      console.log('Unknown Deep Gene Research menu action:', action);
  }
});

// Helper functions for user notifications

function createProjectManagerWindow() {
  try {
    // Check if Project Manager window already exists in this process
    const existingPMWindow = BrowserWindow.getAllWindows().find(
      win => win.getTitle().includes('Project Manager') && !win.isDestroyed()
    );

    if (existingPMWindow) {
      console.log('ℹ️ Project Manager window already exists in this process, focusing existing window...');
      existingPMWindow.focus();
      return existingPMWindow;
    }

    const projectManagerWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minHeight: 600,
      webPreferences: createSecureWebPreferences(),
      title: 'Project Manager - CodeXomics',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      resizable: true,
      minimizable: true,
      maximizable: true,
      show: false,
    });

    // ... existing code ...

    // Create Project Manager specific menu
    const projectManagerMenu = createProjectManagerMenu(projectManagerWindow);

    // Set the menu immediately for this window
    projectManagerWindow.setMenu(projectManagerMenu);

    // Override application menu when this window is focused
    projectManagerWindow.on('focus', () => {
      console.log('Project Manager window focused - setting Project Manager menu');
      Menu.setApplicationMenu(projectManagerMenu);
    });

    // Handle window focus lost - revert to main menu if main window exists
    projectManagerWindow.on('blur', () => {
      // Find any main window (including newly created ones)
      const mainWindows = BrowserWindow.getAllWindows().filter(
        win => win.getTitle().includes('CodeXomics') && !win.getTitle().includes('Project Manager')
      );

      if (mainWindows.length > 0) {
        console.log('Project Manager window lost focus - checking for focused main window');
        // Wait a bit longer to allow window focus to settle
        setTimeout(() => {
          const focusedMainWindow = mainWindows.find(win => win.isFocused());
          if (focusedMainWindow) {
            console.log('Restoring main menu for focused main window');
            currentActiveWindow = focusedMainWindow;
            createMenu(); // Restore main window menu
          }
        }, 200); // Increased delay for better stability
      }
    });

    // Load the project manager HTML
    const projectManagerPath = path.join(__dirname, '..', 'project-manager.html');

    if (fs.existsSync(projectManagerPath)) {
      projectManagerWindow.loadFile(projectManagerPath);
    } else {
      console.error('Project manager file not found:', projectManagerPath);
      return;
    }

    // Show window when ready and ensure menu is set
    projectManagerWindow.once('ready-to-show', () => {
      projectManagerWindow.show();
      // Force menu update after window is shown
      setTimeout(() => {
        console.log('Setting Project Manager menu after window ready');
        Menu.setApplicationMenu(projectManagerMenu);
      }, 500);

      // Request current theme from main window and forward to PM
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('request-theme-for-pm');
        }
      }, 300);
    });

    // Handle window closed - revert to main menu
    projectManagerWindow.on('closed', () => {
      console.log('Project Manager window closed - reverting to main menu');
      const mainWindow = BrowserWindow.getAllWindows().find(
        win => win.getTitle().includes('CodeXomics') && !win.getTitle().includes('Project Manager')
      );
      if (mainWindow && !mainWindow.isDestroyed()) {
        createMenu(); // Restore main window menu
      }
    });

    console.log('Project Manager window created successfully with independent menu');

    return projectManagerWindow;
  } catch (error) {
    console.error('Failed to open Project Manager:', error);
  }
}

// Create Project Manager specific menu system

function getDisplayWorkArea() {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  return primaryDisplay.workAreaSize;
}

/**
 * 获取主窗口和Project Manager窗口
 */

function getMainWindows() {
  const allWindows = BrowserWindow.getAllWindows();

  const mainWindow = allWindows.find(
    win => win.getTitle().includes('CodeXomics') && !win.getTitle().includes('Project Manager') && !win.isDestroyed()
  );

  const projectManagerWindow = allWindows.find(win => win.getTitle().includes('Project Manager') && !win.isDestroyed());

  return { mainWindow, projectManagerWindow };
}

/**
 * 最优布局：主窗口右侧75%，Project Manager左侧25%
 */

function arrangeWindowsOptimal() {
  const { mainWindow, projectManagerWindow } = getMainWindows();

  if (!mainWindow) {
    console.log('Main window not found');
    return;
  }

  const workArea = getDisplayWorkArea();
  const totalWidth = workArea.width;
  const totalHeight = workArea.height;

  // 计算窗口尺寸
  const pmWidth = Math.floor(totalWidth * 0.25); // Project Manager 25%
  const mainWidth = totalWidth - pmWidth; // Main Window 75%

  // 设置主窗口位置和大小
  mainWindow.setBounds({
    x: pmWidth,
    y: 0,
    width: mainWidth,
    height: totalHeight,
  });

  // 如果Project Manager存在，设置其位置和大小
  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: 0,
      y: 0,
      width: pmWidth,
      height: totalHeight,
    });
  } else {
    // 如果Project Manager不存在，创建它
    const newPMWindow = createProjectManagerWindow();
    if (newPMWindow) {
      newPMWindow.once('ready-to-show', () => {
        newPMWindow.setBounds({
          x: 0,
          y: 0,
          width: pmWidth,
          height: totalHeight,
        });
      });
    }
  }

  // 聚焦到主窗口
  mainWindow.focus();

  console.log('🎯 Optimal layout applied: Main 75% + Project Manager 25%');
}

/**
 * 并排布局：50% + 50%
 */

function arrangeWindowsSideBySide() {
  const { mainWindow, projectManagerWindow } = getMainWindows();

  if (!mainWindow) return;

  const workArea = getDisplayWorkArea();
  const halfWidth = Math.floor(workArea.width * 0.5);

  // 主窗口右侧50%
  mainWindow.setBounds({
    x: halfWidth,
    y: 0,
    width: halfWidth,
    height: workArea.height,
  });

  // Project Manager左侧50%
  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: 0,
      y: 0,
      width: halfWidth,
      height: workArea.height,
    });
  } else {
    const newPMWindow = createProjectManagerWindow();
    if (newPMWindow) {
      newPMWindow.once('ready-to-show', () => {
        newPMWindow.setBounds({
          x: 0,
          y: 0,
          width: halfWidth,
          height: workArea.height,
        });
      });
    }
  }

  mainWindow.focus();
  console.log('📐 Side by side layout applied: 50% + 50%');
}

/**
 * 主窗口聚焦模式：主窗口占85%，Project Manager占15%
 */

function arrangeMainWindowFocus() {
  const { mainWindow, projectManagerWindow } = getMainWindows();

  if (!mainWindow) return;

  const workArea = getDisplayWorkArea();
  const pmWidth = Math.floor(workArea.width * 0.15);
  const mainWidth = workArea.width - pmWidth;

  mainWindow.setBounds({
    x: pmWidth,
    y: 0,
    width: mainWidth,
    height: workArea.height,
  });

  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: 0,
      y: 0,
      width: pmWidth,
      height: workArea.height,
    });
  }

  mainWindow.focus();
  console.log('🎯 Main window focus layout applied: Main 85% + PM 15%');
}

/**
 * Project Manager聚焦模式：Project Manager占60%，主窗口占40%
 */

function arrangeProjectManagerFocus() {
  const { mainWindow, projectManagerWindow } = getMainWindows();

  if (!mainWindow) return;

  const workArea = getDisplayWorkArea();
  const pmWidth = Math.floor(workArea.width * 0.6);
  const mainWidth = workArea.width - pmWidth;

  mainWindow.setBounds({
    x: pmWidth,
    y: 0,
    width: mainWidth,
    height: workArea.height,
  });

  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: 0,
      y: 0,
      width: pmWidth,
      height: workArea.height,
    });
    projectManagerWindow.focus();
  } else {
    const newPMWindow = createProjectManagerWindow();
    if (newPMWindow) {
      newPMWindow.once('ready-to-show', () => {
        newPMWindow.setBounds({
          x: 0,
          y: 0,
          width: pmWidth,
          height: workArea.height,
        });
        newPMWindow.focus();
      });
    }
  }

  console.log('📊 Project Manager focus layout applied: PM 60% + Main 40%');
}

/**
 * 垂直堆叠布局
 */

function arrangeWindowsVertical() {
  const { mainWindow, projectManagerWindow } = getMainWindows();

  if (!mainWindow) return;

  const workArea = getDisplayWorkArea();
  const halfHeight = Math.floor(workArea.height * 0.5);

  // 主窗口上半部分
  mainWindow.setBounds({
    x: 0,
    y: 0,
    width: workArea.width,
    height: halfHeight,
  });

  // Project Manager下半部分
  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: 0,
      y: halfHeight,
      width: workArea.width,
      height: halfHeight,
    });
  } else {
    const newPMWindow = createProjectManagerWindow();
    if (newPMWindow) {
      newPMWindow.once('ready-to-show', () => {
        newPMWindow.setBounds({
          x: 0,
          y: halfHeight,
          width: workArea.width,
          height: halfHeight,
        });
      });
    }
  }

  mainWindow.focus();
  console.log('📚 Vertical stack layout applied');
}

/**
 * 层叠布局
 */

function arrangeWindowsCascade() {
  const { mainWindow, projectManagerWindow } = getMainWindows();

  if (!mainWindow) return;

  const workArea = getDisplayWorkArea();
  const windowWidth = Math.floor(workArea.width * 0.8);
  const windowHeight = Math.floor(workArea.height * 0.8);
  const offset = 50;

  // 主窗口
  mainWindow.setBounds({
    x: 0,
    y: 0,
    width: windowWidth,
    height: windowHeight,
  });

  // Project Manager偏移位置
  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: offset,
      y: offset,
      width: windowWidth,
      height: windowHeight,
    });
  }

  mainWindow.focus();
  console.log('🔄 Cascade layout applied');
}

/**
 * 重置到默认位置
 */

function resetWindowPositions() {
  const { mainWindow, projectManagerWindow } = getMainWindows();

  if (mainWindow) {
    mainWindow.setBounds({
      x: 100,
      y: 100,
      width: 1200,
      height: 800,
    });
    mainWindow.center();
  }

  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: 150,
      y: 150,
      width: 1200,
      height: 800,
    });
    projectManagerWindow.center();
  }

  console.log('🔄 Window positions reset to default');
}

// ========== END WINDOW LAYOUT FUNCTIONS ==========

/**
 * Open test file in a new window
 */

function openTestFile(filename) {
  try {
    const currentWindow = getCurrentMainWindow();
    if (!currentWindow) {
      console.error('No main window available to open test file');
      return;
    }

    // Get the project root directory
    const projectRoot = path.resolve(__dirname, '..');
    const testFilePath = path.join(projectRoot, filename);

    // Check if file exists
    if (!fs.existsSync(testFilePath)) {
      console.error(`Test file not found: ${testFilePath}`);
      dialog.showErrorBox('File Not Found', `Test file "${filename}" not found in the project directory.`);
      return;
    }

    // Create a new window for the test file
    const testWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: createSecureWebPreferences(),
      title: `Test: ${filename}`,
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    });

    // Load the test file
    const fileUrl = `file://${testFilePath}`;
    testWindow.loadURL(fileUrl);

    // Handle window close
    testWindow.on('closed', () => {
      console.log(`Test window closed: ${filename}`);
    });

    // Show window when ready
    testWindow.once('ready-to-show', () => {
      testWindow.show();
      testWindow.focus();
      console.log(`✅ Test file opened: ${filename}`);
    });

    // Handle errors
    testWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`Failed to load test file ${filename}:`, errorDescription);
      dialog.showErrorBox('Load Error', `Failed to load test file "${filename}": ${errorDescription}`);
    });
  } catch (error) {
    console.error('Error opening test file:', error);
    dialog.showErrorBox('Error', `Failed to open test file "${filename}": ${error.message}`);
  }
}

function getCurrentActiveWindow() {
  return currentActiveWindow;
}

function setCurrentActiveWindow(win) {
  currentActiveWindow = win;
}

module.exports = {
  createWindow,
  getCurrentMainWindow,
  getCurrentActiveWindow,
  setCurrentActiveWindow,
  sendToCurrentMainWindow,
  getCustomExternalToolsMenuItems,
  createCircosWindow,
  createKEGGWindow,
  createGOWindow,
  createUniProtWindow,
  createInterProWindow,
  createNCBIWindow,
  createSTRINGWindow,
  createDAVIDWindow,
  createReactomeWindow,
  createPDBWindow,
  createGeneAnnotationRefineWindow,
  createBlastDownloaderWindow,
  createBlastConfigWindow,
  createProGenFixerWindow,
  createDeepGeneResearchWindow,
  createChopchopWindow,
  createCustomExternalToolWindow,
  createProjectManagerWindow,
  getDisplayWorkArea,
  getMainWindows,
  arrangeWindowsOptimal,
  arrangeWindowsSideBySide,
  arrangeMainWindowFocus,
  arrangeProjectManagerFocus,
  arrangeWindowsVertical,
  arrangeWindowsCascade,
  resetWindowPositions,
  openTestFile,
  setWindowMgmtDependencies,
};
