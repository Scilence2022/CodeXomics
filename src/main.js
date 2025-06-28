const { app, BrowserWindow, Menu, MenuItem, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const MCPGenomeBrowserServer = require('./mcp-server');

let mainWindow;
let mcpServer = null;
let mcpServerStatus = 'stopped'; // 'stopped', 'starting', 'running', 'stopping'

// 为生物信息学工具窗口创建独立菜单
// 存储各个工具窗口的菜单模板
let toolMenuTemplates = new Map();
let currentActiveWindow = null;

function createToolWindowMenu(toolWindow, toolName) {
  const template = [
    // 添加 Genome AI Studio 品牌菜单项（仅在 macOS 上）
    ...(process.platform === 'darwin' ? [{
      label: 'Genome AI Studio',
      submenu: [
        {
          label: `About ${toolName}`,
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'about', toolName);
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'preferences');
          }
        },
        { type: 'separator' },
        {
          label: 'Hide Genome AI Studio',
          accelerator: 'Cmd+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Cmd+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit Genome AI Studio',
          accelerator: 'Cmd+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Analysis',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'new-analysis');
          }
        },
        {
          label: 'Open Data File',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(toolWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Text Files', extensions: ['txt', 'tsv', 'csv'] },
                { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'XML Files', extensions: ['xml'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              toolWindow.webContents.send('tool-menu-action', 'open-file', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Save Results',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'save-results');
          }
        },
        {
          label: 'Export Data',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'export-data');
          }
        },
        { type: 'separator' },
        ...(process.platform !== 'darwin' ? [
          {
            label: 'Exit',
            accelerator: 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ] : [
          {
            label: 'Close Window',
            accelerator: 'Cmd+W',
            click: () => {
              toolWindow.close();
            }
          }
        ])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'copy');
          }
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'paste');
          }
        },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'cut');
          }
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'select-all');
          }
        },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'find');
          }
        },
        {
          label: 'Find Next',
          accelerator: 'F3',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'find-next');
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
        ...(process.platform === 'darwin' ? [
          { role: 'togglefullscreen' }
        ] : [
          { role: 'togglefullscreen' }
        ]),
        { type: 'separator' },
        {
          label: 'Refresh Data',
          accelerator: 'F5',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'refresh-data');
          }
        },
        {
          label: 'Clear Results',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'clear-results');
          }
        }
      ]
    },
    {
      label: 'Analysis',
      submenu: [
        {
          label: 'Run Analysis',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'run-analysis');
          }
        },
        {
          label: 'Stop Analysis',
          accelerator: 'Escape',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'stop-analysis');
          }
        },
        { type: 'separator' },
        {
          label: 'Load Sample Data',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'load-sample');
          }
        },
        {
          label: 'Reset Parameters',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'reset-parameters');
          }
        }
      ]
    },
    {
      label: 'Options',
      submenu: [
        ...(process.platform !== 'darwin' ? [
          {
            label: 'Preferences',
            accelerator: 'Ctrl+,',
            click: () => {
              toolWindow.webContents.send('tool-menu-action', 'preferences');
            }
          },
          { type: 'separator' }
        ] : []),
        {
          label: 'Analysis Settings',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'analysis-settings');
          }
        },
        {
          label: 'Output Format',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'output-format');
          }
        },
        { type: 'separator' },
        {
          label: 'Advanced Options',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'advanced-options');
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            toolWindow.close();
          }
        },
        { type: 'separator' },
        {
          label: 'Return to Main Window',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => {
            if (mainWindow) {
              mainWindow.focus();
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        ...(process.platform !== 'darwin' ? [
          {
            label: `About ${toolName}`,
            click: () => {
              toolWindow.webContents.send('tool-menu-action', 'about', toolName);
            }
          },
          { type: 'separator' }
        ] : []),
        {
          label: 'User Guide',
          accelerator: 'F1',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'user-guide');
          }
        },
        {
          label: 'Tool Documentation',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'documentation');
          }
        },
        {
          label: 'Online Resources',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'online-resources');
          }
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => {
            require('electron').shell.openExternal('https://github.com/Scilence2022/GenomeAIStudio/issues');
          }
        },
        {
          label: 'Contact Support',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'contact-support');
          }
        }
      ]
    }
  ];

  // 存储工具窗口的菜单模板
  toolMenuTemplates.set(toolWindow.id, { template, toolName });

  // 创建菜单并设置为应用菜单（这会替换当前的应用菜单）
  const menu = Menu.buildFromTemplate(template);
  
  // 设置窗口聚焦时切换菜单
  toolWindow.on('focus', () => {
    currentActiveWindow = toolWindow;
    Menu.setApplicationMenu(menu);
    console.log(`Switched to ${toolName} menu`);
  });

  // 当窗口关闭时清理
  toolWindow.on('closed', () => {
    toolMenuTemplates.delete(toolWindow.id);
    if (currentActiveWindow === toolWindow) {
      currentActiveWindow = null;
      // 恢复到主窗口菜单
      if (mainWindow && !mainWindow.isDestroyed()) {
        createMenu(); // 重新创建主窗口菜单
      }
    }
  });

  // 如果这是当前活动窗口，立即设置菜单
  if (toolWindow.isFocused()) {
    currentActiveWindow = toolWindow;
    Menu.setApplicationMenu(menu);
    console.log(`Initial menu set for ${toolName}`);
  }
}

// Create specialized menu for Evo2 DNA Designer
function createEvo2WindowMenu(evo2Window) {
  const template = [
    // macOS app menu
    ...(process.platform === 'darwin' ? [{
      label: 'Evo2 Designer',
      submenu: [
        {
          label: 'About Evo2 Designer',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'about');
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'preferences');
          }
        },
        { type: 'separator' },
        {
          label: 'Hide Evo2 Designer',
          accelerator: 'Cmd+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Cmd+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Cmd+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    }] : []),
    
    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Design Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'new-project');
          }
        },
        {
          label: 'Open Sequence File',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(evo2Window, {
              properties: ['openFile'],
              filters: [
                { name: 'FASTA Files', extensions: ['fasta', 'fa', 'fas'] },
                { name: 'GenBank Files', extensions: ['gb', 'gbk'] },
                { name: 'Text Files', extensions: ['txt'] },
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              evo2Window.webContents.send('evo2-menu-action', 'open-sequence-file', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Import from Clipboard',
          accelerator: 'CmdOrCtrl+Shift+V',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'import-clipboard');
          }
        },
        { type: 'separator' },
        {
          label: 'Save Design',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'save-design');
          }
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'save-as');
          }
        },
        {
          label: 'Export Results',
          submenu: [
            {
              label: 'Export as FASTA',
              click: () => {
                evo2Window.webContents.send('evo2-menu-action', 'export-fasta');
              }
            },
            {
              label: 'Export as GenBank',
              click: () => {
                evo2Window.webContents.send('evo2-menu-action', 'export-genbank');
              }
            },
            {
              label: 'Export as JSON',
              click: () => {
                evo2Window.webContents.send('evo2-menu-action', 'export-json');
              }
            },
            {
              label: 'Export Analysis Report',
              click: () => {
                evo2Window.webContents.send('evo2-menu-action', 'export-report');
              }
            }
          ]
        },
        { type: 'separator' },
        ...(process.platform !== 'darwin' ? [
          {
            label: 'Exit',
            accelerator: 'Ctrl+Q',
            click: () => {
              evo2Window.close();
            }
          }
        ] : [
          {
            label: 'Close Window',
            accelerator: 'Cmd+W',
            click: () => {
              evo2Window.close();
            }
          }
        ])
      ]
    },

    // Edit Menu  
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'undo');
          }
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'redo');
          }
        },
        { type: 'separator' },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'copy');
          }
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'paste');
          }
        },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'cut');
          }
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'select-all');
          }
        },
        { type: 'separator' },
        {
          label: 'Copy Sequence',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'copy-sequence');
          }
        },
        {
          label: 'Paste Sequence',
          accelerator: 'CmdOrCtrl+Shift+V',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'paste-sequence');
          }
        },
        {
          label: 'Clear Input',
          accelerator: 'CmdOrCtrl+Delete',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'clear-input');
          }
        }
      ]
    },

    // Generation Menu
    {
      label: 'Generation',
      submenu: [
        {
          label: 'Generate DNA Sequence',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'generate-sequence');
          }
        },
        {
          label: 'Predict Function',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'predict-function');
          }
        },
        {
          label: 'Design CRISPR System',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'design-crispr');
          }
        },
        {
          label: 'Optimize Sequence',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'optimize-sequence');
          }
        },
        {
          label: 'Analyze Essentiality',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'analyze-essentiality');
          }
        },
        { type: 'separator' },
        {
          label: 'Stop Generation',
          accelerator: 'CmdOrCtrl+.',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'stop-generation');
          }
        }
      ]
    },

    // Tools Menu
    {
      label: 'Tools',
      submenu: [
        {
          label: 'NVIDIA API Configuration',
          accelerator: 'CmdOrCtrl+Alt+C',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'configure-api');
          }
        },
        {
          label: 'Test API Connection',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'test-api-connection');
          }
        },
        { type: 'separator' },
        {
          label: 'History Manager',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'show-history');
          }
        },
        {
          label: 'Clear History',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'clear-history');
          }
        }
      ]
    },

    // View Menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Switch Mode',
          submenu: [
            {
              label: 'Sequence Generation',
              accelerator: '1',
              click: () => {
                evo2Window.webContents.send('evo2-menu-action', 'switch-mode', 'generate');
              }
            },
            {
              label: 'Function Prediction',
              accelerator: '2',
              click: () => {
                evo2Window.webContents.send('evo2-menu-action', 'switch-mode', 'predict');
              }
            },
            {
              label: 'CRISPR Design',
              accelerator: '3',
              click: () => {
                evo2Window.webContents.send('evo2-menu-action', 'switch-mode', 'crispr');
              }
            },
            {
              label: 'Sequence Optimization',
              accelerator: '4',
              click: () => {
                evo2Window.webContents.send('evo2-menu-action', 'switch-mode', 'optimize');
              }
            },
            {
              label: 'Essentiality Analysis',
              accelerator: '5',
              click: () => {
                evo2Window.webContents.send('evo2-menu-action', 'switch-mode', 'essentiality');
              }
            }
          ]
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },

    // Window Menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          { role: 'front' }
        ] : [
          { role: 'close' }
        ]),
        { type: 'separator' },
        {
          label: 'Open Main Genome AI Studio',
          click: () => {
            // Focus main window
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.focus();
              mainWindow.show();
            }
          }
        }
      ]
    },

    // Help Menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Evo2 User Guide',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'show-user-guide');
          }
        },
        {
          label: 'NVIDIA Evo2 Documentation',
          click: () => {
            require('electron').shell.openExternal('https://docs.api.nvidia.com/nim/reference/arc-evo2-40b');
          }
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+?',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'show-shortcuts');
          }
        },
        { type: 'separator' },
        {
          label: 'About Evo2 Designer',
          click: () => {
            evo2Window.webContents.send('evo2-menu-action', 'about');
          }
        }
      ]
    }
  ];

  // Set window focus event to activate this menu
  evo2Window.on('focus', () => {
    currentActiveWindow = evo2Window;
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    console.log('Switched to Evo2 Designer menu');
  });

  // When window closes, restore main menu
  evo2Window.on('closed', () => {
    if (currentActiveWindow === evo2Window) {
      currentActiveWindow = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        createMenu(); // Restore main window menu
      }
    }
  });

  // Set initial menu if window is focused
  if (evo2Window.isFocused()) {
    currentActiveWindow = evo2Window;
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    console.log('Initial Evo2 Designer menu set');
  }
}

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

  // 主窗口获得焦点时切换回主菜单
  mainWindow.on('focus', () => {
    if (currentActiveWindow !== mainWindow) {
      currentActiveWindow = mainWindow;
      createMenu(); // 重新创建并设置主窗口菜单
      console.log('Switched to main window menu');
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    currentActiveWindow = null;
  });
}

