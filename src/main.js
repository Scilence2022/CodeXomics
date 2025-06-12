const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const MCPGenomeBrowserServer = require('./mcp-server');

let mainWindow;
let mcpServer = null;
let mcpServerStatus = 'stopped'; // 'stopped', 'starting', 'running', 'stopping'

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      cache: false
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Clear cache aggressively to ensure fresh file loading
  mainWindow.webContents.session.clearCache();
  mainWindow.webContents.session.clearStorageData();
  
  // Force reload after cache clear
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.reload();
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools to debug UI issues (temporarily enabled for debugging)
  mainWindow.webContents.openDevTools();

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open File',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'All Genome Files', extensions: ['fasta', 'fa', 'gb', 'gbk', 'genbank', 'gff', 'gtf', 'bed', 'vcf', 'bam', 'sam'] },
                { name: 'FASTA Files', extensions: ['fasta', 'fa'] },
                { name: 'GenBank Files', extensions: ['gb', 'gbk', 'genbank'] },
                { name: 'Annotation Files', extensions: ['gff', 'gtf', 'bed'] },
                { name: 'Variant Files', extensions: ['vcf'] },
                { name: 'Alignment Files', extensions: ['bam', 'sam'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('file-opened', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Show File Information',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow.webContents.send('show-panel', 'fileInfoSection');
          }
        },
        {
          label: 'Show Navigation',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow.webContents.send('show-panel', 'navigationSection');
          }
        },
        {
          label: 'Show Statistics',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow.webContents.send('show-panel', 'statisticsSection');
          }
        },
        {
          label: 'Show All Panels',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            mainWindow.webContents.send('show-all-panels');
          }
        },
        { type: 'separator' },
        {
          label: 'Show Tracks Panel',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            mainWindow.webContents.send('show-panel', 'tracksSection');
          }
        },
        {
          label: 'Show Features Panel',
          accelerator: 'CmdOrCtrl+5',
          click: () => {
            mainWindow.webContents.send('show-panel', 'featuresSection');
          }
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Search Sequence',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            mainWindow.webContents.send('show-search');
          }
        },
        {
          label: 'Go to Position',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            mainWindow.webContents.send('show-goto');
          }
        }
      ]
    },
    {
      label: 'Plugins',
      submenu: [
        {
          label: 'Plugin Management',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            mainWindow.webContents.send('show-plugin-management');
          }
        },
        { type: 'separator' },
        {
          label: 'Smart Execution Demo',
          click: () => {
            mainWindow.webContents.send('show-smart-execution-demo');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Genome AI Studio',
              message: 'Genome AI Studio v1.0 beta',
              detail: 'A modern AI-powered genome analysis studio built with Electron'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event listeners
app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up MCP server when app is quitting
app.on('before-quit', () => {
  if (mcpServer) {
    console.log('Shutting down MCP Server...');
    mcpServer.stop();
    mcpServer = null;
  }
});

// IPC handlers
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-file-stream', async (event, filePath, chunkSize = 1024 * 1024) => {
  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    let totalRead = 0;
    let buffer = '';
    let lineCount = 0;
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: chunkSize });
      
      stream.on('data', (chunk) => {
        totalRead += Buffer.byteLength(chunk, 'utf8');
        buffer += chunk;
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        
        // Send lines to renderer for processing
        if (lines.length > 0) {
          lineCount += lines.length;
          event.sender.send('file-lines-chunk', { lines, lineCount });
        }
        
        // Send progress update
        const progress = Math.round((totalRead / fileSize) * 100);
        event.sender.send('file-read-progress', { progress, totalRead, fileSize });
      });
      
      stream.on('end', () => {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          lineCount += 1;
          event.sender.send('file-lines-chunk', { lines: [buffer], lineCount });
        }
        
        // Signal completion
        event.sender.send('file-stream-complete', { totalLines: lineCount, totalBytes: totalRead });
        resolve({ success: true, totalLines: lineCount, size: totalRead });
      });
      
      stream.on('error', (error) => {
        reject({ success: false, error: error.message });
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-file-info', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      success: true,
      info: {
        size: stats.size,
        modified: stats.mtime,
        name: path.basename(filePath),
        extension: path.extname(filePath)
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Add MCP Server IPC handlers
ipcMain.handle('mcp-server-start', async () => {
  try {
    if (mcpServerStatus === 'running') {
      return { 
        success: true, 
        message: 'MCP Server is already running', 
        status: 'running',
        httpPort: 3000,
        wsPort: 3001
      };
    }
    
    if (mcpServerStatus === 'starting') {
      return { success: false, message: 'MCP Server is already starting', status: 'starting' };
    }

    mcpServerStatus = 'starting';
    
    try {
      // Create MCP server
      mcpServer = new MCPGenomeBrowserServer(3000, 3001);
      
      // Start the server (now async)
      const startResult = await mcpServer.start();
      
      mcpServerStatus = 'running';
      console.log('MCP Server started successfully');
      
      return { 
        success: true, 
        message: startResult.message, 
        status: 'running',
        httpPort: startResult.httpPort,
        wsPort: startResult.wsPort
      };
    } catch (error) {
      mcpServerStatus = 'stopped';
      mcpServer = null; // Clear the server instance on failure
      console.error('Failed to start MCP Server:', error);
      
      return { 
        success: false, 
        message: `Failed to start MCP Server: ${error.message}`, 
        status: 'stopped' 
      };
    }
  } catch (error) {
    mcpServerStatus = 'stopped';
    return { success: false, message: error.message, status: 'stopped' };
  }
});

ipcMain.handle('mcp-server-stop', async () => {
  try {
    if (mcpServerStatus === 'stopped') {
      return { success: true, message: 'MCP Server is already stopped', status: 'stopped' };
    }
    
    if (mcpServerStatus === 'stopping') {
      return { success: false, message: 'MCP Server is already stopping', status: 'stopping' };
    }

    mcpServerStatus = 'stopping';
    
    if (mcpServer) {
      mcpServer.stop();
      mcpServer = null;
    }
    
    mcpServerStatus = 'stopped';
    console.log('MCP Server stopped successfully');
    
    return { 
      success: true, 
      message: 'MCP Server stopped successfully', 
      status: 'stopped' 
    };
  } catch (error) {
    mcpServerStatus = 'stopped';
    return { success: false, message: error.message, status: 'stopped' };
  }
});

ipcMain.handle('mcp-server-status', async () => {
  return { 
    status: mcpServerStatus,
    isRunning: mcpServerStatus === 'running',
    httpPort: mcpServerStatus === 'running' ? 3000 : null,
    wsPort: mcpServerStatus === 'running' ? 3001 : null
  };
});

// Handle opening smart execution demo
ipcMain.on('open-smart-execution-demo', (event) => {
  try {
    // Create a new window for the Smart Execution Demo
    const demoWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false
      },
      title: 'Smart Execution Demo - GenomeExplorer',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      show: false // Don't show until ready
    });

    const demoPath = path.join(__dirname, '..', 'test', 'smart-execution-demo.html');
    
    // Check if file exists
    if (fs.existsSync(demoPath)) {
      demoWindow.loadFile(demoPath);
    } else {
      console.error('Smart execution demo file not found:', demoPath);
      // Try alternative path (for development)
      const altPath = path.join(__dirname, 'test', 'smart-execution-demo.html');
      if (fs.existsSync(altPath)) {
        demoWindow.loadFile(altPath);
      } else {
        console.error('Smart execution demo file not found at alternative path:', altPath);
        demoWindow.destroy();
        return;
      }
    }

    // Show window when ready
    demoWindow.once('ready-to-show', () => {
      demoWindow.show();
    });

    // Handle window closed
    demoWindow.on('closed', () => {
      console.log('Smart Execution Demo window closed');
    });

  } catch (error) {
    console.error('Failed to open smart execution demo:', error);
  }
}); 