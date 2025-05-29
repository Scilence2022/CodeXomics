const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

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
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

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
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Genome Viewer',
              message: 'Genome Viewer v1.0.0',
              detail: 'A modern genome browser built with Electron'
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
    const chunks = [];
    let totalRead = 0;
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: chunkSize });
      
      stream.on('data', (chunk) => {
        chunks.push(chunk);
        totalRead += chunk.length;
        
        // Send progress update
        const progress = Math.round((totalRead / fileSize) * 100);
        event.sender.send('file-read-progress', { progress, totalRead, fileSize });
      });
      
      stream.on('end', () => {
        const data = chunks.join('');
        resolve({ success: true, data, size: totalRead });
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