// Create menu
function createMenu() {
  const template = [
    // 添加 Genome AI Studio 品牌菜单项（仅在 macOS 上）
    ...(process.platform === 'darwin' ? [{
      label: 'Genome AI Studio',
      submenu: [
        {
          label: 'About Genome AI Studio',
          click: () => {
            mainWindow.webContents.send('show-about');
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: () => {
            mainWindow.webContents.send('general-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'Hide Genome AI Studio',
          accelerator: 'Cmd+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Cmd+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit Genome AI Studio',
          accelerator: 'Cmd+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // Create Project Manager window and trigger new project creation
            createProjectManagerWindow();
            // Send event to trigger new project modal after window is ready
            setTimeout(() => {
              const projectManagerWindow = BrowserWindow.getAllWindows().find(
                win => win.getTitle().includes('Project Manager')
              );
              if (projectManagerWindow && !projectManagerWindow.isDestroyed()) {
                projectManagerWindow.webContents.send('create-new-project');
              }
            }, 500);
          }
        },
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
          label: 'Project Manager',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            createProjectManagerWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            // Create or focus Project Manager window first
            createProjectManagerWindow();
            
            // Small delay to ensure window is ready
            setTimeout(async () => {
              const result = await dialog.showOpenDialog(null, {
                properties: ['openFile'],
                filters: [
                  { name: 'Genome AI Studio Project Files', extensions: ['prj.GAI'] },
                  { name: 'XML Files', extensions: ['xml'] },
                  { name: 'Project Files', extensions: ['genomeproj', 'json'] },
                  { name: 'All Files', extensions: ['*'] }
                ],
                title: 'Open Project'
              });
              
              if (!result.canceled && result.filePaths.length > 0) {
                // Send the file path to the Project Manager window
                const projectManagerWindow = BrowserWindow.getAllWindows().find(
                  win => win.getTitle().includes('Project Manager')
                );
                if (projectManagerWindow && !projectManagerWindow.isDestroyed()) {
                  projectManagerWindow.webContents.send('load-project-from-menu', result.filePaths[0]);
                }
              }
            }, 100);
          }
        },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('save-current-project');
          }
        },
        {
          label: 'Save Project As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('save-project-as');
          }
        },
        { type: 'separator' },
        {
          label: 'Recent Projects',
          id: 'recent-projects',
          submenu: [
            {
              label: 'No recent projects',
              enabled: false
            }
          ]
        },
        ...(process.platform !== 'darwin' ? [
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ] : [])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            mainWindow.webContents.send('menu-copy');
          }
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            mainWindow.webContents.send('menu-paste');
          }
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            mainWindow.webContents.send('menu-select-all');
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
          accelerator: 'CmdOrCtrl+Shift+A',
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
        },
        { type: 'separator' },
        {
          label: 'Resource Manager',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.send('open-resource-manager');
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
        },
        { type: 'separator' },
        {
          label: 'Circos Genome Plotter',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            createCircosWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Conversation Evolution System',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            createEvolutionWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'CRISPR Guide RNA Design',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => {
            createCrisprDesignerWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Visualization Tools',
          submenu: [
            {
              label: 'KGML Pathway Viewer',
              accelerator: 'CmdOrCtrl+Shift+K',
              click: () => {
                createKGMLViewerWindow();
              }
            },
            { type: 'separator' },
            {
              label: 'Network Graph Viewer',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'network-graph');
              }
            },
            {
              label: 'Protein Interaction Network',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'protein-interaction-network');
              }
            },
            {
              label: 'Gene Regulatory Network',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'gene-regulatory-network');
              }
            },
            {
              label: 'Phylogenetic Tree Viewer',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'phylogenetic-tree');
              }
            },
            {
              label: 'Sequence Alignment Viewer',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'sequence-alignment');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Biological Databases',
          submenu: [
            {
              label: 'KEGG Pathway Analysis',
              accelerator: 'CmdOrCtrl+Shift+K',
              click: () => {
                createKEGGWindow();
              }
            },
            {
              label: 'Gene Ontology (GO) Analyzer',
              accelerator: 'CmdOrCtrl+Alt+G',
              click: () => {
                createGOWindow();
              }
            },
            {
              label: 'UniProt Database Search',
              accelerator: 'CmdOrCtrl+Shift+U',
              click: () => {
                createUniProtWindow();
              }
            },
            {
              label: 'InterPro Domain Analysis',
              accelerator: 'CmdOrCtrl+Shift+I',
              click: () => {
                createInterProWindow();
              }
            },
            {
              label: 'NCBI Database Browser',
              accelerator: 'CmdOrCtrl+Shift+N',
              click: () => {
                createNCBIWindow();
              }
            },
            {
              label: 'Ensembl Genome Browser',
              accelerator: 'CmdOrCtrl+Shift+B',
              click: () => {
                createEnsemblWindow();
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Analysis Tools',
          submenu: [
            {
              label: 'STRING Protein Networks',
              accelerator: 'CmdOrCtrl+Shift+S',
              click: () => {
                createSTRINGWindow();
              }
            },
            {
              label: 'DAVID Functional Analysis',
              accelerator: 'CmdOrCtrl+Shift+D',
              click: () => {
                createDAVIDWindow();
              }
            },
            {
              label: 'Reactome Pathway Browser',
              accelerator: 'CmdOrCtrl+Shift+R',
              click: () => {
                createReactomeWindow();
              }
            },
            {
              label: 'PDB Structure Viewer',
              accelerator: 'CmdOrCtrl+Shift+T',
              click: () => {
                createPDBWindow();
              }
            },
            { type: 'separator' },
            {
              label: 'Evo2 Design',
              accelerator: 'CmdOrCtrl+Shift+E',
              click: () => {
                createEvo2Window();
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'System Tools',
          submenu: [
            {
              label: 'Install BLAST+ Tools',
              accelerator: 'CmdOrCtrl+Alt+B',
              click: () => {
                createBlastInstallerWindow();
              }
            },
            {
              label: 'Check BLAST Installation',
              click: () => {
                mainWindow.webContents.send('check-blast-installation');
              }
            },
            {
              label: 'System Requirements Check',
              click: () => {
                mainWindow.webContents.send('system-requirements-check');
              }
            }
          ]
        }
      ]
    },
    {
      label: 'Options',
      submenu: [
        {
          label: 'Configure LLMs',
          click: () => {
            mainWindow.webContents.send('configure-llms');
          }
        },
        { type: 'separator' },
        {
          label: 'ChatBox Settings',
          click: () => {
            mainWindow.webContents.send('chatbox-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'MCP Server Settings',
          click: () => {
            mainWindow.webContents.send('mcp-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'General Settings',
          click: () => {
            mainWindow.webContents.send('general-settings');
          }
        }
      ]
    },
    {
      label: 'Plugins',
      submenu: [
        {
          label: 'Plugin Management',
          accelerator: 'CmdOrCtrl+Alt+P',
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
        },
        {
          label: 'Plugin Function Calling Test',
          click: () => {
            mainWindow.webContents.send('show-plugin-function-calling-test');
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.close();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Window Layout',
          submenu: [
            {
              label: 'Optimal Layout (Main 75% + Project Manager 25%)',
              accelerator: 'CmdOrCtrl+Alt+L',
              click: () => {
                arrangeWindowsOptimal();
              }
            },
            {
              label: 'Side by Side (50% + 50%)',
              accelerator: 'CmdOrCtrl+Alt+S',
              click: () => {
                arrangeWindowsSideBySide();
              }
            },
            {
              label: 'Main Window Focus',
              accelerator: 'CmdOrCtrl+Alt+M',
              click: () => {
                arrangeMainWindowFocus();
              }
            },
            {
              label: 'Project Manager Focus',
              accelerator: 'CmdOrCtrl+Alt+P',
              click: () => {
                arrangeProjectManagerFocus();
              }
            },
            { type: 'separator' },
            {
              label: 'Stack Vertically',
              click: () => {
                arrangeWindowsVertical();
              }
            },
            {
              label: 'Cascade Windows',
              click: () => {
                arrangeWindowsCascade();
              }
            },
            { type: 'separator' },
            {
              label: 'Reset to Default Positions',
              click: () => {
                resetWindowPositions();
              }
            }
          ]
        },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          {
            label: 'Bring All to Front',
            role: 'front'
          }
        ] : [])
      ]
    },
    {
      label: 'Help',
      submenu: [
        ...(process.platform !== 'darwin' ? [
          {
                      label: 'About Genome AI Studio',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Genome AI Studio',
              message: 'Genome AI Studio v0.2 beta',
                detail: 'A modern AI-powered genome analysis studio built with Electron'
              });
            }
          },
          { type: 'separator' }
        ] : []),
        {
          label: 'User Guide',
          accelerator: 'F1',
          click: () => {
            mainWindow.webContents.send('show-user-guide');
          }
        },
        {
          label: 'Documentation',
          click: () => {
            require('electron').shell.openExternal('https://github.com/Scilence2022/GenomeAIStudio/docs');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            require('electron').shell.openExternal('https://github.com/Scilence2022/GenomeAIStudio/issues');
          }
        }
      ]
    },
    // 添加 Genome AI Studio 品牌菜单项（仅在 macOS 上）
    {
      label: 'Genome AI Studio',
      submenu: [
        {
          label: 'About Genome AI Studio',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Genome AI Studio',
              message: 'Genome AI Studio v0.2 beta',
              detail: 'An intelligent genome analysis platform with AI-powered features.',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        { type: 'separator' },
        {
          label: 'Hide Genome AI Studio',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit Genome AI Studio',
          accelerator: 'Command+Q',
          click: () => app.quit()
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
    // Check file size first
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    const extension = path.extname(filePath).toLowerCase();
    
    // For BAM files, don't try to read as text
    if (extension === '.bam') {
      return { 
        success: false, 
        error: 'BAM files are binary format and should be handled by specialized BAM reader.',
        isBamFile: true,
        fileSize: stats.size
      };
    }
    
    // For files larger than 500MB, refuse to read entirely into memory
    // JavaScript has a string length limit of ~512MB
    if (fileSizeMB > 500) {
      return { 
        success: false, 
        error: `File is too large (${fileSizeMB.toFixed(1)} MB) to read into memory. Use streaming mode instead.`,
        requiresStreaming: true,
        fileSize: stats.size
      };
    }
    
    // For files larger than 100MB, warn but allow
    if (fileSizeMB > 100) {
      console.warn(`Reading large file into memory: ${fileSizeMB.toFixed(1)} MB`);
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// BAM file handlers
let bamFiles = new Map(); // Cache BAM file instances

ipcMain.handle('bam-initialize', async (event, filePath) => {
  try {
    console.log('Initializing BAM file:', filePath);
    
    // Import BAM libraries - use the newer bamPath approach to avoid buffer issues
    const { BamFile } = require('@gmod/bam');
    
    // Check if BAI index exists
    let baiPath = null;
    const standardBaiPath = filePath + '.bai';
    if (fs.existsSync(standardBaiPath)) {
      baiPath = standardBaiPath;
      console.log('Found BAI index:', baiPath);
    } else {
      const altBaiPath = filePath.replace('.bam', '.bai');
      if (fs.existsSync(altBaiPath)) {
        baiPath = altBaiPath;
        console.log('Found BAI index:', altBaiPath);
      } else {
        console.warn('No BAI index found. Performance may be slower for large files.');
      }
    }
    
    // Create BAM file instance using direct path (avoids buffer issues)
    // This approach uses the built-in LocalFile handling within @gmod/bam
    const bamFileConfig = {
      bamPath: filePath
    };
    
    // Add BAI path if available
    if (baiPath) {
      bamFileConfig.baiPath = baiPath;
    }
    
    // Optional: Add cache configuration
    bamFileConfig.cacheSize = 100;
    bamFileConfig.yieldThreadTime = 100;
    
    console.log('Creating BAM file instance with config:', bamFileConfig);
    const bamFile = new BamFile(bamFileConfig);
    
    // Get header first - this is required before any other operations
    console.log('Getting BAM header...');
    const header = await bamFile.getHeader();
    console.log('BAM header retrieved successfully');
    console.log('Header references:', header.references?.length || 0);
    
    // Get file size
    const stats = fs.statSync(filePath);
    
    // Try to estimate total reads more safely
    let totalReads = 0;
    if (baiPath && header.references && header.references.length > 0) {
      // Try to get counts for first few references only to avoid errors
      const maxRefsToCheck = Math.min(3, header.references.length);
      console.log(`Checking read counts for ${maxRefsToCheck} references...`);
      
      for (let i = 0; i < maxRefsToCheck; i++) {
        const ref = header.references[i];
        try {
          const count = await bamFile.lineCount(ref.name);
          if (count && count > 0) {
            totalReads += count;
            console.log(`Reference ${ref.name}: ${count} reads`);
          }
        } catch (error) {
          console.warn(`Error counting reads for ${ref.name}:`, error.message);
          // Continue with other references
        }
      }
      
      // If we got some counts but not all refs, estimate the rest
      if (totalReads > 0 && maxRefsToCheck < header.references.length) {
        const avgPerRef = totalReads / maxRefsToCheck;
        totalReads += avgPerRef * (header.references.length - maxRefsToCheck);
        console.log(`Estimated total reads: ${Math.floor(totalReads)}`);
      }
    }
    
    // If we couldn't get counts from index, estimate based on file size
    if (totalReads === 0) {
      totalReads = Math.floor(stats.size / 100); // Rough estimate: ~100 bytes per read
      console.log(`Estimated reads from file size: ${totalReads}`);
    }
    
    // Cache the BAM file instance
    bamFiles.set(filePath, bamFile);
    
    const result = {
      success: true,
      header: header,
      references: header.references || [],
      totalReads: Math.floor(totalReads),
      fileSize: stats.size
    };
    
    console.log('BAM initialization successful:', {
      references: result.references.length,
      totalReads: result.totalReads,
      fileSize: `${(result.fileSize / (1024 * 1024)).toFixed(2)} MB`
    });
    
    return result;
  } catch (error) {
    console.error('Error initializing BAM file:', error);
    console.error('Error stack:', error.stack);
    
    // Clean up any cached instance
    bamFiles.delete(filePath);
    return {
      success: false,
      error: `Failed to initialize BAM file: ${error.message}. Please ensure the BAM file is properly formatted and not corrupted.`
    };
  }
});

ipcMain.handle('bam-get-reads', async (event, params) => {
  try {
    const { filePath, chromosome, start, end } = params;
    
    console.log(`Getting BAM reads for ${chromosome}:${start}-${end}`);
    
    // Get cached BAM file instance
    const bamFile = bamFiles.get(filePath);
    if (!bamFile) {
      throw new Error('BAM file not initialized. Please reinitialize the BAM file.');
    }
    
    // Validate input parameters
    if (!chromosome || typeof chromosome !== 'string') {
      throw new Error('Invalid chromosome parameter');
    }
    
    if (typeof start !== 'number' || typeof end !== 'number' || start < 0 || end < start) {
      throw new Error('Invalid start/end coordinates');
    }
    
    // Limit the query range to prevent excessive memory usage
    const maxRangeSize = 10000000; // 10MB max range
    if (end - start > maxRangeSize) {
      throw new Error(`Query range too large. Maximum range size is ${maxRangeSize} bases.`);
    }
    
    // Get records from BAM file using the correct API
    // Note: @gmod/bam uses 0-based half-open coordinates
    console.log(`Fetching records for range ${chromosome}:${start}-${end}`);
    const records = await bamFile.getRecordsForRange(chromosome, start, end);
    
    console.log(`Retrieved ${records.length} raw records from BAM file`);
    
    // Convert records to our internal format with better error handling
    const reads = [];
    for (let i = 0; i < records.length; i++) {
      try {
        const record = records[i];
        
        const read = {
          id: record.name || record.qname || `read_${i}`,
          chromosome: record.refName || chromosome,
          start: record.start,
          end: record.end,
          strand: (record.strand === 1 || record.strand === '+') ? '+' : '-',
          mappingQuality: record.mq || record.mapq || 0,
          cigar: record.CIGAR || record.cigar || '',
          sequence: record.seq || '',
          quality: record.qual || '',
          flags: record.flags || 0,
          templateLength: record.template_length || record.tlen || 0,
          tags: record.tags || {}
        };
        
        reads.push(read);
      } catch (recordError) {
        console.warn(`Error processing record ${i}:`, recordError.message);
        // Continue processing other records
      }
    }
    
    console.log(`Successfully converted ${reads.length} BAM reads`);
    
    return {
      success: true,
      reads: reads
    };
  } catch (error) {
    console.error('Error getting BAM reads:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      error: `Failed to read BAM records: ${error.message}`
    };
  }
});

// Clean up BAM files when app is quitting
app.on('before-quit', () => {
  bamFiles.clear();
});

ipcMain.handle('read-file-stream', async (event, filePath, chunkSize = 1024 * 1024) => {
  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    let totalRead = 0;
    let buffer = '';
    let lineCount = 0;
    
    console.log(`Starting stream read of ${(fileSize / (1024 * 1024)).toFixed(1)} MB file: ${path.basename(filePath)}`);
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { 
        encoding: 'utf8', 
        highWaterMark: chunkSize 
      });
      
      stream.on('data', (chunk) => {
        try {
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
          
          // Log progress for very large files
          if (totalRead % (50 * 1024 * 1024) === 0) { // Every 50MB
            console.log(`Stream progress: ${(totalRead / (1024 * 1024)).toFixed(1)} MB / ${(fileSize / (1024 * 1024)).toFixed(1)} MB`);
          }
        } catch (chunkError) {
          console.error('Error processing chunk:', chunkError);
          stream.destroy();
          reject({ success: false, error: `Error processing data chunk: ${chunkError.message}` });
        }
      });
      
      stream.on('end', () => {
        try {
          // Process any remaining data in buffer
          if (buffer.trim()) {
            lineCount += 1;
            event.sender.send('file-lines-chunk', { lines: [buffer], lineCount });
          }
          
          console.log(`Stream complete: ${lineCount} lines, ${(totalRead / (1024 * 1024)).toFixed(1)} MB`);
          
          // Signal completion
          event.sender.send('file-stream-complete', { totalLines: lineCount, totalBytes: totalRead });
          resolve({ success: true, totalLines: lineCount, size: totalRead });
        } catch (endError) {
          console.error('Error finalizing stream:', endError);
          reject({ success: false, error: `Error finalizing stream: ${endError.message}` });
        }
      });
      
      stream.on('error', (error) => {
        console.error('Stream error:', error);
        reject({ success: false, error: `File read error: ${error.message}` });
      });
    });
  } catch (error) {
    console.error('Error setting up stream:', error);
    return { success: false, error: `Failed to set up file stream: ${error.message}` };
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
      title: 'Smart Execution Demo - Genome AI Studio',
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

// Handle opening resource manager
ipcMain.on('open-resource-manager', (event) => {
  try {
    // Create new window for the resource manager
    const resourceManagerWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      title: 'Resource Manager - Genome AI Studio',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      resizable: true,
      minimizable: true,
      maximizable: true,
      show: false
    });
    
    // Load the resource manager HTML
    const resourceManagerPath = path.join(__dirname, 'resource-manager.html');
    
    // Check if file exists, if not create a fallback
    if (fs.existsSync(resourceManagerPath)) {
      resourceManagerWindow.loadFile(resourceManagerPath);
    } else {
      console.log('Resource manager file not found, creating...');
      // We'll create the file below
      resourceManagerWindow.loadFile(resourceManagerPath);
    }
    
    // Show window when ready
    resourceManagerWindow.once('ready-to-show', () => {
      resourceManagerWindow.show();
    });
    
    // Handle window closed
    resourceManagerWindow.on('closed', () => {
      console.log('Resource Manager window closed');
    });
    
  } catch (error) {
    console.error('Failed to open Resource Manager:', error);
  }
});

// Resource Manager IPC handlers
ipcMain.handle('get-loaded-resources', async () => {
  try {
    // In a real implementation, this would collect data from the main window
    // For now, return mock data that matches the expected format
    const mockResources = [
      {
        id: 'genome1',
        type: 'fasta',
        name: 'E.coli_K12.fasta',
        path: '/Users/example/data/E.coli_K12.fasta',
        size: 4641652,
        loadedAt: new Date().toISOString(),
        status: 'loaded',
        chromosomes: ['NC_000913.3'],
        sequences: 1,
        metadata: {
          organism: 'Escherichia coli K-12',
          version: 'RefSeq',
          source: 'NCBI'
        }
      }
    ];
    
    return { success: true, resources: mockResources };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('refresh-resources', async () => {
  try {
    // Send refresh request to main window and collect current state
    if (mainWindow) {
      mainWindow.webContents.send('collect-resource-info');
    }
    return { success: true, message: 'Resources refreshed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-resource', async (event, resourceId) => {
  try {
    // In a real implementation, this would communicate with the main window
    // to remove the resource
    console.log('Removing resource:', resourceId);
    return { success: true, message: 'Resource removed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-resource', async (event, resourceId, options) => {
  try {
    // Implementation would show save dialog and export the resource
    console.log('Exporting resource:', resourceId, options);
    return { success: true, message: 'Resource exported' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-resource-in-browser', async (event, resourceId) => {
  try {
    // Send message to main window to display the resource
    if (mainWindow) {
      mainWindow.webContents.send('open-resource', resourceId);
    }
    return { success: true, message: 'Resource opened in browser' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-and-load-file', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Genome Files', extensions: ['fasta', 'fa', 'gff', 'gff3', 'gtf', 'vcf', 'bam', 'sam', 'wig', 'bigwig', 'fastq', 'fq'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      // Send to main window for loading
      mainWindow.webContents.send('load-file', filePath);
      return { success: true, filePath };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-to-main-window', async (event, channel, data) => {
  try {
    if (mainWindow) {
      mainWindow.webContents.send(channel, data);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create Circos Window Function
function createCircosWindow() {
  try {
    // Create new window for the Circos genome plotter
    const circosWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'Circos Genome Plotter - Genome AI Studio',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      show: false
    });

    const circosPath = path.join(__dirname, 'circos-plotter.html');
    
    // Load the Circos plotter HTML
    circosWindow.loadFile(circosPath);

    // Show window when ready
    circosWindow.once('ready-to-show', () => {
      circosWindow.show();
    });

    // Open DevTools for debugging
    circosWindow.webContents.openDevTools();

    // Handle window closed
    circosWindow.on('closed', () => {
      console.log('Circos Genome Plotter window closed');
    });

  } catch (error) {
    console.error('Failed to open Circos Genome Plotter:', error);
  }
}

// Create CRISPR Designer window
function createCrisprDesignerWindow() {
  const crisprWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  crisprWindow.loadFile(path.join(__dirname, 'crispr-designer.html'));

  crisprWindow.once('ready-to-show', () => {
    crisprWindow.show();
  });

  // Open DevTools for debugging
  crisprWindow.webContents.openDevTools();

  crisprWindow.on('closed', () => {
    // Dereference the window object
  });
}

// Create Conversation Evolution System window
function createEvolutionWindow() {
  const evolutionWindow = new BrowserWindow({
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
    show: false,
    title: 'Conversation Evolution System'
  });

  // Load the evolution system HTML
  evolutionWindow.loadFile(path.join(__dirname, 'conversation-evolution.html'));

  // Clear cache aggressively to ensure fresh file loading
  evolutionWindow.webContents.session.clearCache();
  evolutionWindow.webContents.session.clearStorageData();
  
  // Force reload after cache clear
  evolutionWindow.webContents.once('did-finish-load', () => {
    evolutionWindow.webContents.reload();
  });

  // Show window when ready to prevent visual flash
  evolutionWindow.once('ready-to-show', () => {
    evolutionWindow.show();
  });

  // Open DevTools for debugging
  evolutionWindow.webContents.openDevTools();

  // Create evolution-specific menu
  const evolutionMenuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Export Evolution Data',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            evolutionWindow.webContents.send('export-evolution-data');
          }
        },
        {
          label: 'Import Evolution Data',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            evolutionWindow.webContents.send('import-evolution-data');
          }
        },
        { type: 'separator' },
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            evolutionWindow.close();
          }
        }
      ]
    },
    {
      label: 'Evolution',
      submenu: [
        {
          label: 'Start Evolution Process',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            evolutionWindow.webContents.send('start-evolution');
          }
        },
        {
          label: 'Stop Evolution Process',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            evolutionWindow.webContents.send('stop-evolution');
          }
        },
        { type: 'separator' },
        {
          label: 'Refresh Data',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            evolutionWindow.webContents.send('refresh-evolution-data');
          }
        },
        {
          label: 'Clear All Data',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            evolutionWindow.webContents.send('clear-evolution-data');
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
          label: 'Conversation History',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            evolutionWindow.webContents.send('switch-tab', 'conversations');
          }
        },
        {
          label: 'Missing Features',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            evolutionWindow.webContents.send('switch-tab', 'missing');
          }
        },
        {
          label: 'Generated Plugins',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            evolutionWindow.webContents.send('switch-tab', 'plugins');
          }
        },
        {
          label: 'Evolution Process',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            evolutionWindow.webContents.send('switch-tab', 'evolution');
          }
        },
        {
          label: 'Evolution Reports',
          accelerator: 'CmdOrCtrl+5',
          click: () => {
            evolutionWindow.webContents.send('switch-tab', 'reports');
          }
        }
      ]
    },
    {
      label: 'Plugins',
      submenu: [
        {
          label: 'Generate Plugin for Selected',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            evolutionWindow.webContents.send('generate-plugins-for-selected');
          }
        },
        {
          label: 'Test Selected Plugins',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            evolutionWindow.webContents.send('test-selected-plugins');
          }
        },
        {
          label: 'Install Selected Plugins',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            evolutionWindow.webContents.send('install-selected-plugins');
          }
        },
        { type: 'separator' },
        {
          label: 'Export Selected Plugins',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            evolutionWindow.webContents.send('export-selected-plugins');
          }
        }
      ]
    },
    {
      label: 'Analysis',
      submenu: [
        {
          label: 'Analyze Selected Conversations',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            evolutionWindow.webContents.send('analyze-selected-conversations');
          }
        },
        {
          label: 'Generate Evolution Report',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            evolutionWindow.webContents.send('generate-evolution-report');
          }
        },
        { type: 'separator' },
        {
          label: 'Mark as Resolved',
          accelerator: 'CmdOrCtrl+M',
          click: () => {
            evolutionWindow.webContents.send('mark-as-resolved');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Evolution System Guide',
          click: () => {
            evolutionWindow.webContents.send('show-evolution-guide');
          }
        },
        {
          label: 'About Evolution System',
          click: () => {
            dialog.showMessageBox(evolutionWindow, {
              type: 'info',
              title: 'About Conversation Evolution System',
              message: 'Conversation Evolution System v1.0',
              detail: 'AI-powered conversation analysis and plugin generation system for Genome AI Studio'
            });
          }
        }
      ]
    }
  ];

  // Set the evolution-specific menu for this window
  const evolutionMenu = Menu.buildFromTemplate(evolutionMenuTemplate);
  evolutionWindow.setMenu(evolutionMenu);

  evolutionWindow.on('closed', () => {
    // Dereference the window object
  });
}

// Handle opening plugin function calling test
ipcMain.on('open-plugin-function-calling-test', (event) => {
  try {
    // Create new window for the plugin function calling test
    const testWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false
      },
      title: 'Plugin Function Calling Test - Genome AI Studio',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      show: false
    });

    const testPath = path.join(__dirname, '..', 'test', 'plugin-function-calling-test.html');
    
    // Check if file exists
    if (fs.existsSync(testPath)) {
      testWindow.loadFile(testPath);
    } else {
      console.error('Plugin function calling test file not found:', testPath);
      // Try alternative path (for development)
      const altPath = path.join(__dirname, 'test', 'plugin-function-calling-test.html');
      if (fs.existsSync(altPath)) {
        testWindow.loadFile(altPath);
      } else {
        console.error('Plugin function calling test file not found at alternative path:', altPath);
        testWindow.destroy();
        return;
      }
    }

    // Show window when ready
    testWindow.once('ready-to-show', () => {
      testWindow.show();
    });

    // Handle window closed
    testWindow.on('closed', () => {
      console.log('Plugin Function Calling Test window closed');
    });

  } catch (error) {
    console.error('Failed to open plugin function calling test:', error);
  }
});

// Handle genome data requests from CRISPR Designer
ipcMain.handle('get-genome-data', async (event) => {
  try {
    // Get the sender window (CRISPR window)
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    
    // Get main window data
    if (senderWindow && senderWindow.mainWindow) {
      const result = await senderWindow.mainWindow.webContents.executeJavaScript(`
        (function() {
          if (window.genomeBrowser) {
            return {
              currentSequence: window.genomeBrowser.currentSequence || null,
              currentAnnotations: window.genomeBrowser.currentAnnotations || {},
              currentPosition: window.genomeBrowser.currentPosition || null,
              currentChromosome: document.getElementById('chromosomeSelect')?.value || null
            };
          }
          return null;
        })()
      `);
      return result;
    }
    return null;
  } catch (error) {
    console.error('Error getting genome data:', error);
    return null;
  }
});

// Handle gene sequence requests
ipcMain.handle('get-gene-sequence', async (event, geneName) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    
    if (senderWindow && senderWindow.mainWindow) {
      const result = await senderWindow.mainWindow.webContents.executeJavaScript(`
        (async function() {
          if (window.genomeBrowser && '${geneName}') {
            const annotations = window.genomeBrowser.currentAnnotations || {};
            const sequences = window.genomeBrowser.currentSequence || {};
            
            // Search for gene in annotations
            for (const [chromosome, chrAnnotations] of Object.entries(annotations)) {
              if (chrAnnotations && chrAnnotations.length) {
                const gene = chrAnnotations.find(g => 
                  g.name === '${geneName}' || 
                  g.gene === '${geneName}' || 
                  g.locus_tag === '${geneName}' ||
                  (g.name && g.name.toLowerCase() === '${geneName}'.toLowerCase()) ||
                  (g.gene && g.gene.toLowerCase() === '${geneName}'.toLowerCase())
                );
                
                if (gene && sequences[chromosome]) {
                  const sequence = sequences[chromosome].substring(gene.start - 1, gene.end);
                  return {
                    sequence: sequence,
                    chromosome: chromosome,
                    start: gene.start,
                    end: gene.end,
                    geneName: gene.name || gene.gene || '${geneName}',
                    strand: gene.strand || '+',
                    source: 'gene_annotation'
                  };
                }
              }
            }
            
            return null;
          }
          return null;
        })()
      `);
      return result;
    }
    return null;
  } catch (error) {
    console.error('Error getting gene sequence:', error);
    return null;
  }
});

// Handle region sequence requests
ipcMain.handle('get-region-sequence', async (event, chromosome, start, end) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    
    if (senderWindow && senderWindow.mainWindow) {
      const result = await senderWindow.mainWindow.webContents.executeJavaScript(`
        (function() {
          if (window.genomeBrowser) {
            const sequences = window.genomeBrowser.currentSequence || {};
            
            if (sequences['${chromosome}']) {
              const sequence = sequences['${chromosome}'].substring(${start} - 1, ${end});
              return {
                sequence: sequence,
                chromosome: '${chromosome}',
                start: ${start},
                end: ${end},
                source: 'genomic_region'
              };
            }
          }
          return null;
        })()
      `);
      return result;
    }
    return null;
  } catch (error) {
    console.error('Error getting region sequence:', error);
    return null;
  }
});

// ========== BIOLOGICAL DATABASES TOOLS ==========

// Create KEGG Pathway Analysis Window
function createKEGGWindow() {
  try {
    const keggWindow = new BrowserWindow({
      width: 1600,
      height: 1000,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'KEGG Pathway Analysis - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    keggWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/kegg-analyzer.html'));

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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'Gene Ontology (GO) Analyzer - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    goWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/go-analyzer.html'));

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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'UniProt Database Search - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    uniprotWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/uniprot-search.html'));

    uniprotWindow.once('ready-to-show', () => {
      uniprotWindow.show();
      // 为UniProt工具窗口设置独立菜单
      createToolWindowMenu(uniprotWindow, 'UniProt Database Search');
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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'InterPro Domain Analysis - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    interproWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/interpro-analyzer.html'));

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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'NCBI Database Browser - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    ncbiWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/ncbi-browser.html'));

    ncbiWindow.once('ready-to-show', () => {
      ncbiWindow.show();
      // 为NCBI工具窗口设置独立菜单
      createToolWindowMenu(ncbiWindow, 'NCBI Database Browser');
    });

    ncbiWindow.webContents.openDevTools();

    ncbiWindow.on('closed', () => {
      console.log('NCBI Browser window closed');
    });

  } catch (error) {
    console.error('Failed to open NCBI Browser:', error);
  }
}

// Create Ensembl Genome Browser Window
function createEnsemblWindow() {
  try {
    const ensemblWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'Ensembl Genome Browser - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    ensemblWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/ensembl-browser.html'));

    ensemblWindow.once('ready-to-show', () => {
      ensemblWindow.show();
      // 为Ensembl工具窗口设置独立菜单
      createToolWindowMenu(ensemblWindow, 'Ensembl Genome Browser');
    });

    ensemblWindow.webContents.openDevTools();

    ensemblWindow.on('closed', () => {
      console.log('Ensembl Browser window closed');
    });

  } catch (error) {
    console.error('Failed to open Ensembl Browser:', error);
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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'STRING Protein Networks - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    stringWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/string-networks.html'));

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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'DAVID Functional Analysis - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    davidWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/david-analyzer.html'));

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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'Reactome Pathway Browser - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    reactomeWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/reactome-browser.html'));

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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'PDB Structure Viewer - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    pdbWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/pdb-viewer.html'));

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

// Create KGML Pathway Viewer Window
function createKGMLViewerWindow() {
  try {
    const kgmlWindow = new BrowserWindow({
      width: 1800,
      height: 1000,
      minWidth: 1400,
      minHeight: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'KGML Pathway Viewer - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    kgmlWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/kgml-viewer.html'));

    kgmlWindow.once('ready-to-show', () => {
      kgmlWindow.show();
      // 为KGML工具窗口设置独立菜单
      createToolWindowMenu(kgmlWindow, 'KGML Pathway Viewer');
    });

    kgmlWindow.webContents.openDevTools();

    kgmlWindow.on('closed', () => {
      console.log('KGML Pathway Viewer window closed');
    });

  } catch (error) {
    console.error('Failed to open KGML Pathway Viewer:', error);
  }
}

// Create Evo2 Design Window
function createEvo2Window() {
  try {
    const evo2Window = new BrowserWindow({
      width: 1600,
      height: 1000,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'NVIDIA Evo2 DNA Designer - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    evo2Window.loadFile(path.join(__dirname, 'bioinformatics-tools/evo2-designer.html'));

    evo2Window.once('ready-to-show', () => {
      evo2Window.show();
      // Set specialized menu for Evo2 tool window
      createEvo2WindowMenu(evo2Window);
    });

    evo2Window.webContents.openDevTools();

    evo2Window.on('closed', () => {
      console.log('Evo2 Design window closed');
    });

  } catch (error) {
    console.error('Failed to open Evo2 Design:', error);
  }
}

// Create BLAST+ Installer Window
function createBlastInstallerWindow() {
  try {
    const blastInstallerWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'BLAST+ Tools Installer - Genome AI Studio',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true
    });

    blastInstallerWindow.loadFile(path.join(__dirname, 'blast-installer.html'));

    blastInstallerWindow.once('ready-to-show', () => {
      blastInstallerWindow.show();
      // Set specialized menu for BLAST installer window
      createToolWindowMenu(blastInstallerWindow, 'BLAST+ Installer');
    });

    blastInstallerWindow.on('closed', () => {
      // 清理菜单模板
      toolMenuTemplates.delete(blastInstallerWindow.id);
      
      // 如果关闭的是当前活动窗口，恢复主窗口菜单
      if (currentActiveWindow === blastInstallerWindow) {
        currentActiveWindow = null;
        createMenu(); // 直接调用createMenu()来恢复主窗口菜单
      }
      console.log('BLAST+ Installer window closed');
    });

    console.log('BLAST+ Installer window created');

  } catch (error) {
    console.error('Failed to open BLAST+ Installer:', error);
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

ipcMain.on('open-ensembl-window', () => {
  console.log('IPC: Opening Ensembl window...');
  createEnsemblWindow();
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

ipcMain.on('open-kgml-viewer-window', () => {
  console.log('IPC: Opening KGML Pathway Viewer window...');
  createKGMLViewerWindow();
});

ipcMain.on('open-evo2-window', () => {
  console.log('IPC: Opening Evo2 Design window...');
  createEvo2Window();
});

ipcMain.on('open-blast-installer-window', () => {
  console.log('IPC: Opening BLAST+ Installer window...');
  createBlastInstallerWindow();
});

// IPC handler for BLAST installation check
ipcMain.on('check-blast-installation', (event) => {
  console.log('IPC: Checking BLAST installation...');
  const { exec } = require('child_process');
  
  exec('blastn -version', (error, stdout, stderr) => {
    if (error) {
      event.sender.send('blast-check-result', {
        installed: false,
        message: 'BLAST+ not found or not installed',
        error: error.message
      });
    } else {
      const versionMatch = stdout.match(/blastn: (\d+\.\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : 'Unknown version';
      event.sender.send('blast-check-result', {
        installed: true,
        message: `BLAST+ installed successfully (version ${version})`,
        version: version,
        output: stdout
      });
    }
  });
});

// IPC handler for system requirements check
ipcMain.on('system-requirements-check', (event) => {
  console.log('IPC: Checking system requirements...');
  const os = require('os');
  const { exec } = require('child_process');
  
  const systemInfo = {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    nodeVersion: process.version,
    totalMemory: (os.totalmem() / (1024**3)).toFixed(2) + ' GB',
    freeMemory: (os.freemem() / (1024**3)).toFixed(2) + ' GB',
    cpus: os.cpus().length
  };
  
  // Check disk space
  exec('df -h /', (error, stdout, stderr) => {
    if (!error && stdout) {
      const lines = stdout.split('\n');
      if (lines.length > 1) {
        const diskInfo = lines[1].split(/\s+/);
        systemInfo.diskSpace = {
          total: diskInfo[1],
          used: diskInfo[2],
          available: diskInfo[3],
          usage: diskInfo[4]
        };
      }
    }
    
    event.sender.send('system-requirements-result', {
      systemInfo: systemInfo,
      requirements: {
        minimumMemory: '4 GB',
        recommendedMemory: '8 GB',
        minimumDiskSpace: '1 GB',
        supportedPlatforms: ['Windows', 'macOS', 'Linux']
      },
      status: {
        memoryOk: parseFloat(systemInfo.totalMemory) >= 4,
        platformSupported: ['win32', 'darwin', 'linux'].includes(os.platform())
      }
    });
  });
});

// IPC handler for focusing main window
ipcMain.on('focus-main-window', () => {
  console.log('IPC: Focusing main window...');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    mainWindow.show();
  }
}); 

// ========== PROJECT MANAGER WINDOW ==========

// Create Project Manager Window
function createProjectManagerWindow() {
  try {
    const projectManagerWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      title: 'Project Manager - Genome AI Studio',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      resizable: true,
      minimizable: true,
      maximizable: true,
      show: false
    });
    
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
      const mainWindows = BrowserWindow.getAllWindows().filter(win => 
        win.getTitle().includes('Genome AI Studio') && !win.getTitle().includes('Project Manager')
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
    const projectManagerPath = path.join(__dirname, 'project-manager.html');
    
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
    });
    
    // Handle window closed - revert to main menu
    projectManagerWindow.on('closed', () => {
      console.log('Project Manager window closed - reverting to main menu');
      const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.getTitle().includes('Genome AI Studio') && !win.getTitle().includes('Project Manager')
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
function createProjectManagerMenu(projectManagerWindow) {
  const template = [
    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            projectManagerWindow.webContents.send('menu-new-project');
          }
        },
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(projectManagerWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Genome AI Studio Project Files', extensions: ['prj.GAI'] },
                { name: 'XML Files', extensions: ['xml'] },
                { name: 'Project Files', extensions: ['genomeproj', 'json'] },
                { name: 'All Files', extensions: ['*'] }
              ],
              title: 'Open Project'
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              projectManagerWindow.webContents.send('menu-open-project', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Open Recent',
          submenu: [
            {
              label: 'No Recent Projects',
              enabled: false
            }
            // Recent projects will be dynamically populated
          ]
        },
        { type: 'separator' },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            projectManagerWindow.webContents.send('menu-save-project');
          }
        },
        {
          label: 'Save Project As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            projectManagerWindow.webContents.send('menu-save-project-as');
          }
        },
        {
          label: 'Export Project',
          submenu: [
            {
              label: 'Export as XML',
              click: () => {
                projectManagerWindow.webContents.send('menu-export-xml');
              }
            },
            {
              label: 'Export as JSON',
              click: () => {
                projectManagerWindow.webContents.send('menu-export-json');
              }
            },
            {
              label: 'Export Project Archive',
              click: () => {
                projectManagerWindow.webContents.send('menu-export-archive');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Import Files...',
          accelerator: 'CmdOrCtrl+I',
          click: async () => {
            const result = await dialog.showOpenDialog(projectManagerWindow, {
              properties: ['openFile', 'multiSelections'],
              filters: [
                { name: 'Genome Files', extensions: ['fasta', 'fa', 'fas', 'gff', 'gff3', 'gtf', 'vcf', 'bam', 'sam', 'wig', 'bigwig', 'bed', 'gb', 'gbk', 'gbff'] },
                { name: 'All Files', extensions: ['*'] }
              ],
              title: 'Import Files to Project'
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              projectManagerWindow.webContents.send('menu-import-files', result.filePaths);
            }
          }
        },
        {
          label: 'Import Project...',
          click: async () => {
            const result = await dialog.showOpenDialog(projectManagerWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Project Files', extensions: ['prj.GAI', 'xml', 'json', 'genomeproj'] },
                { name: 'All Files', extensions: ['*'] }
              ],
              title: 'Import Project'
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              projectManagerWindow.webContents.send('menu-import-project', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Close Project',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            projectManagerWindow.webContents.send('menu-close-project');
          }
        },
        {
          label: 'Close Window',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+W' : 'Ctrl+Shift+W',
          click: () => {
            projectManagerWindow.close();
          }
        }
      ]
    },
    
    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            projectManagerWindow.webContents.send('menu-undo');
          }
        },
        {
          label: 'Redo',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+Z' : 'Ctrl+Y',
          click: () => {
            projectManagerWindow.webContents.send('menu-redo');
          }
        },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => {
            projectManagerWindow.webContents.send('menu-cut');
          }
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            projectManagerWindow.webContents.send('menu-copy');
          }
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            projectManagerWindow.webContents.send('menu-paste');
          }
        },
        { type: 'separator' },
        {
          label: 'Select All Files',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            projectManagerWindow.webContents.send('menu-select-all');
          }
        },
        {
          label: 'Clear Selection',
          accelerator: 'Escape',
          click: () => {
            projectManagerWindow.webContents.send('menu-clear-selection');
          }
        },
        { type: 'separator' },
        {
          label: 'Find Files...',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            projectManagerWindow.webContents.send('menu-find-files');
          }
        },
        {
          label: 'Find and Replace...',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            projectManagerWindow.webContents.send('menu-find-replace');
          }
        }
      ]
    },
    
    // View Menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Refresh',
          accelerator: 'F5',
          click: () => {
            projectManagerWindow.webContents.send('menu-refresh');
          }
        },
        { type: 'separator' },
        {
          label: 'View Mode',
          submenu: [
            {
              label: 'Grid View',
              type: 'radio',
              checked: true,
              click: () => {
                projectManagerWindow.webContents.send('menu-view-mode', 'grid');
              }
            },
            {
              label: 'List View',
              type: 'radio',
              click: () => {
                projectManagerWindow.webContents.send('menu-view-mode', 'list');
              }
            },
            {
              label: 'Details View',
              type: 'radio',
              click: () => {
                projectManagerWindow.webContents.send('menu-view-mode', 'details');
              }
            }
          ]
        },
        {
          label: 'Sort By',
          submenu: [
            {
              label: 'Name',
              type: 'radio',
              checked: true,
              click: () => {
                projectManagerWindow.webContents.send('menu-sort-by', 'name');
              }
            },
            {
              label: 'Date Modified',
              type: 'radio',
              click: () => {
                projectManagerWindow.webContents.send('menu-sort-by', 'modified');
              }
            },
            {
              label: 'Size',
              type: 'radio',
              click: () => {
                projectManagerWindow.webContents.send('menu-sort-by', 'size');
              }
            },
            {
              label: 'Type',
              type: 'radio',
              click: () => {
                projectManagerWindow.webContents.send('menu-sort-by', 'type');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Show Hidden Files',
          type: 'checkbox',
          click: (menuItem) => {
            projectManagerWindow.webContents.send('menu-toggle-hidden-files', menuItem.checked);
          }
        },
        {
          label: 'Show File Extensions',
          type: 'checkbox',
          checked: true,
          click: (menuItem) => {
            projectManagerWindow.webContents.send('menu-toggle-file-extensions', menuItem.checked);
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Sidebar',
          accelerator: 'F8',
          click: () => {
            projectManagerWindow.webContents.send('menu-toggle-sidebar');
          }
        },
        {
          label: 'Toggle Details Panel',
          accelerator: 'F9',
          click: () => {
            projectManagerWindow.webContents.send('menu-toggle-details-panel');
          }
        },
        {
          label: 'Toggle Full Screen',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          click: () => {
            const isFullScreen = projectManagerWindow.isFullScreen();
            projectManagerWindow.setFullScreen(!isFullScreen);
          }
        },
        { type: 'separator' },
        {
          label: 'Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Cmd+Alt+I' : 'Ctrl+Shift+I',
          click: () => {
            projectManagerWindow.webContents.toggleDevTools();
          }
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            projectManagerWindow.webContents.reload();
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            projectManagerWindow.webContents.reloadIgnoringCache();
          }
        }
      ]
    },
    
    // Project Menu
    {
      label: 'Project',
      submenu: [
        {
          label: 'Project Properties',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            projectManagerWindow.webContents.send('menu-project-properties');
          }
        },
        {
          label: 'Project Statistics',
          click: () => {
            projectManagerWindow.webContents.send('menu-project-statistics');
          }
        },
        { type: 'separator' },
        {
          label: 'Create Folder',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            projectManagerWindow.webContents.send('menu-create-folder');
          }
        },
        {
          label: 'Organize Files',
          submenu: [
            {
              label: 'Auto-organize by Type',
              click: () => {
                projectManagerWindow.webContents.send('menu-auto-organize');
              }
            },
            {
              label: 'Group by Date',
              click: () => {
                projectManagerWindow.webContents.send('menu-group-by-date');
              }
            },
            {
              label: 'Clean Empty Folders',
              click: () => {
                projectManagerWindow.webContents.send('menu-clean-empty-folders');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Backup Project',
          click: () => {
            projectManagerWindow.webContents.send('menu-backup-project');
          }
        },
        {
          label: 'Restore from Backup',
          click: () => {
            projectManagerWindow.webContents.send('menu-restore-backup');
          }
        },
        { type: 'separator' },
        {
          label: 'Archive Project',
          click: () => {
            projectManagerWindow.webContents.send('menu-archive-project');
          }
        },
        {
          label: 'Delete Project',
          click: () => {
            projectManagerWindow.webContents.send('menu-delete-project');
          }
        }
      ]
    },
    
    // Tools Menu
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Validate Files',
          click: () => {
            projectManagerWindow.webContents.send('menu-validate-files');
          }
        },
        {
          label: 'Find Duplicates',
          click: () => {
            projectManagerWindow.webContents.send('menu-find-duplicates');
          }
        },
        {
          label: 'Check File Integrity',
          click: () => {
            projectManagerWindow.webContents.send('menu-check-integrity');
          }
        },
        { type: 'separator' },
        {
          label: 'Convert Files',
          submenu: [
            {
              label: 'FASTA to GenBank',
              click: () => {
                projectManagerWindow.webContents.send('menu-convert-fasta-genbank');
              }
            },
            {
              label: 'GFF to BED',
              click: () => {
                projectManagerWindow.webContents.send('menu-convert-gff-bed');
              }
            },
            {
              label: 'Custom Conversion...',
              click: () => {
                projectManagerWindow.webContents.send('menu-custom-conversion');
              }
            }
          ]
        },
        {
          label: 'Batch Operations',
          submenu: [
            {
              label: 'Batch Rename',
              click: () => {
                projectManagerWindow.webContents.send('menu-batch-rename');
              }
            },
            {
              label: 'Batch Move',
              click: () => {
                projectManagerWindow.webContents.send('menu-batch-move');
              }
            },
            {
              label: 'Batch Delete',
              click: () => {
                projectManagerWindow.webContents.send('menu-batch-delete');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'System Tools',
          submenu: [
            {
              label: 'Install BLAST+ Tools',
              accelerator: 'CmdOrCtrl+Alt+B',
              click: () => {
                createBlastInstallerWindow();
              }
            },
            {
              label: 'Check BLAST Installation',
              click: () => {
                projectManagerWindow.webContents.send('check-blast-installation');
              }
            },
            {
              label: 'System Requirements Check',
              click: () => {
                projectManagerWindow.webContents.send('system-requirements-check');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'External Tools',
          submenu: [
            {
              label: 'Open in Genome Viewer',
              click: () => {
                projectManagerWindow.webContents.send('menu-open-genome-viewer');
              }
            },
            {
              label: 'Open in External Editor',
              click: () => {
                projectManagerWindow.webContents.send('menu-open-external-editor');
              }
            },
            {
              label: 'Open in File Explorer',
              click: () => {
                projectManagerWindow.webContents.send('menu-open-file-explorer');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,',
          click: () => {
            projectManagerWindow.webContents.send('menu-preferences');
          }
        }
      ]
    },
    
    // Download Menu - copied from main window
    {
      label: '📥 Download',
      submenu: [
        {
          label: 'NCBI Databases',
          click: () => {
            createGenomicDownloadWindow('ncbi-unified');
          }
        },
        {
          label: 'EMBL-EBI Databases',
          click: () => {
            createGenomicDownloadWindow('embl-unified');
          }
        },
        {
          label: 'DDBJ Sequences',
          click: () => {
            createGenomicDownloadWindow('ddbj-sequences');
          }
        },
        {
          label: 'UniProt Proteins',
          click: () => {
            createGenomicDownloadWindow('uniprot-proteins');
          }
        },
        {
          label: 'KEGG Pathways',
          click: () => {
            createGenomicDownloadWindow('kegg-pathways');
          }
        },
        { type: 'separator' },
        {
          label: 'Bulk Download Manager',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            createGenomicDownloadWindow('bulk-manager');
          }
        }
      ]
    },
    
    // Window Menu - cloned from main window
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.close();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Window Layout',
          submenu: [
            {
              label: 'Optimal Layout (Main 75% + Project Manager 25%)',
              accelerator: 'CmdOrCtrl+Alt+L',
              click: () => {
                arrangeWindowsOptimal();
              }
            },
            {
              label: 'Side by Side (50% + 50%)',
              accelerator: 'CmdOrCtrl+Alt+S',
              click: () => {
                arrangeWindowsSideBySide();
              }
            },
            {
              label: 'Main Window Focus',
              accelerator: 'CmdOrCtrl+Alt+M',
              click: () => {
                arrangeMainWindowFocus();
              }
            },
            {
              label: 'Project Manager Focus',
              accelerator: 'CmdOrCtrl+Alt+P',
              click: () => {
                arrangeProjectManagerFocus();
              }
            },
            { type: 'separator' },
            {
              label: 'Stack Vertically',
              click: () => {
                arrangeWindowsVertical();
              }
            },
            {
              label: 'Cascade Windows',
              click: () => {
                arrangeWindowsCascade();
              }
            },
            { type: 'separator' },
            {
              label: 'Reset to Default Positions',
              click: () => {
                resetWindowPositions();
              }
            }
          ]
        },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          {
            label: 'Bring All to Front',
            role: 'front'
          }
        ] : [])
      ]
    },
    
    // Help Menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Project Manager Help',
          accelerator: 'F1',
          click: () => {
            projectManagerWindow.webContents.send('menu-help');
          }
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => {
            projectManagerWindow.webContents.send('menu-keyboard-shortcuts');
          }
        },
        {
          label: 'User Guide',
          click: () => {
            projectManagerWindow.webContents.send('menu-user-guide');
          }
        },
        { type: 'separator' },
        {
          label: 'File Format Support',
          click: () => {
            projectManagerWindow.webContents.send('menu-file-formats');
          }
        },
        {
          label: 'Best Practices',
          click: () => {
            projectManagerWindow.webContents.send('menu-best-practices');
          }
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => {
            projectManagerWindow.webContents.send('menu-report-issue');
          }
        },
        {
          label: 'Send Feedback',
          click: () => {
            projectManagerWindow.webContents.send('menu-send-feedback');
          }
        },
        { type: 'separator' },
        {
          label: 'About Project Manager',
          click: () => {
            projectManagerWindow.webContents.send('menu-about');
          }
        }
      ]
    }
  ];

  // Add platform-specific menu adjustments
  if (process.platform === 'darwin') {
    // macOS specific adjustments
    template.unshift({
      label: app.getName(),
      submenu: [
        {
          label: 'About Project Manager',
          click: () => {
            projectManagerWindow.webContents.send('menu-about');
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'Cmd+,',
          click: () => {
            projectManagerWindow.webContents.send('menu-preferences');
          }
        },
        { type: 'separator' },
        {
          label: 'Hide Project Manager',
          accelerator: 'Cmd+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Cmd+Alt+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Cmd+Q',
          click: () => {
            projectManagerWindow.close();
          }
        }
      ]
    });
  }

  return Menu.buildFromTemplate(template);
}

// ========== PROJECT MANAGER IPC HANDLERS ==========

// Handle project directory selection
ipcMain.handle('selectProjectDirectory', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(null, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Project Location'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle project file selection
ipcMain.handle('selectProjectFile', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(null, {
      properties: ['openFile'],
      filters: [
        { name: 'Genome AI Studio Project Files', extensions: ['prj.GAI'] },
        { name: 'XML Files', extensions: ['xml'] },
        { name: 'Project Files', extensions: ['genomeproj', 'json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Open Project File'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle multiple file selection
ipcMain.handle('selectMultipleFiles', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(null, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Genome Files', extensions: ['fasta', 'fa', 'fas', 'gff', 'gff3', 'gtf', 'vcf', 'bam', 'sam', 'wig', 'bigwig', 'bed', 'gb', 'gbk', 'gbff'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Select Files to Add'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePaths: result.filePaths };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle project creation
ipcMain.handle('createProjectDirectory', async (event, location, projectName) => {
  try {
    const projectPath = path.join(location, projectName);
    
    // Create project directory if it doesn't exist
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }
    
    // Create project subdirectories
    const subdirs = ['genomes', 'annotations', 'variants', 'reads', 'analysis'];
    subdirs.forEach(subdir => {
      const subdirPath = path.join(projectPath, subdir);
      if (!fs.existsSync(subdirPath)) {
        fs.mkdirSync(subdirPath, { recursive: true });
      }
    });
    
    return { success: true, projectPath: projectPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle project file loading
ipcMain.handle('loadProjectFile', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    return { success: true, content: content, fileName: fileName };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle opening file in main window
ipcMain.handle('openFileInMainWindow', async (event, filePath) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('load-file', filePath);
      mainWindow.focus();
      return { success: true, message: 'File opened in main window' };
    } else {
      return { success: false, error: 'Main window not available' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle opening folder in file explorer
ipcMain.handle('openFolderInExplorer', async (event, folderPath) => {
  try {
    const { shell } = require('electron');
    
    // 检查文件夹是否存在
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: 'Folder does not exist' };
    }
    
    // 在资源管理器中打开文件夹
    await shell.openPath(folderPath);
    return { success: true, message: 'Folder opened in explorer' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle moving file within project
ipcMain.handle('moveFileInProject', async (event, currentPath, projectName, targetFolderPath) => {
  try {
    if (!fs.existsSync(currentPath)) {
      return { success: false, error: 'Source file does not exist' };
    }

    // 修正：构建目标路径，不使用额外的data目录
    const documentsPath = app.getPath('documents');
    const projectsDir = path.join(documentsPath, 'GenomeExplorer Projects');
    const targetDir = path.join(projectsDir, projectName, targetFolderPath);
    
    // 确保目标目录存在
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const fileName = path.basename(currentPath);
    const targetPath = path.join(targetDir, fileName);
    
    // 如果目标文件已存在，生成新的文件名
    let finalTargetPath = targetPath;
    let counter = 1;
    while (fs.existsSync(finalTargetPath)) {
      const nameWithoutExt = path.parse(fileName).name;
      const extension = path.parse(fileName).ext;
      finalTargetPath = path.join(targetDir, `${nameWithoutExt}_${counter}${extension}`);
      counter++;
    }
    
    // 移动文件
    fs.renameSync(currentPath, finalTargetPath);
    
    console.log(`✅ File moved from ${currentPath} to ${finalTargetPath}`);
    return { success: true, newPath: finalTargetPath, message: 'File moved successfully' };
  } catch (error) {
    console.error('Error moving file:', error);
    return { success: false, error: error.message };
  }
});

// Handle renaming file within project
ipcMain.handle('renameFileInProject', async (event, currentPath, newFileName) => {
  try {
    if (!fs.existsSync(currentPath)) {
      return { success: false, error: 'Source file does not exist' };
    }

    // 获取文件目录和构建新的文件路径
    const fileDir = path.dirname(currentPath);
    const newFilePath = path.join(fileDir, newFileName);
    
    // 检查新文件名是否已存在
    if (fs.existsSync(newFilePath)) {
      return { success: false, error: 'A file with this name already exists' };
    }
    
    // 验证新文件名是否合法
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(newFileName)) {
      return { success: false, error: 'File name contains invalid characters' };
    }
    
    // 重命名文件
    fs.renameSync(currentPath, newFilePath);
    
    console.log(`✅ File renamed from ${currentPath} to ${newFilePath}`);
    return { 
      success: true, 
      newPath: newFilePath, 
      oldPath: currentPath,
      message: 'File renamed successfully' 
    };
  } catch (error) {
    console.error('Error renaming file:', error);
    return { success: false, error: error.message };
  }
});

// File locking management
const projectFileLocks = new Map();

// Handle project file locking
ipcMain.handle('lockProjectFile', async (event, filePath) => {
  try {
    // 检查文件是否已被锁定
    if (projectFileLocks.has(filePath)) {
      return { 
        success: false, 
        error: 'File is already locked by another instance of Genome AI Studio' 
      };
    }
    
    // 尝试以独占方式打开文件进行测试
    try {
      const lockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 使用fs.open检查文件是否可以独占访问
      const fd = fs.openSync(filePath, 'r+');
      fs.closeSync(fd);
      
      // 创建锁定记录
      projectFileLocks.set(filePath, {
        lockId: lockId,
        lockedAt: new Date().toISOString(),
        processId: process.pid
      });
      
      console.log(`🔒 Project file locked: ${filePath} (ID: ${lockId})`);
      return { success: true, lockId: lockId };
      
    } catch (fileError) {
      if (fileError.code === 'EBUSY' || fileError.code === 'EACCES') {
        return { 
          success: false, 
          error: 'File is currently being used by another application' 
        };
      }
      throw fileError;
    }
    
  } catch (error) {
    console.error('Error locking project file:', error);
    return { 
      success: false, 
      error: `Failed to lock file: ${error.message}` 
    };
  }
});

// Handle project file unlocking
ipcMain.handle('unlockProjectFile', async (event, filePath, lockId) => {
  try {
    const lockInfo = projectFileLocks.get(filePath);
    
    if (!lockInfo) {
      console.warn(`No lock found for file: ${filePath}`);
      return { success: true }; // 文件未锁定，视为成功
    }
    
    if (lockInfo.lockId !== lockId) {
      console.warn(`Lock ID mismatch for file: ${filePath}`);
      return { 
        success: false, 
        error: 'Invalid lock ID' 
      };
    }
    
    // 移除锁定记录
    projectFileLocks.delete(filePath);
    console.log(`🔓 Project file unlocked: ${filePath} (ID: ${lockId})`);
    
    return { success: true };
    
  } catch (error) {
    console.error('Error unlocking project file:', error);
    return { 
      success: false, 
      error: `Failed to unlock file: ${error.message}` 
    };
  }
});

// 应用关闭时清理所有锁定
app.on('before-quit', () => {
  console.log('🔓 Cleaning up all file locks before quit...');
  projectFileLocks.clear();
});

// Handle getting documents path
ipcMain.handle('getDocumentsPath', async () => {
  try {
    return app.getPath('documents');
  } catch (error) {
    console.error('Error getting documents path:', error);
    return null;
  }
});

// Handle creating project folder
ipcMain.handle('createProjectFolder', async (event, projectName, folderName) => {
  try {
    const documentsPath = app.getPath('documents');
    const projectsDir = path.join(documentsPath, 'GenomeExplorer Projects');
    const projectDir = path.join(projectsDir, projectName);
    const folderPath = path.join(projectDir, folderName);
    
    // 确保项目目录存在
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    
    // 创建新文件夹
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`✅ Created project folder: ${folderPath}`);
      return { success: true, folderPath: folderPath };
    } else {
      return { success: false, error: 'Folder already exists' };
    }
    
  } catch (error) {
    console.error('Error creating project folder:', error);
    return { success: false, error: error.message };
  }
});

// Handle projects data saving
ipcMain.handle('saveProjectsData', async (event, projectsData) => {
  try {
    const userDataPath = app.getPath('userData');
    const projectsFilePath = path.join(userDataPath, 'projects.json');
    
    fs.writeFileSync(projectsFilePath, JSON.stringify(projectsData, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle projects data loading
ipcMain.handle('loadProjectsData', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const projectsFilePath = path.join(userDataPath, 'projects.json');
    
    if (fs.existsSync(projectsFilePath)) {
      const data = fs.readFileSync(projectsFilePath, 'utf8');
      return { success: true, data: data };
    } else {
      return { success: true, data: null };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle project settings saving
ipcMain.handle('saveProjectSettings', async (event, settings) => {
  try {
    const userDataPath = app.getPath('userData');
    const settingsFilePath = path.join(userDataPath, 'project-settings.json');
    
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle project settings loading
ipcMain.handle('loadProjectSettings', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const settingsFilePath = path.join(userDataPath, 'project-settings.json');
    
    if (fs.existsSync(settingsFilePath)) {
      const data = fs.readFileSync(settingsFilePath, 'utf8');
      return { success: true, data: data };
    } else {
      return { success: true, data: null };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handler for opening project manager from main window
ipcMain.on('open-project-manager', () => {
  console.log('IPC: Opening Project Manager window...');
  createProjectManagerWindow();
});

// Handle checking main window status
ipcMain.handle('checkMainWindowStatus', async () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Send request to main window to check if it has a file open
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ hasOpenFile: false, error: 'Timeout' });
        }, 1000);

        mainWindow.webContents.once('main-window-status-response', (event, hasOpenFile) => {
          clearTimeout(timeout);
          resolve({ hasOpenFile: hasOpenFile });
        });

        mainWindow.webContents.send('check-file-status');
      });
    } else {
      return { hasOpenFile: false, error: 'Main window not available' };
    }
  } catch (error) {
    return { hasOpenFile: false, error: error.message };
  }
});

// Handle creating new main window with file
ipcMain.handle('createNewMainWindow', async (event, filePath) => {
  try {
    // Create a new main window with identical configuration to the original
    const newMainWindow = new BrowserWindow({
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

    // Set up the new window with same initialization as original main window
    newMainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    // Clear cache aggressively to ensure fresh file loading (same as original)
    newMainWindow.webContents.session.clearCache();
    newMainWindow.webContents.session.clearStorageData();
    
    // Handle multiple reload cycles to ensure proper initialization
    let reloadCount = 0;
    const maxReloads = 1; // Only one reload cycle
    
    newMainWindow.webContents.on('did-finish-load', () => {
      if (reloadCount < maxReloads) {
        console.log(`New window reload cycle ${reloadCount + 1}/${maxReloads}`);
        reloadCount++;
        newMainWindow.webContents.reload();
      } else {
        console.log('New window fully loaded, waiting for complete initialization');
        // Window is fully loaded, wait for DOM and modules to be ready
        setTimeout(() => {
          console.log('Checking if new window is ready for file loading...');
          // Send a test message to verify the window is responsive
          newMainWindow.webContents.send('ping-test');
          
          // Wait a bit more and then send the file
          setTimeout(() => {
            console.log('Sending load-file event to new window with path:', filePath);
            newMainWindow.webContents.send('load-file', filePath);
          }, 500);
        }, 1500); // Extended delay for complete module initialization
      }
    });

    // Show window when ready
    newMainWindow.once('ready-to-show', () => {
      newMainWindow.show();
      // Set focus to new window and ensure proper menu
      newMainWindow.focus();
      currentActiveWindow = newMainWindow;
      createMenu(); // Set main window menu immediately
      console.log('New window shown and focused with main menu set');
    });

    // Open DevTools to debug UI issues (same as original main window)
    newMainWindow.webContents.openDevTools();

    // Handle window focus to manage menu properly
    newMainWindow.on('focus', () => {
      if (currentActiveWindow !== newMainWindow) {
        currentActiveWindow = newMainWindow;
        createMenu(); // Set main window menu when focused
        console.log('New window focused - set main menu');
      }
    });

    // Handle window closed
    newMainWindow.on('closed', () => {
      console.log('New main window closed');
      if (currentActiveWindow === newMainWindow) {
        currentActiveWindow = null;
      }
    });

    return { success: true, message: 'New window created with file' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle scanning project folder for new files and folders
ipcMain.handle('scanProjectFolder', async (event, projectPath, existingFileIds, existingFolderStructure = []) => {
  try {
    if (!fs.existsSync(projectPath)) {
      return { success: false, error: 'Project folder does not exist' };
    }

    const newFiles = [];
    const newFolders = [];
    const discoveredFolderPaths = new Set();
    const existingFolderPaths = new Set();
    
    // Convert existing folder structure to a set of paths for quick lookup
    existingFolderStructure.forEach(folder => {
      if (folder.path && Array.isArray(folder.path)) {
        existingFolderPaths.add(folder.path.join('/'));
      }
    });

    // Helper function to scan directory recursively
    function scanDirectory(dirPath, relativePath = '', currentFolderPath = []) {
      const items = fs.readdirSync(dirPath);
      
      items.forEach(item => {
        const itemPath = path.join(dirPath, item);
        const relativeFilePath = relativePath ? path.join(relativePath, item) : item;
        
        // Skip hidden files, temp files, and system files
        if (item.startsWith('.') || item.startsWith('~') || 
            item.includes('.tmp') || item.includes('.temp') ||
            item.endsWith('.prj.GAI') || item.endsWith('.genomeproj')) {
          return;
        }

        try {
          const stats = fs.statSync(itemPath);
          
          if (stats.isDirectory()) {
            // Process folder
            const newFolderPath = [...currentFolderPath, item.toLowerCase()];
            const folderPathString = newFolderPath.join('/');
            
            // Check if this folder already exists in project
            if (!existingFolderPaths.has(folderPathString) && !discoveredFolderPaths.has(folderPathString)) {
              discoveredFolderPaths.add(folderPathString);
              
              // Create folder object
              newFolders.push({
                name: item,
                icon: getFolderIcon(item),
                path: newFolderPath,
                files: [],
                created: stats.birthtime ? stats.birthtime.toISOString() : new Date().toISOString(),
                custom: true,
                autoDiscovered: true,
                discoveredDate: new Date().toISOString(),
                relativePath: relativeFilePath
              });
            }
            
            // Recursively scan subdirectories
            scanDirectory(itemPath, relativeFilePath, newFolderPath);
            
          } else if (stats.isFile()) {
            // Process file
            const tempId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Check if this file path already exists
            const isDuplicate = existingFileIds.some(existingPath => 
              existingPath === itemPath || existingPath.endsWith(relativeFilePath)
            );
            
            if (!isDuplicate) {
              newFiles.push({
                id: tempId,
                name: item,
                path: itemPath,
                relativePath: relativeFilePath,
                type: getFileTypeFromExtension(item),
                size: stats.size,
                added: new Date().toISOString(),
                modified: stats.mtime.toISOString(),
                folder: currentFolderPath,
                isNewlyScanned: true,
                autoDiscovered: true,
                discoveredDate: new Date().toISOString(),
                metadata: {
                  autoDiscovered: true,
                  discoveredDate: new Date().toISOString(),
                  originalPath: itemPath,
                  fileSystem: {
                    created: stats.birthtime ? stats.birthtime.toISOString() : null,
                    modified: stats.mtime.toISOString(),
                    accessed: stats.atime.toISOString(),
                    size: stats.size
                  }
                }
              });
            }
          }
        } catch (fileError) {
          console.warn(`Error processing ${itemPath}:`, fileError.message);
        }
      });
    }

    // Start scanning from project root
    scanDirectory(projectPath);

    console.log(`📁 Scanned project folder: ${projectPath}`);
    console.log(`🆕 Found ${newFiles.length} new files`);
    console.log(`📂 Found ${newFolders.length} new folders`);

    return { 
      success: true, 
      newFiles: newFiles,
      newFolders: newFolders,
      scannedPath: projectPath,
      totalNewFiles: newFiles.length,
      totalNewFolders: newFolders.length,
      summary: {
        files: newFiles.length,
        folders: newFolders.length,
        total: newFiles.length + newFolders.length
      }
    };

  } catch (error) {
    console.error('Error scanning project folder:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to determine appropriate folder icon based on name
function getFolderIcon(folderName) {
  const name = folderName.toLowerCase();
  const iconMap = {
    'genomes': '🧬',
    'genome': '🧬',
    'annotations': '📋',
    'annotation': '📋',
    'variants': '🔄',
    'variant': '🔄',
    'reads': '📊',
    'read': '📊',
    'analysis': '📈',
    'analyses': '📈',
    'results': '📈',
    'output': '📤',
    'outputs': '📤',
    'input': '📥',
    'inputs': '📥',
    'data': '💾',
    'database': '🗃️',
    'databases': '🗃️',
    'tools': '🔧',
    'scripts': '📝',
    'logs': '📄',
    'temp': '🗂️',
    'tmp': '🗂️',
    'backup': '💾',
    'archive': '📦',
    'downloads': '⬇️',
    'upload': '⬆️',
    'uploads': '⬆️',
    'config': '⚙️',
    'configuration': '⚙️',
    'settings': '⚙️'
  };
  
  // Check for exact matches first
  if (iconMap[name]) {
    return iconMap[name];
  }
  
  // Check for partial matches
  for (const [key, icon] of Object.entries(iconMap)) {
    if (name.includes(key)) {
      return icon;
    }
  }
  
  // Default folder icon
  return '📁';
}

// Helper function to determine file type from extension
function getFileTypeFromExtension(fileName) {
  const ext = fileName.toLowerCase().split('.').pop();
  const typeMap = {
    'fasta': ['fasta', 'fa', 'fas'],
    'gff': ['gff', 'gff3', 'gtf'],
    'vcf': ['vcf'],
    'bam': ['bam', 'sam'],
    'wig': ['wig', 'bw', 'bigwig'],
    'bed': ['bed'],
    'genbank': ['gb', 'gbk', 'gbff'],
    'fastq': ['fastq', 'fq'],
    'txt': ['txt', 'text'],
    'csv': ['csv'],
    'tsv': ['tsv'],
    'json': ['json'],
    'xml': ['xml'],
    'html': ['html', 'htm']
  };

  for (const [type, extensions] of Object.entries(typeMap)) {
    if (extensions.includes(ext)) {
      return type;
    }
  }
  return 'unknown';
}

// Handle file save operations
ipcMain.handle('saveFile', async (event, fileName, content) => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showSaveDialog(null, {
      defaultPath: fileName,
      filters: [
        { name: 'XML Files', extensions: ['xml'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Save Project File'
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { success: true, filePath: result.filePath };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle project file save with path
ipcMain.handle('saveProjectFile', async (event, defaultPath, content) => {
  try {
    const { dialog } = require('electron');
    
    // 确保默认文件名包含.prj.GAI扩展名
    let defaultFileName = defaultPath;
    if (!defaultFileName.endsWith('.prj.GAI')) {
      if (defaultFileName.endsWith('.xml')) {
        defaultFileName = defaultFileName.replace('.xml', '.prj.GAI');
      } else {
        defaultFileName += '.prj.GAI';
      }
    }
    
    const result = await dialog.showSaveDialog(null, {
      defaultPath: defaultFileName,
      filters: [
        { name: 'Genome AI Studio Project Files', extensions: ['prj.GAI'] },
        { name: 'XML Files', extensions: ['xml'] },
        { name: 'Project Files', extensions: ['genomeproj'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Save Project as XML'
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf8');
      console.log(`✅ Project saved as XML: ${result.filePath}`);
      return { success: true, filePath: result.filePath };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    console.error('Error saving project file:', error);
    return { success: false, error: error.message };
  }
});

// Handle creating temporary file
ipcMain.handle('createTempFile', async (event, fileName, content) => {
  try {
    const tempDir = app.getPath('temp');
    const tempFilePath = path.join(tempDir, 'genomeaistudio_temp_' + Date.now() + '_' + fileName);
    
    fs.writeFileSync(tempFilePath, content, 'utf8');
    
    // Schedule file deletion after 5 minutes
    setTimeout(() => {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log('Cleaned up temp file:', tempFilePath);
        }
      } catch (err) {
        console.error('Error cleaning up temp file:', err);
      }
    }, 5 * 60 * 1000);
    
    return { success: true, filePath: tempFilePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle getting file information
ipcMain.handle('getFileInfo', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    
    return {
      success: true,
      info: {
        size: stats.size,
        mtime: stats.mtime.toISOString(),
        name: fileName
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Function to update recent projects menu
function updateRecentProjectsMenu(recentProjects = []) {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;

  const recentProjectsMenuItem = menu.getMenuItemById('recent-projects');
  if (!recentProjectsMenuItem) return;

  // Clear existing submenu
  recentProjectsMenuItem.submenu.clear();

  if (recentProjects.length === 0) {
    recentProjectsMenuItem.submenu.append(new MenuItem({
      label: 'No recent projects',
      enabled: false
    }));
  } else {
    // Add recent projects
    recentProjects.slice(0, 10).forEach((project, index) => {
      recentProjectsMenuItem.submenu.append(new MenuItem({
        label: `${project.name}`,
        accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : undefined,
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('open-recent-project', project);
          }
        }
      }));
    });

    // Add separator and clear menu item
    recentProjectsMenuItem.submenu.append(new MenuItem({ type: 'separator' }));
    recentProjectsMenuItem.submenu.append(new MenuItem({
      label: 'Clear Recent Projects',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('clear-recent-projects');
        }
      }
    }));
  }
}

// Handle updating recent projects menu
ipcMain.handle('updateRecentProjects', async (event, recentProjects) => {
  try {
    updateRecentProjectsMenu(recentProjects);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle copying files to project directory
ipcMain.handle('copyFileToProject', async (event, sourcePath, projectName, folderPath) => {
  try {
    const os = require('os');
    
    // 修正：直接使用项目目录结构，不要额外的data子目录
    const documentsPath = app.getPath('documents');
    const projectsDir = path.join(documentsPath, 'GenomeExplorer Projects');
    const projectDir = path.join(projectsDir, projectName);
    const targetFolderDir = path.join(projectDir, folderPath);
    
    // 确保目录存在
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
    }
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    if (!fs.existsSync(targetFolderDir)) {
      fs.mkdirSync(targetFolderDir, { recursive: true });
    }
    
    // 获取源文件名
    const fileName = path.basename(sourcePath);
    const targetPath = path.join(targetFolderDir, fileName);
    
    // 检查源文件是否存在
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file does not exist: ${sourcePath}`);
    }
    
    // 复制文件
    fs.copyFileSync(sourcePath, targetPath);
    
    console.log(`✅ File copied from ${sourcePath} to ${targetPath}`);
    
    return {
      success: true,
      newPath: targetPath,
      projectDir: projectDir,
      targetFolder: targetFolderDir
    };
    
  } catch (error) {
    console.error('Error copying file to project:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}); 

// Handle creating new project structure
ipcMain.handle('createNewProjectStructure', async (event, location, projectName) => {
  try {
    // 创建项目文件路径和数据文件夹路径
    const projectFilePath = path.join(location, `${projectName}.prj.GAI`);
    const dataFolderPath = path.join(location, projectName);
    
    // 创建数据文件夹和子文件夹
    if (!fs.existsSync(dataFolderPath)) {
      fs.mkdirSync(dataFolderPath, { recursive: true });
    }
    
    // 修正：创建子文件夹结构，使用大写首字母以匹配UI显示
    const subFolders = ['Genomes', 'Annotations', 'Variants', 'Reads', 'Analysis'];
    subFolders.forEach(folderName => {
      const subFolderPath = path.join(dataFolderPath, folderName);
      if (!fs.existsSync(subFolderPath)) {
        fs.mkdirSync(subFolderPath, { recursive: true });
      }
    });
    
    console.log(`✅ Created project structure: ${projectFilePath} and ${dataFolderPath}`);
    
    return {
      success: true,
      projectFilePath: projectFilePath,
      dataFolderPath: dataFolderPath
    };
    
  } catch (error) {
    console.error('Error creating project structure:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Handle saving project to specific file
ipcMain.handle('saveProjectToSpecificFile', async (event, filePath, content) => {
  try {
    // 确保目录存在
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // 写入文件
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Project saved to: ${filePath}`);
    
    return { success: true, filePath: filePath };
    
  } catch (error) {
    console.error('Error saving project to specific file:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Handle save project as (select directory)
ipcMain.handle('saveProjectAs', async (event, defaultProjectName) => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(null, {
      properties: ['openDirectory'],
      title: 'Select Directory to Save Project'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { 
        success: true, 
        selectedDirectory: result.filePaths[0] 
      };
    }
    
    return { success: false, canceled: true };
    
  } catch (error) {
    console.error('Error in save project as dialog:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Handle checking if project exists
ipcMain.handle('checkProjectExists', async (event, directory, projectName) => {
  try {
    const projectFilePath = path.join(directory, `${projectName}.prj.GAI`);
    const dataFolderPath = path.join(directory, projectName);
    
    const fileExists = fs.existsSync(projectFilePath);
    const folderExists = fs.existsSync(dataFolderPath);
    
    return {
      exists: fileExists || folderExists,
      fileExists: fileExists,
      folderExists: folderExists,
      projectFilePath: projectFilePath,
      dataFolderPath: dataFolderPath
    };
    
  } catch (error) {
    console.error('Error checking project exists:', error);
    return { 
      exists: false, 
      error: error.message 
    };
  }
});

// Handle copying project to new location
ipcMain.handle('copyProject', async (event, sourceProjectFile, sourceDataFolder, targetDirectory, projectName) => {
  try {
    const targetProjectFile = path.join(targetDirectory, `${projectName}.prj.GAI`);
    const targetDataFolder = path.join(targetDirectory, projectName);
    
    // 复制项目文件
    if (fs.existsSync(sourceProjectFile)) {
      fs.copyFileSync(sourceProjectFile, targetProjectFile);
      console.log(`✅ Copied project file: ${sourceProjectFile} → ${targetProjectFile}`);
    }
    
    // 复制数据文件夹
    if (fs.existsSync(sourceDataFolder)) {
      await copyDirectoryRecursive(sourceDataFolder, targetDataFolder);
      console.log(`✅ Copied data folder: ${sourceDataFolder} → ${targetDataFolder}`);
    }
    
    return {
      success: true,
      targetProjectFile: targetProjectFile,
      targetDataFolder: targetDataFolder
    };
    
  } catch (error) {
    console.error('Error copying project:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Helper function to copy directory recursively
async function copyDirectoryRecursive(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const items = fs.readdirSync(source);
  
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const targetPath = path.join(target, item);
    
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// Create Genomic Download Window
function createGenomicDownloadWindow(downloadType) {
  try {
    console.log(`Creating Genomic Download window for: ${downloadType}`);
    
    const downloadWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '../assets/icon.png'),
      title: `Download Genomic Data - ${downloadType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      show: false
    });

    // Set menu for the download window - fix the menu creation
    createToolWindowMenu(downloadWindow, 'Genomic Data Download');

    // Create the genomic download HTML file path
    const downloadHtmlPath = path.join(__dirname, 'genomic-data-download.html');
    
    // Check if the file exists, if not create it
    if (!fs.existsSync(downloadHtmlPath)) {
      console.log('Creating genomic-data-download.html file...');
      createGenomicDownloadHTML(downloadHtmlPath);
    }

    downloadWindow.loadFile(downloadHtmlPath);

    downloadWindow.once('ready-to-show', () => {
      downloadWindow.show();
      // Send download type
      downloadWindow.webContents.send('set-download-type', downloadType);
      
      // Try to get project info from Project Manager window first, then fallback to current active project
      const projectManagerWindows = BrowserWindow.getAllWindows().filter(window => 
        window.getTitle().includes('Project Manager')
      );
      
      if (projectManagerWindows.length > 0) {
        console.log('🔍 Found Project Manager window, requesting current project info...');
        // Request current project info from Project Manager
        projectManagerWindows[0].webContents.send('request-current-project-for-download');
        
        // Listen for project info response
        const handleProjectInfo = (event, projectInfo) => {
          console.log('📥 Received project info from Project Manager:', projectInfo);
          downloadWindow.webContents.send('set-active-project', projectInfo);
          // Remove the listener after receiving the response
          ipcMain.removeListener('project-manager-current-project-response', handleProjectInfo);
        };
        
        ipcMain.on('project-manager-current-project-response', handleProjectInfo);
        
        // Fallback timeout - if no response in 1 second, use current active project
        setTimeout(() => {
          ipcMain.removeListener('project-manager-current-project-response', handleProjectInfo);
          const fallbackProject = getCurrentProjectInfo();
          console.log('⏰ Using fallback project info:', fallbackProject);
          downloadWindow.webContents.send('set-active-project', fallbackProject);
        }, 1000);
      } else {
        // No Project Manager window found, use current active project
        const currentProject = getCurrentProjectInfo();
        console.log('📂 Using current active project:', currentProject);
        downloadWindow.webContents.send('set-active-project', currentProject);
      }
    });

    downloadWindow.on('closed', () => {
      console.log('Genomic Download window closed');
    });

    console.log('Genomic Download window created successfully');
    return downloadWindow;
    
  } catch (error) {
    console.error('Failed to create Genomic Download window:', error);
  }
}

// Create the HTML file for genomic data download
function createGenomicDownloadHTML(htmlPath) {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Genomic Data Download</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            text-align: center;
        }
        
        .header h1 {
            margin: 0;
            color: #2c3e50;
            font-size: 2.5em;
            font-weight: 300;
        }
        
        .header p {
            margin: 10px 0 0 0;
            color: #7f8c8d;
            font-size: 1.1em;
        }
        
        .main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .panel {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }
        
        .panel h2 {
            margin-top: 0;
            color: #2c3e50;
            font-size: 1.5em;
            font-weight: 500;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 10px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-label {
            display: block;
            margin-bottom: 8px;
            color: #34495e;
            font-weight: 500;
        }
        
        .form-input, .form-select, .form-textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #ecf0f1;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.3s ease;
            box-sizing: border-box;
        }
        
        .form-input:focus, .form-select:focus, .form-textarea:focus {
            outline: none;
            border-color: #3498db;
        }
        
        .form-textarea {
            min-height: 100px;
            resize: vertical;
        }
        
        .btn {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(52, 152, 219, 0.3);
        }
        
        .btn:active {
            transform: translateY(0);
        }
        
        .btn-success {
            background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
        }
        
        .btn-success:hover {
            box-shadow: 0 6px 20px rgba(39, 174, 96, 0.3);
        }
        
        .btn-secondary {
            background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
        }
        
        .btn-warning {
            background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
        }
        
        .results-panel {
            grid-column: 1 / -1;
            min-height: 300px;
        }
        
        .search-results {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #ecf0f1;
            border-radius: 8px;
            padding: 15px;
            background: #f8f9fa;
        }
        
        .result-item {
            padding: 15px;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            margin-bottom: 10px;
            background: white;
            transition: all 0.3s ease;
        }
        
        .result-item:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .result-title {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        
        .result-details {
            color: #6c757d;
            font-size: 0.9em;
            margin-bottom: 10px;
        }
        
        .result-actions {
            text-align: right;
        }
        
        .download-progress {
            width: 100%;
            height: 20px;
            background: #ecf0f1;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .download-progress-bar {
            height: 100%;
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
            width: 0%;
            transition: width 0.3s ease;
        }
        
        .status-message {
            padding: 12px;
            border-radius: 8px;
            margin: 10px 0;
            font-weight: 500;
        }
        
        .status-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .status-error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .status-info {
            background: #cce7ff;
            color: #0c5460;
            border: 1px solid #b8daff;
        }
        
        .help-text {
            font-size: 0.9em;
            color: #6c757d;
            margin-top: 5px;
        }
        
        .database-info {
            background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .database-info h3 {
            margin: 0 0 10px 0;
            color: #1976d2;
        }
        
        .database-info p {
            margin: 0;
            color: #424242;
            line-height: 1.5;
        }
        
        @media (max-width: 768px) {
            .main-content {
                grid-template-columns: 1fr;
            }
            
            .container {
                padding: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 id="downloadTitle">🧬 Genomic Data Download</h1>
            <p id="downloadDescription">Download genomic data from public databases</p>
        </div>
        
        <div id="databaseInfo" class="database-info">
            <!-- Database-specific information will be loaded here -->
        </div>
        
        <div class="main-content">
            <div class="panel">
                <h2>🔍 Search Parameters</h2>
                <form id="searchForm">
                    <div class="form-group">
                        <label class="form-label">Search Term</label>
                        <input type="text" id="searchTerm" class="form-input" placeholder="e.g., Escherichia coli, NC_000913">
                        <div class="help-text">Enter organism name, accession number, or keywords</div>
                    </div>
                    
                    <div class="form-group" id="databaseSpecificOptions">
                        <!-- Database-specific options will be loaded here -->
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Results Limit</label>
                        <select id="resultsLimit" class="form-select">
                            <option value="10">10 results</option>
                            <option value="25" selected>25 results</option>
                            <option value="50">50 results</option>
                            <option value="100">100 results</option>
                        </select>
                    </div>
                    
                    <button type="submit" class="btn btn-success">🔍 Search Database</button>
                    <button type="button" id="clearBtn" class="btn btn-secondary">🗑️ Clear</button>
                </form>
            </div>
            
            <div class="panel">
                <h2>📁 Download Options</h2>
                <div class="form-group">
                    <label class="form-label">Output Directory</label>
                    <input type="text" id="outputDir" class="form-input" readonly placeholder="Click to select directory">
                    <button type="button" id="selectDirBtn" class="btn" style="margin-top: 10px;">📂 Select Directory</button>
                </div>
                
                <div class="form-group">
                    <label class="form-label">File Format</label>
                    <select id="fileFormat" class="form-select">
                        <option value="fasta">FASTA (.fasta)</option>
                        <option value="genbank">GenBank (.gb)</option>
                        <option value="gff">GFF (.gff)</option>
                        <option value="embl">EMBL (.embl)</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Additional Options</label>
                    <textarea id="additionalOptions" class="form-textarea" placeholder="Additional download parameters..."></textarea>
                </div>
                
                <button type="button" id="downloadSelectedBtn" class="btn btn-success" disabled>📥 Download Selected</button>
                <button type="button" id="downloadAllBtn" class="btn btn-warning" disabled>📥 Download All Results</button>
            </div>
        </div>
        
        <div class="panel results-panel">
            <h2>📊 Search Results</h2>
            <div id="statusMessages"></div>
            <div id="downloadProgress" style="display: none;">
                <div class="download-progress">
                    <div id="progressBar" class="download-progress-bar"></div>
                </div>
                <p id="progressText">Preparing download...</p>
            </div>
            <div id="searchResults" class="search-results">
                <p style="text-align: center; color: #6c757d; padding: 50px;">
                    🔍 Enter search terms and click "Search Database" to find genomic data
                </p>
            </div>
        </div>
    </div>

    <script src="renderer/modules/GenomicDataDownloader.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🚀 DOM loaded, initializing GenomicDataDownloader...');
            if (typeof GenomicDataDownloader !== 'undefined') {
                window.genomicDownloader = new GenomicDataDownloader();
                console.log('✅ GenomicDataDownloader initialized successfully');
            } else {
                console.error('❌ GenomicDataDownloader class not found!');
                console.log('Available in window:', Object.keys(window));
            }
        });
    </script>
</body>
</html>`;

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log('✅ Created genomic-data-download.html');
}

// IPC handlers for genomic data download
ipcMain.handle('selectDirectory', async () => {
  try {
    const result = await dialog.showOpenDialog(null, {
      properties: ['openDirectory'],
      title: 'Select Output Directory'
    });
    
    return {
      success: true,
      canceled: result.canceled,
      filePath: result.canceled ? null : result.filePaths[0]
    };
  } catch (error) {
    console.error('Error selecting directory:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Project management functions for genomic data download
let currentActiveProject = null;

function checkActiveProject() {
  // Check if there's an active project loaded
  return currentActiveProject !== null;
}

function getCurrentProjectInfo() {
  return currentActiveProject;
}

function setActiveProject(projectInfo) {
  currentActiveProject = projectInfo;
  console.log('Active project set:', projectInfo);
}

// IPC handler to get current project info
ipcMain.handle('getCurrentProject', async () => {
  return getCurrentProjectInfo();
});

// IPC handler to set active project
ipcMain.handle('setActiveProject', async (event, projectInfo) => {
  setActiveProject(projectInfo);
  return { success: true };
});

ipcMain.handle('downloadFile', async (event, url, outputPath, projectInfo) => {
  return new Promise((resolve) => {
    try {
      const https = require('https');
      const http = require('http');
      const fs = require('fs');
      const path = require('path');
      
      // If project info is provided, download to project directory
      let finalOutputPath = outputPath;
      if (projectInfo && projectInfo.dataFolderPath) {
        // Create genomes subfolder in project data directory
        const genomesDir = path.join(projectInfo.dataFolderPath, 'genomes');
        if (!fs.existsSync(genomesDir)) {
          fs.mkdirSync(genomesDir, { recursive: true });
        }
        finalOutputPath = path.join(genomesDir, path.basename(outputPath));
      }
      
      // 确保输出目录存在
      const outputDir = path.dirname(finalOutputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // 选择适当的协议
      const client = url.startsWith('https:') ? https : http;
      
      const file = fs.createWriteStream(finalOutputPath);
      
      const request = client.get(url, (response) => {
        // 处理重定向
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          console.log(`Redirecting to: ${redirectUrl}`);
          
          // 递归处理重定向
          const redirectClient = redirectUrl.startsWith('https:') ? https : http;
          const redirectRequest = redirectClient.get(redirectUrl, (redirectResponse) => {
            if (redirectResponse.statusCode === 200) {
              redirectResponse.pipe(file);
              
              file.on('finish', () => {
                file.close();
                console.log(`✅ Downloaded: ${finalOutputPath}`);
                resolve({
                  success: true,
                  filePath: finalOutputPath
                });
              });
            } else {
              file.close();
              fs.unlinkSync(finalOutputPath); // 删除空文件
              resolve({
                success: false,
                error: `HTTP ${redirectResponse.statusCode}: ${redirectResponse.statusMessage}`
              });
            }
          });
          
          redirectRequest.on('error', (error) => {
            file.close();
            fs.unlinkSync(finalOutputPath);
            resolve({
              success: false,
              error: error.message
            });
          });
          
        } else if (response.statusCode === 200) {
          response.pipe(file);
          
          file.on('finish', () => {
            file.close();
            console.log(`✅ Downloaded: ${finalOutputPath}`);
            resolve({
              success: true,
              filePath: finalOutputPath
            });
          });
        } else {
          file.close();
          fs.unlinkSync(finalOutputPath); // 删除空文件
          resolve({
            success: false,
            error: `HTTP ${response.statusCode}: ${response.statusMessage}`
          });
        }
      });
      
      request.on('error', (error) => {
        file.close();
        if (fs.existsSync(finalOutputPath)) {
          fs.unlinkSync(finalOutputPath);
        }
        resolve({
          success: false,
          error: error.message
        });
      });
      
      file.on('error', (error) => {
        file.close();
        if (fs.existsSync(finalOutputPath)) {
          fs.unlinkSync(finalOutputPath);
        }
        resolve({
          success: false,
          error: error.message
        });
      });
      
    } catch (error) {
      console.error('Download error:', error);
      resolve({
        success: false,
        error: error.message
      });
    }
  });
}); 

// ========== WINDOW LAYOUT MANAGEMENT FUNCTIONS ==========

/**
 * 获取主显示器的工作区域
 */
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
  
  const mainWindow = allWindows.find(win => 
    win.getTitle().includes('Genome AI Studio') && 
    !win.getTitle().includes('Project Manager') &&
    !win.isDestroyed()
  );
  
  const projectManagerWindow = allWindows.find(win => 
    win.getTitle().includes('Project Manager') && 
    !win.isDestroyed()
  );
  
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
  const mainWidth = totalWidth - pmWidth;        // Main Window 75%
  
  // 设置主窗口位置和大小
  mainWindow.setBounds({
    x: pmWidth,
    y: 0,
    width: mainWidth,
    height: totalHeight
  });
  
  // 如果Project Manager存在，设置其位置和大小
  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: 0,
      y: 0,
      width: pmWidth,
      height: totalHeight
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
          height: totalHeight
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
    height: workArea.height
  });
  
  // Project Manager左侧50%
  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: 0,
      y: 0,
      width: halfWidth,
      height: workArea.height
    });
  } else {
    const newPMWindow = createProjectManagerWindow();
    if (newPMWindow) {
      newPMWindow.once('ready-to-show', () => {
        newPMWindow.setBounds({
          x: 0,
          y: 0,
          width: halfWidth,
          height: workArea.height
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
    height: workArea.height
  });
  
  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: 0,
      y: 0,
      width: pmWidth,
      height: workArea.height
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
    height: workArea.height
  });
  
  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: 0,
      y: 0,
      width: pmWidth,
      height: workArea.height
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
          height: workArea.height
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
    height: halfHeight
  });
  
  // Project Manager下半部分
  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: 0,
      y: halfHeight,
      width: workArea.width,
      height: halfHeight
    });
  } else {
    const newPMWindow = createProjectManagerWindow();
    if (newPMWindow) {
      newPMWindow.once('ready-to-show', () => {
        newPMWindow.setBounds({
          x: 0,
          y: halfHeight,
          width: workArea.width,
          height: halfHeight
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
    height: windowHeight
  });
  
  // Project Manager偏移位置
  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: offset,
      y: offset,
      width: windowWidth,
      height: windowHeight
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
      height: 800
    });
    mainWindow.center();
  }
  
  if (projectManagerWindow) {
    projectManagerWindow.setBounds({
      x: 150,
      y: 150,
      width: 1200,
      height: 800
    });
    projectManagerWindow.center();
  }
  
  console.log('🔄 Window positions reset to default');
}

// ========== END WINDOW LAYOUT FUNCTIONS ==========

function createMenu() {
  const template = [
    // 添加 Genome AI Studio 品牌菜单项（仅在 macOS 上）
    ...(process.platform === 'darwin' ? [{
      label: 'Genome AI Studio',
      submenu: [
        {
          label: 'About Genome AI Studio',
          click: () => {
            mainWindow.webContents.send('show-about');
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: () => {
            mainWindow.webContents.send('general-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'Hide Genome AI Studio',
          accelerator: 'Cmd+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Cmd+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit Genome AI Studio',
          accelerator: 'Cmd+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // Create Project Manager window and trigger new project creation
            createProjectManagerWindow();
            // Send event to trigger new project modal after window is ready
            setTimeout(() => {
              const projectManagerWindow = BrowserWindow.getAllWindows().find(
                win => win.getTitle().includes('Project Manager')
              );
              if (projectManagerWindow && !projectManagerWindow.isDestroyed()) {
                projectManagerWindow.webContents.send('create-new-project');
              }
            }, 500);
          }
        },
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
          label: 'Project Manager',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            createProjectManagerWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            // Create or focus Project Manager window first
            createProjectManagerWindow();
            
            // Small delay to ensure window is ready
            setTimeout(async () => {
              const result = await dialog.showOpenDialog(null, {
                properties: ['openFile'],
                filters: [
                  { name: 'Genome AI Studio Project Files', extensions: ['prj.GAI'] },
                  { name: 'XML Files', extensions: ['xml'] },
                  { name: 'Project Files', extensions: ['genomeproj', 'json'] },
                  { name: 'All Files', extensions: ['*'] }
                ],
                title: 'Open Project'
              });
              
              if (!result.canceled && result.filePaths.length > 0) {
                // Send the file path to the Project Manager window
                const projectManagerWindow = BrowserWindow.getAllWindows().find(
                  win => win.getTitle().includes('Project Manager')
                );
                if (projectManagerWindow && !projectManagerWindow.isDestroyed()) {
                  projectManagerWindow.webContents.send('load-project-from-menu', result.filePaths[0]);
                }
              }
            }, 100);
          }
        },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('save-current-project');
          }
        },
        {
          label: 'Save Project As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('save-project-as');
          }
        },
        { type: 'separator' },
        {
          label: 'Recent Projects',
          id: 'recent-projects',
          submenu: [
            {
              label: 'No recent projects',
              enabled: false
            }
          ]
        },
        ...(process.platform !== 'darwin' ? [
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ] : [])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            mainWindow.webContents.send('menu-copy');
          }
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            mainWindow.webContents.send('menu-paste');
          }
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            mainWindow.webContents.send('menu-select-all');
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
          accelerator: 'CmdOrCtrl+Shift+A',
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
        },
        { type: 'separator' },
        {
          label: 'Resource Manager',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.send('open-resource-manager');
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
        },
        { type: 'separator' },
        {
          label: 'Circos Genome Plotter',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            createCircosWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Conversation Evolution System',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            createEvolutionWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'CRISPR Guide RNA Design',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => {
            createCrisprDesignerWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Visualization Tools',
          submenu: [
            {
              label: 'KGML Pathway Viewer',
              accelerator: 'CmdOrCtrl+Shift+K',
              click: () => {
                createKGMLViewerWindow();
              }
            },
            { type: 'separator' },
            {
              label: 'Network Graph Viewer',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'network-graph');
              }
            },
            {
              label: 'Protein Interaction Network',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'protein-interaction-network');
              }
            },
            {
              label: 'Gene Regulatory Network',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'gene-regulatory-network');
              }
            },
            {
              label: 'Phylogenetic Tree Viewer',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'phylogenetic-tree');
              }
            },
            {
              label: 'Sequence Alignment Viewer',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'sequence-alignment');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Biological Databases',
          submenu: [
            {
              label: 'KEGG Pathway Analysis',
              accelerator: 'CmdOrCtrl+Shift+K',
              click: () => {
                createKEGGWindow();
              }
            },
            {
              label: 'Gene Ontology (GO) Analyzer',
              accelerator: 'CmdOrCtrl+Alt+G',
              click: () => {
                createGOWindow();
              }
            },
            {
              label: 'UniProt Database Search',
              accelerator: 'CmdOrCtrl+Shift+U',
              click: () => {
                createUniProtWindow();
              }
            },
            {
              label: 'InterPro Domain Analysis',
              accelerator: 'CmdOrCtrl+Shift+I',
              click: () => {
                createInterProWindow();
              }
            },
            {
              label: 'NCBI Database Browser',
              accelerator: 'CmdOrCtrl+Shift+N',
              click: () => {
                createNCBIWindow();
              }
            },
            {
              label: 'Ensembl Genome Browser',
              accelerator: 'CmdOrCtrl+Shift+B',
              click: () => {
                createEnsemblWindow();
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Analysis Tools',
          submenu: [
            {
              label: 'STRING Protein Networks',
              accelerator: 'CmdOrCtrl+Shift+S',
              click: () => {
                createSTRINGWindow();
              }
            },
            {
              label: 'DAVID Functional Analysis',
              accelerator: 'CmdOrCtrl+Shift+D',
              click: () => {
                createDAVIDWindow();
              }
            },
            {
              label: 'Reactome Pathway Browser',
              accelerator: 'CmdOrCtrl+Shift+R',
              click: () => {
                createReactomeWindow();
              }
            },
            {
              label: 'PDB Structure Viewer',
              accelerator: 'CmdOrCtrl+Shift+T',
              click: () => {
                createPDBWindow();
              }
            },
            { type: 'separator' },
            {
              label: 'Evo2 Design',
              accelerator: 'CmdOrCtrl+Shift+E',
              click: () => {
                createEvo2Window();
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'System Tools',
          submenu: [
            {
              label: 'Install BLAST+ Tools',
              accelerator: 'CmdOrCtrl+Alt+B',
              click: () => {
                createBlastInstallerWindow();
              }
            },
            {
              label: 'Check BLAST Installation',
              click: () => {
                mainWindow.webContents.send('check-blast-installation');
              }
            },
            {
              label: 'System Requirements Check',
              click: () => {
                mainWindow.webContents.send('system-requirements-check');
              }
            }
          ]
        }
      ]
    },
    {
      label: 'Options',
      submenu: [
        {
          label: 'Configure LLMs',
          click: () => {
            mainWindow.webContents.send('configure-llms');
          }
        },
        { type: 'separator' },
        {
          label: 'ChatBox Settings',
          click: () => {
            mainWindow.webContents.send('chatbox-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'MCP Server Settings',
          click: () => {
            mainWindow.webContents.send('mcp-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'General Settings',
          click: () => {
            mainWindow.webContents.send('general-settings');
          }
        }
      ]
    },
    {
      label: 'Plugins',
      submenu: [
        {
          label: 'Plugin Management',
          accelerator: 'CmdOrCtrl+Alt+P',
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
        },
        {
          label: 'Plugin Function Calling Test',
          click: () => {
            mainWindow.webContents.send('show-plugin-function-calling-test');
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.close();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Window Layout',
          submenu: [
            {
              label: 'Optimal Layout (Main 75% + Project Manager 25%)',
              accelerator: 'CmdOrCtrl+Alt+L',
              click: () => {
                arrangeWindowsOptimal();
              }
            },
            {
              label: 'Side by Side (50% + 50%)',
              accelerator: 'CmdOrCtrl+Alt+S',
              click: () => {
                arrangeWindowsSideBySide();
              }
            },
            {
              label: 'Main Window Focus',
              accelerator: 'CmdOrCtrl+Alt+M',
              click: () => {
                arrangeMainWindowFocus();
              }
            },
            {
              label: 'Project Manager Focus',
              accelerator: 'CmdOrCtrl+Alt+P',
              click: () => {
                arrangeProjectManagerFocus();
              }
            },
            { type: 'separator' },
            {
              label: 'Stack Vertically',
              click: () => {
                arrangeWindowsVertical();
              }
            },
            {
              label: 'Cascade Windows',
              click: () => {
                arrangeWindowsCascade();
              }
            },
            { type: 'separator' },
            {
              label: 'Reset to Default Positions',
              click: () => {
                resetWindowPositions();
              }
            }
          ]
        },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          {
            label: 'Bring All to Front',
            role: 'front'
          }
        ] : [])
      ]
    },
    {
      label: 'Help',
      submenu: [
        ...(process.platform !== 'darwin' ? [
          {
                      label: 'About Genome AI Studio',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Genome AI Studio',
              message: 'Genome AI Studio v0.2 beta',
                detail: 'A modern AI-powered genome analysis studio built with Electron'
              });
            }
          },
          { type: 'separator' }
        ] : []),
        {
          label: 'User Guide',
          accelerator: 'F1',
          click: () => {
            mainWindow.webContents.send('show-user-guide');
          }
        },
        {
          label: 'Documentation',
          click: () => {
            require('electron').shell.openExternal('https://github.com/Scilence2022/GenomeAIStudio/docs');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            require('electron').shell.openExternal('https://github.com/Scilence2022/GenomeAIStudio/issues');
          }
        }
      ]
    },
    // 添加 Genome AI Studio 品牌菜单项（仅在 macOS 上）
    {
      label: 'Genome AI Studio',
      submenu: [
        {
          label: 'About Genome AI Studio',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Genome AI Studio',
              message: 'Genome AI Studio v0.2 beta',
              detail: 'An intelligent genome analysis platform with AI-powered features.',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        { type: 'separator' },
        {
          label: 'Hide Genome AI Studio',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit Genome AI Studio',
          accelerator: 'Command+Q',
          click: () => app.quit()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}