const { app, BrowserWindow, Menu, MenuItem, dialog, ipcMain } = require('electron');

// Add GPU and WebGL fixes for Windows
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('use-angle', 'gl');
const path = require('path');
const fs = require('fs');
const UnifiedClaudeMCPServer = require('./mcp-server-claude-unified');
const genomeStudioRPC = require('./genome-studio-rpc');
const VERSION_INFO = require('./version');

// Application constants
const APP_NAME = VERSION_INFO.appName;
const PROJECT_DIRECTORY_NAME = 'CodeXomics Projects';

let mainWindow;

// Unified Claude MCP Server
let unifiedMCPServer = null;
let unifiedServerStatus = 'stopped'; // 'stopped', 'starting', 'running', 'stopping'

// 为生物信息学工具窗口创建独立菜单
// 存储各个工具窗口的菜单模板
let toolMenuTemplates = new Map();
let currentActiveWindow = null;

// 为 Circos Genome Plotter 创建专门的菜单系统
function createCircosPlotterMenu(circosWindow) {
  const template = [
    // 添加 CodeXomics 品牌菜单项（仅在 macOS 上）
    ...(process.platform === 'darwin' ? [{
      label: 'CodeXomics',
      submenu: [
        {
          label: 'About Circos Genome Plotter',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'about');
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'preferences');
          }
        },
        { type: 'separator' },
        {
          label: `Hide ${APP_NAME}`,
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
          label: `Quit ${APP_NAME}`,
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
            circosWindow.webContents.send('circos-menu-action', 'new-project');
          }
        },
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(circosWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Circos Project Files', extensions: ['prj.GAI', 'genomeproj'] },
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });

            if (!result.canceled && result.filePaths.length > 0) {
              circosWindow.webContents.send('circos-menu-action', 'open-project', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'save-project');
          }
        },
        {
          label: 'Save Project As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'save-project-as');
          }
        },
        { type: 'separator' },
        {
          label: 'Import Data...',
          submenu: [
            {
              label: 'Genome Sequence (FASTA)',
              click: async () => {
                const result = await dialog.showOpenDialog(circosWindow, {
                  properties: ['openFile'],
                  filters: [
                    { name: 'FASTA Files', extensions: ['fasta', 'fa', 'fas', 'fna'] },
                    { name: 'All Files', extensions: ['*'] }
                  ]
                });
                if (!result.canceled && result.filePaths.length > 0) {
                  circosWindow.webContents.send('circos-menu-action', 'import-fasta', result.filePaths[0]);
                }
              }
            },
            {
              label: 'Annotations (GFF/GFF3)',
              click: async () => {
                const result = await dialog.showOpenDialog(circosWindow, {
                  properties: ['openFile'],
                  filters: [
                    { name: 'GFF Files', extensions: ['gff', 'gff3', 'gtf'] },
                    { name: 'All Files', extensions: ['*'] }
                  ]
                });
                if (!result.canceled && result.filePaths.length > 0) {
                  circosWindow.webContents.send('circos-menu-action', 'import-gff', result.filePaths[0]);
                }
              }
            },
            {
              label: 'GenBank File',
              click: async () => {
                const result = await dialog.showOpenDialog(circosWindow, {
                  properties: ['openFile'],
                  filters: [
                    { name: 'GenBank Files', extensions: ['gb', 'gbk', 'genbank'] },
                    { name: 'All Files', extensions: ['*'] }
                  ]
                });
                if (!result.canceled && result.filePaths.length > 0) {
                  circosWindow.webContents.send('circos-menu-action', 'import-genbank', result.filePaths[0]);
                }
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Export...',
          submenu: [
            {
              label: 'SVG Image',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'export-svg');
              }
            },
            {
              label: 'PNG Image',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'export-png');
              }
            },
            {
              label: 'PDF Document',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'export-pdf');
              }
            },
            { type: 'separator' },
            {
              label: 'Data (JSON)',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'export-data');
              }
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
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'zoom-in');
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'zoom-out');
          }
        },
        {
          label: 'Fit to Window',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'fit-to-window');
          }
        },
        {
          label: 'Reset View',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'reset-view');
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Genes',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'toggle-genes');
          }
        },
        {
          label: 'Data Tracks',
          submenu: [
            {
              label: 'GC Content',
              accelerator: 'CmdOrCtrl+1',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'toggle-gc-content');
              }
            },
            {
              label: 'GC Skew',
              accelerator: 'CmdOrCtrl+2',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'toggle-gc-skew');
              }
            },
            {
              label: 'WIG Data',
              accelerator: 'CmdOrCtrl+3',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'toggle-wig-data');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Refresh',
          accelerator: 'F5',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'refresh');
          }
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Gene Analysis',
          submenu: [
            {
              label: 'Gene Density Analysis',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'gene-density-analysis');
              }
            },
            {
              label: 'Gene Type Distribution',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'gene-type-distribution');
              }
            },
            {
              label: 'Gene Expression Analysis',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'gene-expression-analysis');
              }
            }
          ]
        },
        {
          label: 'Sequence Analysis',
          submenu: [
            {
              label: 'GC Content Analysis',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'gc-content-analysis');
              }
            },
            {
              label: 'Sequence Complexity',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'sequence-complexity');
              }
            },
            {
              label: 'Repeat Analysis',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'repeat-analysis');
              }
            }
          ]
        },
        {
          label: 'Comparative Genomics',
          submenu: [
            {
              label: 'Synteny Analysis',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'synteny-analysis');
              }
            },
            {
              label: 'Ortholog Detection',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'ortholog-detection');
              }
            },
            {
              label: 'Evolutionary Analysis',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'evolutionary-analysis');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'AI Assistant',
          submenu: [
            {
              label: 'Parameter Optimization',
              accelerator: 'CmdOrCtrl+Shift+O',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'ai-optimization');
              }
            },
            {
              label: 'Pattern Recognition',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'pattern-recognition');
              }
            },
            {
              label: 'Automated Insights',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'automated-insights');
              }
            }
          ]
        },
        {
          label: 'Custom Annotations',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'custom-annotations');
          }
        }
      ]
    },
    {
      label: 'Data',
      submenu: [
        {
          label: 'Track Management',
          submenu: [
            {
              label: 'Add Track',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'add-track');
              }
            },
            {
              label: 'Remove Track',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'remove-track');
              }
            },
            {
              label: 'Reorder Tracks',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'reorder-tracks');
              }
            },
            {
              label: 'Track Settings',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'track-settings');
              }
            }
          ]
        },
        {
          label: 'Gene Filtering',
          submenu: [
            {
              label: 'By Type',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'filter-by-type');
              }
            },
            {
              label: 'By Expression',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'filter-by-expression');
              }
            },
            {
              label: 'By Location',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'filter-by-location');
              }
            },
            {
              label: 'Custom Filter',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'custom-filter');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Data Validation',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'data-validation');
          }
        }
      ]
    },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Appearance',
          submenu: [
            {
              label: 'Color Themes',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'color-themes');
              }
            },
            {
              label: 'Track Heights',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'track-heights');
              }
            },
            {
              label: 'Font Settings',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'font-settings');
              }
            }
          ]
        },
        {
          label: 'Performance',
          submenu: [
            {
              label: 'Rendering Mode',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'rendering-mode');
              }
            },
            {
              label: 'Memory Usage',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'memory-usage');
              }
            },
            {
              label: 'Update Frequency',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'update-frequency');
              }
            }
          ]
        },
        {
          label: 'Advanced',
          submenu: [
            {
              label: 'Window Size',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'window-size');
              }
            },
            {
              label: 'Export Quality',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'export-quality');
              }
            },
            {
              label: 'Debug Mode',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'debug-mode');
              }
            }
          ]
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'documentation');
          }
        },
        {
          label: 'Tutorials',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'tutorials');
          }
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+?',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'keyboard-shortcuts');
          }
        },
        { type: 'separator' },
        {
          label: 'About Circos Plotter',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'about');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'report-issue');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

function createToolWindowMenu(toolWindow, toolName) {
  const template = [
    // 添加 CodeXomics 品牌菜单项（仅在 macOS 上）
    ...(process.platform === 'darwin' ? [{
      label: 'CodeXomics',
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
          label: `Hide ${APP_NAME}`,
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
          label: `Quit ${APP_NAME}`,
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
            require('electron').shell.openExternal('https://github.com/Scilence2022/CodeXomics/issues');
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
          label: 'Open Main CodeXomics',
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

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Initialize RPC interface after window is ready
    genomeStudioRPC.setMainWindow(mainWindow);
    genomeStudioRPC.initialize();
  });

  // Open DevTools for debugging (can be disabled in production)
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

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

// Helper function to get the current active main window
function getCurrentMainWindow() {
  // First try to use the tracked current active window
  if (currentActiveWindow && !currentActiveWindow.isDestroyed() &&
    currentActiveWindow.getTitle().includes('CodeXomics') &&
    !currentActiveWindow.getTitle().includes('Project Manager')) {
    return currentActiveWindow;
  }

  // Fall back to the original mainWindow
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  // Last resort: find any main window
  const mainWindows = BrowserWindow.getAllWindows().filter(win =>
    !win.isDestroyed() &&
    win.getTitle().includes('CodeXomics') &&
    !win.getTitle().includes('Project Manager')
  );

  return mainWindows.length > 0 ? mainWindows[0] : null;
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
        url: tool.url
      };

      menuItems.push({
        label: tool.name,
        click: () => {
          createCustomExternalToolWindow(toolData);
        }
      });
    });
  }

  return menuItems;
}

// Create menu
function createMenu() {
  const template = [
    // 添加 CodeXomics 品牌菜单项（仅在 macOS 上）
    ...(process.platform === 'darwin' ? [{
      label: 'CodeXomics',
      submenu: [
        {
          label: 'About CodeXomics',
          click: () => {
            sendToCurrentMainWindow('show-about');
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: () => {
            sendToCurrentMainWindow('general-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'Hide CodeXomics',
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
          label: 'Quit CodeXomics',
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
              sendToCurrentMainWindow('file-opened', result.filePaths[0]);
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
                  { name: 'CodeXomics Project Files', extensions: ['GAI', 'prj.GAI'] },
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
            sendToCurrentMainWindow('save-current-project');
          }
        },
        {
          label: 'Save Project As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            sendToCurrentMainWindow('save-project-as');
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
      label: 'Search && Edit',
      submenu: [
        {
          label: 'Search Sequence',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            sendToCurrentMainWindow('show-search');
          }
        },
        {
          label: 'Go to Position',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            sendToCurrentMainWindow('show-goto');
          }
        },
        { type: 'separator' },
        {
          label: 'Configure Search',
          click: () => {
            sendToCurrentMainWindow('configure-search');
          }
        },
        { type: 'separator' },
        {
          label: 'Search UniProt Database',
          accelerator: 'CmdOrCtrl+Shift+U',
          click: () => {
            createUniProtWindow();
          }
        },
        {
          label: 'Search NCBI Database',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            createNCBIWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            sendToCurrentMainWindow('menu-copy');
          }
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            sendToCurrentMainWindow('menu-paste');
          }
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            sendToCurrentMainWindow('menu-select-all');
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
            sendToCurrentMainWindow('show-panel', 'fileInfoSection');
          }
        },
        {
          label: 'Show Navigation',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            sendToCurrentMainWindow('show-panel', 'navigationSection');
          }
        },
        {
          label: 'Show Statistics',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            sendToCurrentMainWindow('show-panel', 'statisticsSection');
          }
        },
        {
          label: 'Show All Panels',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            sendToCurrentMainWindow('show-all-panels');
          }
        },
        { type: 'separator' },
        {
          label: 'Show Tracks Panel',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            sendToCurrentMainWindow('show-panel', 'tracksSection');
          }
        },
        {
          label: 'Show Features Panel',
          accelerator: 'CmdOrCtrl+5',
          click: () => {
            sendToCurrentMainWindow('show-panel', 'featuresSection');
          }
        },
        { type: 'separator' },
        {
          label: 'Resource Manager',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            sendToCurrentMainWindow('open-resource-manager');
          }
        }
      ]
    },
    {
      label: 'Action',
      submenu: [
        {
          label: 'Copy Sequence',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            sendToCurrentMainWindow('action-copy-sequence');
          }
        },
        {
          label: 'Cut Sequence',
          accelerator: 'CmdOrCtrl+Shift+X',
          click: () => {
            sendToCurrentMainWindow('action-cut-sequence');
          }
        },
        {
          label: 'Paste Sequence',
          accelerator: 'CmdOrCtrl+Shift+V',
          click: () => {
            sendToCurrentMainWindow('action-paste-sequence');
          }
        },
        {
          label: 'Del Sequence',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            sendToCurrentMainWindow('action-delete-sequence');
          }
        },
        {
          label: 'Insert Sequence',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            sendToCurrentMainWindow('action-insert-sequence');
          }
        },
        { type: 'separator' },
        {
          label: 'Show Action List',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => {
            sendToCurrentMainWindow('show-action-list');
          }
        },
        {
          label: 'Execute All Actions',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            sendToCurrentMainWindow('execute-all-actions');
          }
        },
        { type: 'separator' },
        {
          label: 'Create Checkpoint',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            sendToCurrentMainWindow('create-checkpoint');
          }
        },
        {
          label: 'Rollback to Checkpoint',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            sendToCurrentMainWindow('rollback-checkpoint');
          }
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Circos Genome Plotter',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            createCircosWindow();
          }
        },

        { type: 'separator' },
        {
          label: 'KEGG Pathway Enrichment Analysis',
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
          label: 'InterPro Domain Analysis',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            createInterProWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Deep Gene Research',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: async () => {
            await createDeepGeneResearchWindow();
          }
        },
        {
          label: 'CHOPCHOP CRISPR Toolbox',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: async () => {
            await createChopchopWindow();
          }
        },
        {
          label: 'ProGenFixer',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: async () => {
            await createProGenFixerWindow();
          }
        },
        {
          label: 'Download BLAST+ Tools',
          accelerator: 'CmdOrCtrl+Alt+B',
          click: () => {
            createBlastDownloaderWindow();
          }
        },
        {
          label: 'Configure BLAST Tools',
          click: () => {
            createBlastConfigWindow();
          }
        },
        // Add custom external tools dynamically
        ...(global.customExternalTools ? getCustomExternalToolsMenuItems() : []),
        { type: 'separator' },
        {
          label: 'Configure External Tools',
          accelerator: 'CmdOrCtrl+Alt+T',
          click: () => {
            sendToCurrentMainWindow('configure-external-tools');
          }
        }
      ]
    },
    {
      label: 'Options',
      submenu: [
        {
          label: 'Configure LLMs',
          click: () => {
            sendToCurrentMainWindow('configure-llms');
          }
        },
        {
          label: 'Multi-Agent Settings',
          click: () => {
            sendToCurrentMainWindow('multi-agent-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'ChatBox Settings',
          click: () => {
            sendToCurrentMainWindow('chatbox-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'MCP Server Settings',
          click: () => {
            sendToCurrentMainWindow('mcp-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'General Settings',
          click: () => {
            sendToCurrentMainWindow('general-settings');
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
            sendToCurrentMainWindow('show-plugin-management');
          }
        },
        {
          label: 'Plugin Marketplace',
          click: () => {
            sendToCurrentMainWindow('show-plugin-marketplace');
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
            label: `About ${APP_NAME}`,
            click: () => {
              const currentWindow = getCurrentMainWindow();
              dialog.showMessageBox(currentWindow || null, {
                type: 'info',
                title: `About ${APP_NAME}`,
                message: VERSION_INFO.appTitle,
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
            sendToCurrentMainWindow('show-user-guide');
          }
        },
        {
          label: 'Documentation',
          click: () => {
            require('electron').shell.openExternal('https://github.com/Scilence2022/CodeXomics/docs');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            require('electron').shell.openExternal('https://github.com/Scilence2022/CodeXomics/issues');
          }
        }
      ]
    },
    // 添加 CodeXomics 品牌菜单项（仅在 macOS 上）
    {
      label: APP_NAME,
      submenu: [
        {
          label: `About ${APP_NAME}`,
          click: () => {
            const currentWindow = getCurrentMainWindow();
            dialog.showMessageBox(currentWindow || null, {
              type: 'info',
              title: `About ${APP_NAME}`,
              message: VERSION_INFO.appTitle,
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
          label: `Hide ${APP_NAME}`,
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
          label: `Quit ${APP_NAME}`,
          accelerator: 'Command+Q',
          click: () => app.quit()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Function to set up environment variables for system command execution
function setupEnvironmentVariables() {
  console.log('Setting up environment variables for system command execution...');

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
    '/opt/blast+/bin'
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
    console.log('Added BLAST+ paths to environment:', additionalPaths);
  }

  // Set BLASTDB environment variable if not already set
  if (!process.env.BLASTDB) {
    const blastDbPath = path.join(homeDir, 'blast', 'db');
    process.env.BLASTDB = blastDbPath;
    console.log('Set BLASTDB environment variable:', blastDbPath);
  }

  // Log current environment for debugging
  console.log('Current PATH:', process.env.PATH);
  console.log('Current BLASTDB:', process.env.BLASTDB);
}

// App event listeners
app.whenReady().then(() => {
  // Set up environment variables for system command execution
  setupEnvironmentVariables();

  // Check if app was launched with --open-project argument
  const args = process.argv.slice(1);
  const openProjectIndex = args.indexOf('--open-project');
  let projectToOpen = null;

  if (openProjectIndex !== -1 && args[openProjectIndex + 1]) {
    projectToOpen = args[openProjectIndex + 1];
    console.log('📂 App launched with project file:', projectToOpen);
  }

  createWindow();
  createMenu();

  // If a project file was specified, open Project Manager with that project
  if (projectToOpen) {
    setTimeout(() => {
      const pmWindow = createProjectManagerWindow();
      if (pmWindow) {
        pmWindow.webContents.once('did-finish-load', () => {
          pmWindow.webContents.send('menu-open-project', projectToOpen);
          console.log('✅ Sent open-project command to Project Manager');
        });
      }
    }, 1000);
  }

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

// Clean up Unified MCP server when app is quitting
app.on('before-quit', async () => {
  // Clean up Unified Claude MCP server
  if (unifiedMCPServer) {
    console.log('Shutting down Unified Claude MCP Server...');
    try {
      await unifiedMCPServer.stop();
      unifiedMCPServer = null;
      unifiedServerStatus = 'stopped';
    } catch (error) {
      console.error('Error stopping Unified Claude MCP Server:', error);
    }
  }
});

// CRITICAL: IPC handler for MCP tool execution
// This is the missing bridge between MCP server and renderer process
ipcMain.on('tool-execution', async (event, data) => {
  console.log('🔧 [Main] Received tool execution request:', data);
  const { requestId, toolName, parameters, clientId } = data;

  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error('Main window not available for tool execution');
    }

    // Forward the tool execution request to the renderer process
    console.log('📡 [Main] Forwarding tool execution to renderer:', toolName);
    mainWindow.webContents.send('execute-tool-request', {
      requestId,
      toolName,
      parameters,
      clientId
    });

  } catch (error) {
    console.error('❌ [Main] Tool execution forwarding failed:', error);
    // Send error response back to MCP server
    event.sender.send('tool-response', {
      requestId,
      success: false,
      error: error.message
    });
  }
});

// IPC handler for tool execution responses from renderer
ipcMain.on('tool-response', (event, response) => {
  console.log('📨 [Main] Received tool response from renderer:', response);
  // Forward the response back to MCP server
  if (unifiedMCPServer && unifiedMCPServer.handleToolResponse) {
    unifiedMCPServer.handleToolResponse(response);
  }
});

// ===== Plugin Path Resolution IPC Handlers =====
/**
 * Get plugin paths for both built-in and user-installed plugins
 * Returns different paths based on whether app is packaged
 */
ipcMain.handle('get-plugin-paths', async () => {
  const isDevelopment = !app.isPackaged;

  let builtinPluginsPath;
  let userPluginsPath;

  if (isDevelopment) {
    // Development: use source directory
    builtinPluginsPath = path.join(__dirname, 'renderer', 'modules', 'Plugins');
    userPluginsPath = path.join(__dirname, 'renderer', 'modules', 'Plugins', 'UserInstalled');
  } else {
    // Production: builtin plugins are in ASAR, user plugins in userData
    builtinPluginsPath = path.join(process.resourcesPath, 'app.asar', 'src', 'renderer', 'modules', 'Plugins');
    userPluginsPath = path.join(app.getPath('userData'), 'plugins');
  }

  return {
    isDevelopment,
    builtinPluginsPath,
    userPluginsPath
  };
});

/**
 * Ensure a directory exists, creating it if necessary
 */
ipcMain.handle('ensure-directory', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log('Created directory:', dirPath);
    }
    return { success: true, path: dirPath };
  } catch (error) {
    console.error('Failed to create directory:', error);
    return { success: false, error: error.message };
  }
});

/**
 * List all plugins in a given directory
 */
ipcMain.handle('list-plugins', async (event, pluginPath) => {
  try {
    if (!fs.existsSync(pluginPath)) {
      return { success: true, plugins: [] };
    }

    const items = fs.readdirSync(pluginPath, { withFileTypes: true });
    const plugins = items
      .filter(item => item.isDirectory())
      .map(item => ({
        id: item.name,
        path: path.join(pluginPath, item.name),
        hasManifest: fs.existsSync(path.join(pluginPath, item.name, 'plugin.json'))
      }));

    return { success: true, plugins };
  } catch (error) {
    console.error('Failed to list plugins:', error);
    return { success: false, error: error.message, plugins: [] };
  }
});

/**
 * Select plugin file for manual installation
 */
ipcMain.handle('select-plugin-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Plugin File or Directory',
    properties: ['openFile', 'openDirectory'],
    filters: [
      { name: 'Plugin Files', extensions: ['js', 'zip'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

/**
 * Get plugin file information
 */
ipcMain.handle('get-plugin-file-info', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      exists: true,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      size: stats.size,
      modified: stats.mtime
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
});

/**
 * Read plugin file content
 */
ipcMain.handle('read-plugin-file', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read plugin file: ${error.message}`);
  }
});

/**
 * Check if file exists
 */
ipcMain.handle('check-file-exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

/**
 * Scan plugin directory for all plugin files
 * Looks for both directories with plugin.json and standalone .js files
 */
ipcMain.handle('scan-plugin-directory', async () => {
  try {
    const paths = await (async () => {
      const isDevelopment = !app.isPackaged;
      if (isDevelopment) {
        return {
          isDevelopment,
          builtinPluginsPath: path.join(__dirname, 'renderer', 'modules', 'Plugins'),
          userPluginsPath: path.join(__dirname, 'renderer', 'modules', 'Plugins', 'UserInstalled')
        };
      } else {
        return {
          isDevelopment,
          builtinPluginsPath: path.join(process.resourcesPath, 'app.asar', 'src', 'renderer', 'modules', 'Plugins'),
          userPluginsPath: path.join(app.getPath('userData'), 'plugins')
        };
      }
    })();

    const plugins = [];

    // Scan both plugin directories
    const dirsToScan = [
      { path: paths.builtinPluginsPath, type: 'builtin' },
      { path: paths.userPluginsPath, type: 'user' }
    ];

    for (const dirInfo of dirsToScan) {
      if (!fs.existsSync(dirInfo.path)) {
        continue;
      }

      const items = fs.readdirSync(dirInfo.path, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirInfo.path, item.name);

        // Check for plugin directories with plugin.json
        if (item.isDirectory()) {
          const manifestPath = path.join(itemPath, 'plugin.json');
          if (fs.existsSync(manifestPath)) {
            try {
              const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
              plugins.push({
                id: manifest.id || item.name,
                name: manifest.name || item.name,
                description: manifest.description || 'No description available',
                version: manifest.version || '1.0.0',
                author: manifest.author || 'Unknown',
                category: manifest.category || 'general',
                type: dirInfo.type,
                file: item.name,
                path: itemPath,
                hasManifest: true,
                functions: manifest.functions || [],
                main: manifest.main || 'index.js'
              });
            } catch (error) {
              console.error(`Failed to parse manifest for ${item.name}:`, error);
            }
          }
        }
        // Check for standalone .js files that might be plugins
        else if (item.isFile() && item.name.endsWith('.js') && item.name !== 'index.js') {
          try {
            // Read first few lines to check for plugin metadata
            const content = fs.readFileSync(itemPath, 'utf8');
            const lines = content.split('\n').slice(0, 50);

            // Look for plugin metadata in comments or class definition
            let pluginName = item.name.replace('.js', '');
            let pluginDescription = 'JavaScript plugin file';
            let pluginVersion = '1.0.0';
            let pluginAuthor = 'Unknown';

            // Try to extract metadata from comments
            for (const line of lines) {
              const nameMatch = line.match(/@name\s+(.+)/);
              const descMatch = line.match(/@description\s+(.+)/);
              const versionMatch = line.match(/@version\s+(.+)/);
              const authorMatch = line.match(/@author\s+(.+)/);

              if (nameMatch) pluginName = nameMatch[1].trim();
              if (descMatch) pluginDescription = descMatch[1].trim();
              if (versionMatch) pluginVersion = versionMatch[1].trim();
              if (authorMatch) pluginAuthor = authorMatch[1].trim();
            }

            plugins.push({
              id: item.name.replace('.js', ''),
              name: pluginName,
              description: pluginDescription,
              version: pluginVersion,
              author: pluginAuthor,
              category: 'general',
              type: dirInfo.type,
              file: item.name,
              path: itemPath,
              hasManifest: false,
              isStandalone: true
            });
          } catch (error) {
            console.error(`Failed to read plugin file ${item.name}:`, error);
          }
        }
      }
    }

    return {
      success: true,
      plugins,
      paths: {
        builtinPluginsPath: paths.builtinPluginsPath,
        userPluginsPath: paths.userPluginsPath
      }
    };
  } catch (error) {
    console.error('Failed to scan plugin directory:', error);
    return {
      success: false,
      error: error.message,
      plugins: []
    };
  }
});

/**
 * Load detailed metadata for a specific plugin
 */
ipcMain.handle('load-plugin-metadata', async (event, pluginPath) => {
  try {
    const stats = fs.statSync(pluginPath);

    if (stats.isDirectory()) {
      // Try to load plugin.json
      const manifestPath = path.join(pluginPath, 'plugin.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return { success: true, metadata: manifest };
      }

      // Try to load from package.json
      const packagePath = path.join(pluginPath, 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        return {
          success: true,
          metadata: {
            id: pkg.name,
            name: pkg.name,
            description: pkg.description || 'No description',
            version: pkg.version,
            author: pkg.author || 'Unknown',
            main: pkg.main || 'index.js'
          }
        };
      }
    } else if (stats.isFile() && pluginPath.endsWith('.js')) {
      // Parse JavaScript file for metadata
      const content = fs.readFileSync(pluginPath, 'utf8');
      const lines = content.split('\n');

      const metadata = {
        id: path.basename(pluginPath, '.js'),
        name: path.basename(pluginPath, '.js'),
        description: 'No description',
        version: '1.0.0',
        author: 'Unknown',
        functions: []
      };

      // Extract metadata from JSDoc comments
      for (let i = 0; i < Math.min(100, lines.length); i++) {
        const line = lines[i];
        if (line.includes('@name')) metadata.name = line.split('@name')[1].trim();
        if (line.includes('@description')) metadata.description = line.split('@description')[1].trim();
        if (line.includes('@version')) metadata.version = line.split('@version')[1].trim();
        if (line.includes('@author')) metadata.author = line.split('@author')[1].trim();
      }

      // Try to extract function names
      const functionMatches = content.match(/(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function|(?:async\s+)?(\w+)\s*\(/g);
      if (functionMatches) {
        metadata.functions = functionMatches.map(match => {
          const name = match.match(/\w+/g)[match.includes('function') ? 1 : 0];
          return { name };
        });
      }

      return { success: true, metadata };
    }

    return {
      success: false,
      error: 'Not a valid plugin file or directory'
    };
  } catch (error) {
    console.error('Failed to load plugin metadata:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Extract plugin zip file
 */
ipcMain.handle('extract-plugin-zip', async (event, zipPath) => {
  try {
    // Create temp directory for extraction
    const tempDir = path.join(app.getPath('temp'), `plugin-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Note: This is a placeholder - you'll need to add a zip extraction library
    // For now, return error indicating zip extraction not implemented
    return {
      success: false,
      error: 'ZIP extraction not yet implemented. Please extract manually and select the plugin directory.'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Copy plugin directory
 */
ipcMain.handle('copy-plugin-directory', async (event, sourcePath, destPath) => {
  try {
    // Recursive directory copy
    const copyRecursive = (src, dest) => {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }

      const entries = fs.readdirSync(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };

    copyRecursive(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    console.error('Failed to copy plugin directory:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Copy single plugin file
 */
ipcMain.handle('copy-plugin-file', async (event, sourcePath, destPath) => {
  try {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Write plugin file (for creating manifests, etc.)
 */
ipcMain.handle('write-plugin-file', async (event, filePath, content) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Write complete plugin package to disk
 * Handles both JSON (mock packages) and ZIP (real packages) data
 */
ipcMain.handle('write-plugin-files', async (event, options) => {
  const { pluginId, installPath, data, manifest } = options;

  console.log(`[Main] Writing plugin files for ${pluginId} to ${installPath}`);

  try {
    // Create plugin directory if it doesn't exist
    if (!fs.existsSync(installPath)) {
      fs.mkdirSync(installPath, { recursive: true });
      console.log(`[Main] Created plugin directory: ${installPath}`);
    }

    // Write manifest file (plugin.json)
    const manifestPath = path.join(installPath, 'plugin.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`[Main] Wrote manifest to: ${manifestPath}`);

    // Handle the plugin data
    if (data) {
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'number') {
        // Binary data sent as byte array - could be a ZIP file
        const zipPath = path.join(installPath, `${pluginId}.zip`);
        const buffer = Buffer.from(data);
        fs.writeFileSync(zipPath, buffer);
        console.log(`[Main] Wrote ZIP file (${buffer.length} bytes): ${zipPath}`);

        // Try to extract the ZIP file using native zlib if it's a valid zip
        try {
          const AdmZip = require('adm-zip');
          const zip = new AdmZip(buffer);
          zip.extractAllTo(installPath, true);
          // Remove the zip file after extraction
          fs.unlinkSync(zipPath);
          console.log(`[Main] Extracted ZIP file to ${installPath}`);
        } catch (extractError) {
          // If adm-zip is not available or extraction fails, keep the ZIP for manual extraction
          console.log(`[Main] ZIP extraction not available, keeping ZIP file: ${extractError.message}`);
        }

      } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        // Binary data (ArrayBuffer/TypedArray) - should not normally reach here after IPC
        const zipPath = path.join(installPath, `${pluginId}.zip`);
        const buffer = Buffer.from(data);
        fs.writeFileSync(zipPath, buffer);
        console.log(`[Main] Wrote binary data (${buffer.length} bytes): ${zipPath}`);

      } else if (typeof data === 'object' && !Array.isArray(data)) {
        // JSON package (mock package with files object)
        for (const [filename, content] of Object.entries(data)) {
          const filePath = path.join(installPath, filename);
          const fileDir = path.dirname(filePath);

          if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
          }

          // Handle different content types
          if (typeof content === 'string') {
            fs.writeFileSync(filePath, content, 'utf8');
          } else if (typeof content === 'object') {
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
          }

          console.log(`[Main] Wrote file: ${filePath}`);
        }
      }
    }

    // Create an index.js entry point if not provided
    const indexPath = path.join(installPath, 'index.js');
    if (!fs.existsSync(indexPath)) {
      const defaultIndex = `// Plugin: ${pluginId}\n// Auto-generated entry point\nmodule.exports = ${JSON.stringify(manifest, null, 2)};\n`;
      fs.writeFileSync(indexPath, defaultIndex, 'utf8');
      console.log(`[Main] Created default index.js`);
    }

    console.log(`[Main] Plugin ${pluginId} installed successfully to ${installPath}`);

    return {
      success: true,
      installPath,
      files: fs.readdirSync(installPath)
    };

  } catch (error) {
    console.error(`[Main] Failed to write plugin files for ${pluginId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Load plugin from disk for restoration
 */
ipcMain.handle('load-plugin-from-disk', async (event, options) => {
  const { pluginId, installPath } = options;

  console.log(`[Main] Loading plugin ${pluginId} from ${installPath}`);

  try {
    // Check if plugin directory exists
    if (!fs.existsSync(installPath)) {
      return {
        success: false,
        error: `Plugin directory not found: ${installPath}`
      };
    }

    // Read manifest
    const manifestPath = path.join(installPath, 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      return {
        success: false,
        error: `Plugin manifest not found: ${manifestPath}`
      };
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // List all files in plugin directory
    const files = fs.readdirSync(installPath);

    // Read index.js if exists
    let indexContent = null;
    const indexPath = path.join(installPath, 'index.js');
    if (fs.existsSync(indexPath)) {
      indexContent = fs.readFileSync(indexPath, 'utf8');
    }

    console.log(`[Main] Loaded plugin ${pluginId} with ${files.length} files`);

    return {
      success: true,
      pluginId,
      manifest,
      files,
      indexContent,
      installPath
    };

  } catch (error) {
    console.error(`[Main] Failed to load plugin ${pluginId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Delete plugin files from disk (for uninstallation)
 */
ipcMain.handle('delete-plugin-files', async (event, options) => {
  const { pluginId, installPath } = options;

  console.log(`[Main] Deleting plugin ${pluginId} from ${installPath}`);

  try {
    // Check if plugin directory exists
    if (!fs.existsSync(installPath)) {
      console.log(`[Main] Plugin directory doesn't exist, nothing to delete: ${installPath}`);
      return {
        success: true,
        message: 'Plugin directory already deleted'
      };
    }

    // Recursively delete the plugin directory
    const deleteRecursive = (dirPath) => {
      if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
          const curPath = path.join(dirPath, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            deleteRecursive(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(dirPath);
      }
    };

    deleteRecursive(installPath);

    console.log(`[Main] Deleted plugin directory: ${installPath}`);

    return {
      success: true,
      pluginId,
      deletedPath: installPath
    };

  } catch (error) {
    console.error(`[Main] Failed to delete plugin ${pluginId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
});
// ===== End Plugin File Loading Handlers =====

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

// Handle save dialog requests
ipcMain.handle('show-save-dialog', async (event, options) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
  } catch (error) {
    console.error('Error showing save dialog:', error);
    return { canceled: true, error: error.message };
  }
});

// Handle direct file write requests
ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    const path = require('path');

    // Ensure directory exists
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(filePath, content, 'utf8');

    // Verify file was written
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ File written successfully: ${filePath} (${stats.size} bytes)`);
      return {
        success: true,
        filePath: filePath,
        fileName: path.basename(filePath),
        fileSize: stats.size
      };
    } else {
      throw new Error('File was not created successfully');
    }
  } catch (error) {
    console.error('Error writing file:', error);
    return { success: false, error: error.message };
  }
});

// BAM file handling has been moved to renderer process using direct @gmod/bam API
// This eliminates IPC overhead and provides better performance
// The BamReader class in renderer/modules/BamReader.js now handles all BAM operations directly

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

// ===== Gene Attachments IPC Handlers =====

/**
 * Open file selection dialog for gene attachments
 */
ipcMain.handle('select-attachment-files', async (event, options = {}) => {
  try {
    const { dialog } = require('electron');

    const result = await dialog.showOpenDialog(null, {
      title: options.title || 'Select Attachment Files',
      filters: options.filters || [
        { name: 'All Supported Files', extensions: ['pdf', 'md', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'json', 'html'] },
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg'] },
        { name: 'Data Files', extensions: ['csv', 'json', 'xls', 'xlsx'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: options.properties || ['openFile', 'multiSelections']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return {
      success: true,
      filePaths: result.filePaths,
      fileCount: result.filePaths.length
    };

  } catch (error) {
    console.error('Error selecting attachment files:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Copy a file to the attachments storage location
 */
ipcMain.handle('copy-attachment-file', async (event, sourcePath, targetDir, filename) => {
  try {
    // Validate source file exists
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Source file does not exist' };
    }

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Determine target path
    const targetFilename = filename || path.basename(sourcePath);
    const targetPath = path.join(targetDir, targetFilename);

    // Copy file
    fs.copyFileSync(sourcePath, targetPath);

    // Get file info
    const stats = fs.statSync(targetPath);

    console.log(`📎 Attachment copied: ${sourcePath} -> ${targetPath}`);

    return {
      success: true,
      targetPath: targetPath,
      filename: targetFilename,
      size: stats.size
    };

  } catch (error) {
    console.error('Error copying attachment file:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Delete an attachment file
 */
ipcMain.handle('delete-attachment-file', async (event, filePath) => {
  try {
    if (!filePath) {
      return { success: false, error: 'File path is required' };
    }

    if (!fs.existsSync(filePath)) {
      console.log(`Attachment file does not exist, skipping deletion: ${filePath}`);
      return { success: true, message: 'File does not exist' };
    }

    fs.unlinkSync(filePath);
    console.log(`🗑️ Attachment deleted: ${filePath}`);

    return { success: true, message: 'Attachment deleted successfully' };

  } catch (error) {
    console.error('Error deleting attachment file:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Open an attachment file in the system's default application
 */
ipcMain.handle('open-attachment-file', async (event, filePath) => {
  try {
    if (!filePath) {
      return { success: false, error: 'File path is required' };
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist' };
    }

    const { shell } = require('electron');
    await shell.openPath(filePath);

    console.log(`📂 Opened attachment: ${filePath}`);
    return { success: true };

  } catch (error) {
    console.error('Error opening attachment file:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Get the base storage path for gene attachments
 */
ipcMain.handle('get-attachments-storage-path', async (event) => {
  try {
    // Use app's user data directory for attachments storage
    const userDataPath = app.getPath('userData');
    const attachmentsPath = path.join(userDataPath, 'gene_attachments');

    // Ensure directory exists
    if (!fs.existsSync(attachmentsPath)) {
      fs.mkdirSync(attachmentsPath, { recursive: true });
    }

    return {
      success: true,
      path: attachmentsPath
    };

  } catch (error) {
    console.error('Error getting attachments storage path:', error);
    return { success: false, error: error.message };
  }
});

// ===== Utility Tools IPC Handlers =====

/**
 * Download a file from the internet to a local path

 */
ipcMain.handle('download-internet-file', async (event, options) => {
  const { url, destinationPath, filename } = options;

  try {
    console.log(`📥 [Download] Starting download from: ${url}`);

    // Validate URL
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Invalid URL provided' };
    }

    // Parse URL to get protocol and filename
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? require('https') : require('http');

    // Determine filename from URL if not provided
    const extractedFilename = filename || path.basename(urlObj.pathname) || 'downloaded_file';

    // Determine destination directory
    let destDir = destinationPath;
    if (!destDir) {
      // Default to Downloads folder in user's home directory
      destDir = path.join(app.getPath('downloads'));
    }

    // Ensure destination directory exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const fullPath = path.join(destDir, extractedFilename);

    return new Promise((resolve) => {
      const file = fs.createWriteStream(fullPath);

      const request = protocol.get(url, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`📥 [Download] Following redirect to: ${response.headers.location}`);
          file.close();
          fs.unlinkSync(fullPath);

          // Recursively follow redirect
          ipcMain.emit('download-internet-file', event, {
            url: response.headers.location,
            destinationPath,
            filename
          });
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(fullPath);
          resolve({
            success: false,
            error: `HTTP Error: ${response.statusCode} ${response.statusMessage}`
          });
          return;
        }

        const contentLength = parseInt(response.headers['content-length'], 10);
        let downloadedBytes = 0;

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (contentLength) {
            const progress = Math.round((downloadedBytes / contentLength) * 100);
            // Send progress to renderer if needed
            event.sender.send('download-progress', {
              url,
              progress,
              downloadedBytes,
              totalBytes: contentLength
            });
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          const stats = fs.statSync(fullPath);
          console.log(`✅ [Download] Completed: ${fullPath} (${stats.size} bytes)`);
          resolve({
            success: true,
            filePath: fullPath,
            filename: extractedFilename,
            fileSize: stats.size,
            url: url
          });
        });
      });

      request.on('error', (error) => {
        file.close();
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        console.error(`❌ [Download] Error:`, error);
        resolve({ success: false, error: error.message });
      });

      request.setTimeout(60000, () => {
        request.destroy();
        file.close();
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        resolve({ success: false, error: 'Download timeout (60 seconds)' });
      });
    });

  } catch (error) {
    console.error(`❌ [Download] Error:`, error);
    return { success: false, error: error.message };
  }
});

/**
 * Open a markdown file in a dedicated viewer window
 */
ipcMain.handle('open-markdown-viewer', async (event, options) => {
  const { filePath, title } = options;

  try {
    console.log(`📄 [Markdown Viewer] Opening: ${filePath}`);

    // Validate file path
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'Invalid file path provided' };
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.md' && ext !== '.markdown') {
      console.warn(`⚠️ [Markdown Viewer] File is not a markdown file: ${ext}`);
    }

    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    const windowTitle = title || `${fileName} - Markdown Viewer`;

    // Create viewer window
    const viewerWindow = new BrowserWindow({
      width: 900,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      title: windowTitle,
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      resizable: true,
      minimizable: true,
      maximizable: true,
      show: false
    });

    // Load markdown viewer HTML
    const viewerPath = path.join(__dirname, 'markdown-viewer.html');

    if (fs.existsSync(viewerPath)) {
      viewerWindow.loadFile(viewerPath);
    } else {
      // Create inline HTML if viewer file doesn't exist
      const inlineHTML = createMarkdownViewerHTML(content, windowTitle);
      viewerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(inlineHTML)}`);
    }

    // Send markdown content once window is ready
    viewerWindow.webContents.on('did-finish-load', () => {
      viewerWindow.webContents.send('load-markdown', {
        content: content,
        filePath: filePath,
        fileName: fileName,
        title: windowTitle
      });
    });

    viewerWindow.once('ready-to-show', () => {
      viewerWindow.show();
    });

    console.log(`✅ [Markdown Viewer] Window opened for: ${fileName}`);

    return {
      success: true,
      filePath: filePath,
      fileName: fileName,
      windowTitle: windowTitle
    };

  } catch (error) {
    console.error(`❌ [Markdown Viewer] Error:`, error);
    return { success: false, error: error.message };
  }
});

/**
 * Helper function to create inline markdown viewer HTML
 */
function createMarkdownViewerHTML(content, title) {
  // Escape content for embedding in HTML
  const escapedContent = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    :root {
      --bg-color: #1e1e1e;
      --text-color: #d4d4d4;
      --heading-color: #569cd6;
      --link-color: #4ec9b0;
      --code-bg: #2d2d2d;
      --border-color: #3c3c3c;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 { color: var(--heading-color); margin: 1.5em 0 0.5em; }
    h1 { font-size: 2em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      background-color: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'Fira Code', 'Consolas', monospace;
    }
    pre {
      background-color: var(--code-bg);
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1em 0;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid var(--link-color);
      padding-left: 16px;
      margin: 1em 0;
      color: #999;
    }
    ul, ol { padding-left: 2em; margin: 1em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; }
    th { background-color: var(--code-bg); }
    img { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid var(--border-color); margin: 2em 0; }
    #content { padding-bottom: 40px; }
    .toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: var(--code-bg);
      padding: 8px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
    }
    .toolbar-title { font-weight: 500; color: var(--heading-color); }
    body { padding-top: 60px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">${title}</span>
  </div>
  <div id="content"></div>
  <script>
    const rawContent = "${escapedContent.replace(/\n/g, '\\n').replace(/\r/g, '')}";
    const decodedContent = rawContent
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&');
    
    if (typeof marked !== 'undefined') {
      document.getElementById('content').innerHTML = marked.parse(decodedContent);
    } else {
      document.getElementById('content').innerHTML = '<pre>' + decodedContent + '</pre>';
    }
  </script>
</body>
</html>`;
}

// ===== End Utility Tools IPC Handlers =====


// Handle directory selection for benchmark default directory
ipcMain.handle('show-directory-dialog', async (event, options = {}) => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(null, {
      properties: ['openDirectory'],
      title: options.title || 'Select Directory',
      defaultPath: options.defaultPath || undefined
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return {
        success: true,
        canceled: false,
        filePaths: result.filePaths
      };
    }

    return {
      success: true,
      canceled: true,
      filePaths: []
    };
  } catch (error) {
    console.error('Error in show-directory-dialog:', error);
    return {
      success: false,
      error: error.message,
      canceled: true,
      filePaths: []
    };
  }
});

// Add Unified MCP Server IPC handlers
ipcMain.handle('mcp-server-start', async () => {
  try {
    // Check if Unified MCP Server is already running
    if (unifiedServerStatus === 'running') {
      return {
        success: true,
        message: 'Unified Claude MCP Server is already running',
        status: 'running',
        serverType: 'unified-claude-mcp',
        httpPort: 3002,
        wsPort: 3003
      };
    }

    if (unifiedServerStatus === 'starting') {
      return { success: false, message: 'Unified Claude MCP Server is already starting', status: 'starting' };
    }

    unifiedServerStatus = 'starting';

    try {
      // Create Unified Claude MCP server with ports 3002 and 3003, and main window
      unifiedMCPServer = new UnifiedClaudeMCPServer(3002, 3003, mainWindow);

      // Start the server
      await unifiedMCPServer.start();

      unifiedServerStatus = 'running';
      console.log('Unified Claude MCP Server started successfully on ports 3002 (HTTP) and 3003 (WebSocket)');

      return {
        success: true,
        message: 'Unified Claude MCP Server started successfully',
        status: 'running',
        serverType: 'unified-claude-mcp',
        httpPort: 3002,
        wsPort: 3003
      };
    } catch (error) {
      unifiedServerStatus = 'stopped';
      unifiedMCPServer = null; // Clear the server instance on failure
      console.error('Failed to start Unified Claude MCP Server:', error);

      return {
        success: false,
        message: `Failed to start Unified Claude MCP Server: ${error.message}`,
        status: 'stopped'
      };
    }
  } catch (error) {
    unifiedServerStatus = 'stopped';
    return { success: false, message: error.message, status: 'stopped' };
  }
});

ipcMain.handle('mcp-server-stop', async () => {
  try {
    // Stop Unified MCP Server if running
    if (unifiedServerStatus === 'running') {
      unifiedServerStatus = 'stopping';

      if (unifiedMCPServer) {
        await unifiedMCPServer.stop();
        unifiedMCPServer = null;
      }

      unifiedServerStatus = 'stopped';
      console.log('Unified Claude MCP Server stopped successfully');

      return {
        success: true,
        message: 'Unified Claude MCP Server stopped successfully',
        status: 'stopped',
        serverType: 'unified-claude-mcp'
      };
    }

    if (unifiedServerStatus === 'stopped') {
      return { success: true, message: 'Unified Claude MCP Server is already stopped', status: 'stopped' };
    }

    if (unifiedServerStatus === 'stopping') {
      return { success: false, message: 'Unified Claude MCP Server is already stopping', status: 'stopping' };
    }

    return { success: true, message: 'No MCP Server is running', status: 'stopped' };
  } catch (error) {
    unifiedServerStatus = 'stopped';
    return { success: false, message: error.message, status: 'stopped' };
  }
});

ipcMain.handle('mcp-server-status', async () => {
  // Return Unified Claude MCP Server status
  return {
    status: unifiedServerStatus,
    isRunning: unifiedServerStatus === 'running',
    serverType: unifiedServerStatus === 'running' ? 'unified-claude-mcp' : 'none',
    httpPort: unifiedServerStatus === 'running' ? 3002 : null,
    wsPort: unifiedServerStatus === 'running' ? 3003 : null,
    connectedClients: unifiedMCPServer ? unifiedMCPServer.getConnectedClientsCount() : 0
  };
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
      title: 'Resource Manager - CodeXomics',
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
        { name: 'Genome Files', extensions: ['fasta', 'fa', 'gff', 'gff3', 'gtf', 'vcf', 'bam', 'sam', 'wig', 'bw', 'bigwig', 'fastq', 'fq'] },
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

// Handle opening debug tools
ipcMain.handle('openDebugTool', async (event, fileName) => {
  try {
    console.log('🔧 Opening debug tool:', fileName);

    // Create new window for debug tool
    const debugWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: `Debug Tool - ${fileName}`,
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      show: false
    });

    // Construct path to debug tool file
    const debugToolPath = path.join(__dirname, '..', fileName);

    // Check if file exists
    if (!fs.existsSync(debugToolPath)) {
      throw new Error(`Debug tool file not found: ${debugToolPath}`);
    }

    // Load the debug tool HTML
    debugWindow.loadFile(debugToolPath);

    // Show window when ready
    debugWindow.once('ready-to-show', () => {
      debugWindow.show();
      debugWindow.focus();
    });

    // Handle window closed
    debugWindow.on('closed', () => {
      console.log('🔧 Debug tool window closed:', fileName);
    });

    // Set parent window for proper window management
    if (mainWindow && !mainWindow.isDestroyed()) {
      debugWindow.setParentWindow(mainWindow);
    }

    return { success: true, fileName };
  } catch (error) {
    console.error('❌ Failed to open debug tool:', error);
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
      title: 'Circos Genome Plotter - CodeXomics',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      show: false
    });

    const circosPath = path.join(__dirname, 'circos-plotter.html');

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



// Handle genome data requests from Circos Plotter
ipcMain.handle('get-circos-genome-data', async (event) => {
  try {
    // Get the sender window (Circos window)
    const senderWindow = BrowserWindow.fromWebContents(event.sender);

    // Get main window data
    const mainWindow = getCurrentMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      const result = await mainWindow.webContents.executeJavaScript(`
        (function() {
          if (window.genomeBrowser) {
            const genomeData = {
              currentSequence: window.genomeBrowser.currentSequence || {},
              currentAnnotations: window.genomeBrowser.currentAnnotations || {},
              currentPosition: window.genomeBrowser.currentPosition || null,
              currentChromosome: window.genomeBrowser.currentChromosome || null,
              sequenceLength: window.genomeBrowser.sequenceLength || 0,
              loadedFiles: window.genomeBrowser.loadedFiles || [],
              visibleTracks: window.genomeBrowser.visibleTracks || [],
              operons: window.genomeBrowser.operons || []
            };
            
            // Convert sequence data to Circos format
            const chromosomes = [];
            const genes = [];
            const links = [];
            
            // Debug logging
            console.log('Circos data extraction - currentSequence keys:', Object.keys(genomeData.currentSequence));
            console.log('Circos data extraction - currentAnnotations keys:', Object.keys(genomeData.currentAnnotations));
            console.log('Circos data extraction - currentAnnotations sample:', genomeData.currentAnnotations[Object.keys(genomeData.currentAnnotations)[0]]?.slice(0, 3));
            
            // Process each chromosome/sequence
            Object.keys(genomeData.currentSequence).forEach((chrName, index) => {
              const sequence = genomeData.currentSequence[chrName];
              const length = sequence.length;
              
              // Add chromosome data
              chromosomes.push({
                id: chrName,
                name: chrName,  // Add explicit name for lookup consistency
                label: chrName,
                size: length,
                length: length,  // Also add length for compatibility
                start: 0,
                end: length
              });
              
              // Process annotations for this chromosome
              if (genomeData.currentAnnotations[chrName]) {
                const annotations = genomeData.currentAnnotations[chrName];
                
                // Process all annotations (genes and other features are mixed in the array)
                if (Array.isArray(annotations)) {
                  annotations.forEach(annotation => {
                    // Skip source features as they cover the entire genome and obscure other genes
                    if (annotation.type === 'source') {
                      console.log('Skipping source feature:', annotation);
                      return;
                    }
                    
                    // Extract gene information from qualifiers
                    const geneName = annotation.qualifiers?.gene || annotation.qualifiers?.locus_tag || 'Unknown';
                    const locusTag = annotation.qualifiers?.locus_tag || annotation.qualifiers?.gene || \`feature_\${genes.length}\`;
                    const product = annotation.qualifiers?.product || annotation.qualifiers?.note || 'Unknown function';
                    
                    // Determine feature type - keep original types for better classification
                    let featureType = annotation.type || 'other';
                    
                    // Debug: Log original annotation type
                    if (genes.length < 20) { // Only log first 20 for debugging
                      console.log('Annotation type:', annotation.type, '-> Feature type:', featureType);
                    }
                    
                    // Only map general types, keep specific types like tRNA, rRNA as-is
                    if (featureType === 'gene' || featureType === 'CDS' || featureType === 'mRNA') {
                      featureType = 'protein_coding';
                    } else if (featureType === 'ncRNA') {
                      featureType = 'non_coding';
                    } else if (featureType === 'pseudogene') {
                      featureType = 'pseudogene';
                    } else if (featureType === 'regulatory' || featureType === 'promoter' || featureType === 'terminator') {
                      featureType = 'regulatory';
                    }
                    // Keep tRNA, rRNA, and other specific types as-is for proper classification
                    
                    // Convert strand from -1/1 to +/- format
                    const strand = annotation.strand === -1 ? '-' : '+';
                    
                    // Validate gene coordinates
                    const start = parseInt(annotation.start) || 0;
                    const end = parseInt(annotation.end) || start + 1000;
                    
                    if (start >= 0 && end > start) {
                      genes.push({
                        id: locusTag,
                        name: geneName,
                        chromosome: chrName,
                        start: start,
                        end: end,
                        strand: strand,
                        type: featureType,
                        description: product,
                        qualifiers: annotation.qualifiers || {}
                      });
                    } else {
                      console.warn('Skipping gene with invalid coordinates:', {
                        name: geneName,
                        start: annotation.start,
                        end: annotation.end,
                        chromosome: chrName
                      });
                    }
                  });
                }
              }
            });
            
            // If no genes found, generate some test genes for visualization
            if (genes.length === 0 && chromosomes.length > 0) {
              console.log('No genes found in annotations, generating test genes for visualization');
              chromosomes.forEach((chr, chrIndex) => {
                const numTestGenes = Math.min(20, Math.floor(chr.size / 50000)); // 1 gene per 50kb
                for (let i = 0; i < numTestGenes; i++) {
                  const start = Math.floor(Math.random() * (chr.size - 1000));
                  const end = start + Math.floor(Math.random() * 2000) + 500;
                  const geneTypes = ['protein_coding', 'non_coding', 'pseudogene', 'regulatory'];
                  const geneType = geneTypes[Math.floor(Math.random() * geneTypes.length)];
                  
                  // Validate test gene coordinates
                  if (start >= 0 && end > start && end <= chr.size) {
                    genes.push({
                      id: \`test_gene_\${chrIndex}_\${i}\`,
                      name: \`Test Gene \${i + 1}\`,
                      chromosome: chr.id,
                      start: start,
                      end: end,
                      strand: Math.random() > 0.5 ? '+' : '-',
                      type: geneType,
                      description: \`Test \${geneType} gene for visualization\`,
                      qualifiers: {}
                    });
                  }
                }
              });
            }
            
            return {
              success: true,
              data: {
                chromosomes: chromosomes,
                genes: genes,
                links: links,
                metadata: {
                  totalChromosomes: chromosomes.length,
                  totalGenes: genes.length,
                  totalLength: chromosomes.reduce((sum, chr) => sum + chr.size, 0),
                  source: 'GenomeExplorer',
                  timestamp: new Date().toISOString()
                }
              },
              originalData: genomeData
            };
          }
          return { success: false, error: 'No genome data loaded' };
        })()
      `);
      return result;
    }
    return { success: false, error: 'Main window not available' };
  } catch (error) {
    console.error('Error getting Circos genome data:', error);
    return { success: false, error: error.message };
  }
});

// Handle navigation requests from Circos Plotter
ipcMain.handle('navigate-to-chromosome', async (event, chromosomeName) => {
  try {
    const mainWindow = getCurrentMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.webContents.executeJavaScript(`
        (function() {
          if (window.genomeBrowser && document.getElementById('chromosomeSelect')) {
            const select = document.getElementById('chromosomeSelect');
            const option = Array.from(select.options).find(opt => 
              opt.value === '${chromosomeName}' || 
              opt.text.includes('${chromosomeName}')
            );
            if (option) {
              select.value = option.value;
              select.dispatchEvent(new Event('change'));
              return true;
            }
          }
          return false;
        })()
      `);
      return { success: true };
    }
    return { success: false, error: 'Main window not available' };
  } catch (error) {
    console.error('Error navigating to chromosome:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('navigate-to-gene', async (event, geneData) => {
  try {
    const mainWindow = getCurrentMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.webContents.executeJavaScript(`
        (function() {
          if (window.genomeBrowser) {
            // First navigate to the chromosome
            const select = document.getElementById('chromosomeSelect');
            if (select) {
              const option = Array.from(select.options).find(opt => 
                opt.value === '${geneData.chromosome}' || 
                opt.text.includes('${geneData.chromosome}')
              );
              if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event('change'));
              }
            }
            
            // Then navigate to the gene position
            setTimeout(() => {
              if (window.genomeBrowser.navigateToPosition) {
                window.genomeBrowser.navigateToPosition(${geneData.start}, ${geneData.end});
              } else if (window.genomeBrowser.setPosition) {
                window.genomeBrowser.setPosition(${geneData.start}, ${geneData.end});
              }
            }, 500);
            
            return true;
          }
          return false;
        })()
      `);
      return { success: true };
    }
    return { success: false, error: 'Main window not available' };
  } catch (error) {
    console.error('Error navigating to gene:', error);
    return { success: false, error: error.message };
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
      title: 'KEGG Pathway Analysis - CodeXomics',
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
      title: 'Gene Ontology (GO) Analyzer - CodeXomics',
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
      title: 'Search UniProt Database - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    uniprotWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/uniprot-search.html'));

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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'InterPro Domain Analysis - CodeXomics',
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
      title: 'Search NCBI Database - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    ncbiWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/ncbi-browser.html'));

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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'STRING Protein Networks - CodeXomics',
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
      title: 'DAVID Functional Analysis - CodeXomics',
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
      title: 'Reactome Pathway Browser - CodeXomics',
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
      title: 'PDB Structure Viewer - CodeXomics',
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
      title: 'NVIDIA Evo2 DNA Designer - CodeXomics',
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

// Create Gene Annotation Refine Window
function createGeneAnnotationRefineWindow() {
  try {
    const geneAnnotationRefineWindow = new BrowserWindow({
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
      title: 'Gene Annotation Refine - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    geneAnnotationRefineWindow.loadFile(path.join(__dirname, 'bioinformatics-tools/gene-annotation-refine.html'));

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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'BLAST+ Tools Downloader - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true
    });

    blastDownloaderWindow.loadFile(path.join(__dirname, 'blast-downloader.html'));

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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'Configure BLAST Tools - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: false
    });

    blastConfigWindow.loadFile(path.join(__dirname, 'blast-config.html'));

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
function createDeepGeneResearchMenu(deepGeneResearchWindow) {
  const template = [
    // macOS app menu
    ...(process.platform === 'darwin' ? [{
      label: 'CodeXomics',
      submenu: [
        {
          label: 'About Deep Gene Research',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'about');
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'preferences');
          }
        },
        { type: 'separator' },
        {
          label: `Hide ${APP_NAME}`,
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
          label: `Quit ${APP_NAME}`,
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
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'new-analysis');
          }
        },
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'open');
          }
        },
        { type: 'separator' },
        {
          label: 'Save Results',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'save-results');
          }
        },
        {
          label: 'Export Data',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'export-data');
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
              deepGeneResearchWindow.close();
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
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'copy');
          }
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'paste');
          }
        },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'cut');
          }
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'select-all');
          }
        },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'find');
          }
        },
        {
          label: 'Find Next',
          accelerator: 'F3',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'find-next');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'reload');
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'force-reload');
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'toggle-dev-tools');
          }
        },
        { type: 'separator' },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'reset-zoom');
          }
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'zoom-in');
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'zoom-out');
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'toggle-fullscreen');
          }
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Back to Main Window',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.focus();
              mainWindow.show();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Refresh Page',
          accelerator: 'F5',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'reload');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        ...(process.platform !== 'darwin' ? [
          {
            label: 'About Deep Gene Research',
            click: () => {
              deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'about');
            }
          },
          { type: 'separator' }
        ] : []),
        {
          label: 'User Guide',
          accelerator: 'F1',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'user-guide');
          }
        },
        {
          label: 'Tool Documentation',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'documentation');
          }
        },
        {
          label: 'Online Resources',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'online-resources');
          }
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => {
            require('electron').shell.openExternal('https://github.com/Scilence2022/CodeXomics/issues');
          }
        },
        {
          label: 'Contact Support',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'contact-support');
          }
        }
      ]
    }
  ];

  // Store menu template
  toolMenuTemplates.set(deepGeneResearchWindow.id, { template, toolName: 'Deep Gene Research' });

  // Create menu and set as application menu
  const menu = Menu.buildFromTemplate(template);

  // Set window focus to switch menu
  deepGeneResearchWindow.on('focus', () => {
    currentActiveWindow = deepGeneResearchWindow;
    Menu.setApplicationMenu(menu);
    console.log('Switched to Deep Gene Research menu');
  });

  // Clean up when window closes
  deepGeneResearchWindow.on('closed', () => {
    toolMenuTemplates.delete(deepGeneResearchWindow.id);
    if (currentActiveWindow === deepGeneResearchWindow) {
      currentActiveWindow = null;
      createMenu(); // Restore main window menu
    }
  });
}

// Create ProGenFixer Window
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
          showSettingsWarning('ProGenFixer URL not configured',
            'Using default URL (https://progenfixer.biodesign.ac.cn). You can configure the URL in General Settings → Features → External Tools.');
        }
      } else {
        console.log('⚠️ Main window not available, using default URL:', progenFixerUrl);
        showSettingsWarning('Main window not available',
          'Using default URL (https://progenfixer.biodesign.ac.cn). Please ensure the main window is open.');
      }
    } catch (error) {
      console.warn('❌ Failed to get ProGenFixer URL from settings, using default:', error.message);
      showSettingsError('Failed to load ProGenFixer settings',
        `Using default URL (https://progenfixer.biodesign.ac.cn) due to error: ${error.message}. Please check your settings configuration.`);
    }

    console.log('🔧 Creating ProGenFixer window with URL:', progenFixerUrl);

    const progenFixerWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: false, // Allow loading external URLs
        allowRunningInsecureContent: true,
        // Enable clipboard and keyboard functionality
        experimentalFeatures: true,
        enableBlinkFeatures: 'ClipboardRead,ClipboardWrite'
      },
      title: 'ProGenFixer - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true
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
          showSettingsWarning('Deep Gene Research URL not configured',
            'Using default URL (http://43.196.74.134:3000). You can configure the URL in General Settings → Features → External Tools.');
        }
      } else {
        console.log('⚠️ Main window not available, using default URL:', deepGeneResearchUrl);
        showSettingsWarning('Main window not available',
          'Using default URL (http://43.196.74.134:3000). Please ensure the main window is open.');
      }
    } catch (error) {
      console.warn('❌ Failed to get Deep Gene Research URL from settings, using default:', error.message);
      // Show error notification to user
      showSettingsError('Failed to load Deep Gene Research settings',
        `Using default URL (http://43.196.74.134:3000) due to error: ${error.message}. Please check your settings configuration.`);
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
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: false, // Allow loading external URLs
        allowRunningInsecureContent: true,
        // Enable clipboard and keyboard functionality
        experimentalFeatures: true,
        enableBlinkFeatures: 'ClipboardRead,ClipboardWrite'
      },
      title: 'Deep Gene Research - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      autoHideMenuBar: false
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
          showSettingsWarning('CHOPCHOP URL not configured',
            'Using default URL (https://chopchop.cbu.uib.no/). You can configure the URL in General Settings → Features → External Tools.');
        }
      } else {
        console.log('⚠️ Main window not available, using default URL:', chopchopUrl);
        showSettingsWarning('Main window not available',
          'Using default URL (https://chopchop.cbu.uib.no/). Please ensure the main window is open.');
      }
    } catch (error) {
      console.warn('❌ Failed to get CHOPCHOP URL from settings, using default:', error.message);
      showSettingsError('Failed to load CHOPCHOP settings',
        `Using default URL (https://chopchop.cbu.uib.no/) due to error: ${error.message}. Please check your settings configuration.`);
    }

    console.log('🔧 Creating CHOPCHOP window with URL:', chopchopUrl);

    const chopchopWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: false, // Allow loading external URLs
        allowRunningInsecureContent: true,
        // Enable clipboard and keyboard functionality
        experimentalFeatures: true,
        enableBlinkFeatures: 'ClipboardRead,ClipboardWrite'
      },
      title: 'CHOPCHOP CRISPR Toolbox - CodeXomics',
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true
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
      showSettingsError('Failed to load CHOPCHOP CRISPR Toolbox',
        `Could not load ${validatedURL}. Please check the URL in General Settings → Features → External Tools.`);
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
    showSettingsError('Error opening CHOPCHOP CRISPR Toolbox',
      `Failed to open CHOPCHOP window: ${error.message}`);
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
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: false,
        allowRunningInsecureContent: true,
        experimentalFeatures: true,
        enableBlinkFeatures: 'ClipboardRead,ClipboardWrite'
      },
      title: `${toolData.name} - CodeXomics`,
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true
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
      showSettingsError(`Failed to load ${toolData.name}`,
        `Could not load ${validatedURL}. Please check the URL configuration.`);
    });

    console.log(`✅ Custom external tool window created: ${toolData.name}`);

  } catch (error) {
    console.error(`❌ Error creating custom external tool window for ${toolData.name}:`, error);
    showSettingsError(`Error opening ${toolData.name}`,
      `Failed to open ${toolData.name}: ${error.message}`);
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

ipcMain.on('open-kgml-viewer-window', () => {
  console.log('IPC: Opening KGML Pathway Viewer window...');
  createKGMLViewerWindow();
});

ipcMain.on('open-evo2-window', () => {
  console.log('IPC: Opening Evo2 Design window...');
  createEvo2Window();
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
      timestamp: request.timestamp
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
    const interpretQuery = `Please provide a detailed biological interpretation of the following ${request.toolName} results:\n\n` +
      `Analysis Type: ${request.context.analysisType}\n` +
      `Number of Results: ${request.context.resultCount}\n\n` +
      `Please explain the biological significance and functional implications of these findings.`;

    mainWindow.webContents.send('chatbox-interpret-request', {
      query: interpretQuery,
      data: request.data,
      context: request.context,
      toolName: request.toolName,
      responseTarget: event.sender
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
      timestamp: new Date().toISOString()
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
    timestamp: new Date().toISOString()
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
      const window = BrowserWindow.fromWebContents(webContents);
      if (window) {
        window.setFullScreen(!window.isFullScreen());
      }
      break;
    default:
      console.log('Unknown Deep Gene Research menu action:', action);
  }
});

// Helper functions for user notifications
function showSettingsWarning(title, message) {
  const mainWindow = getCurrentMainWindow();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('show-notification', {
      type: 'warning',
      title: title,
      message: message,
      duration: 5000
    });
  }
}

function showSettingsError(title, message) {
  const mainWindow = getCurrentMainWindow();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('show-notification', {
      type: 'error',
      title: title,
      message: message,
      duration: 8000
    });
  }
}

// General Settings IPC handlers
ipcMain.handle('get-general-settings', async () => {
  try {
    // Get the main window to access GeneralSettingsManager
    const mainWindow = getCurrentMainWindow();
    if (mainWindow && mainWindow.webContents) {
      const settings = await mainWindow.webContents.executeJavaScript(`
        if (window.genomeBrowser && window.genomeBrowser.generalSettingsManager) {
          window.genomeBrowser.generalSettingsManager.getSettings();
        } else {
          Promise.resolve({});
        }
      `);
      return settings;
    }
    return {};
  } catch (error) {
    console.error('Error getting general settings:', error);
    return {};
  }
});

// Evo2 configuration IPC handlers
ipcMain.handle('evo2-get-config', async () => {
  try {
    // Get the main window to access ConfigManager
    const mainWindow = getCurrentMainWindow();
    if (mainWindow && mainWindow.webContents) {
      const config = await mainWindow.webContents.executeJavaScript(`
        if (window.genomeBrowser && window.genomeBrowser.configManager) {
          window.genomeBrowser.configManager.getEvo2Config();
        } else {
          Promise.resolve({});
        }
      `);
      return config;
    }
    return {};
  } catch (error) {
    console.error('Error getting Evo2 config:', error);
    return {};
  }
});

ipcMain.handle('evo2-set-config', async (event, config) => {
  try {
    const mainWindow = getCurrentMainWindow();
    if (mainWindow && mainWindow.webContents) {
      await mainWindow.webContents.executeJavaScript(`
        if (window.genomeBrowser && window.genomeBrowser.configManager) {
          window.genomeBrowser.configManager.setEvo2Config(${JSON.stringify(config)});
        }
      `);
      return { success: true };
    }
    return { success: false, error: 'Main window not available' };
  } catch (error) {
    console.error('Error setting Evo2 config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('evo2-get-api-key', async () => {
  try {
    const mainWindow = getCurrentMainWindow();
    if (mainWindow && mainWindow.webContents) {
      const apiKey = await mainWindow.webContents.executeJavaScript(`
        if (window.genomeBrowser && window.genomeBrowser.configManager) {
          window.genomeBrowser.configManager.getEvo2ApiKey();
        } else {
          Promise.resolve('');
        }
      `);
      return apiKey;
    }
    return '';
  } catch (error) {
    console.error('Error getting Evo2 API key:', error);
    return '';
  }
});

ipcMain.handle('evo2-set-api-key', async (event, apiKey) => {
  try {
    const mainWindow = getCurrentMainWindow();
    if (mainWindow && mainWindow.webContents) {
      await mainWindow.webContents.executeJavaScript(`
        if (window.genomeBrowser && window.genomeBrowser.configManager) {
          window.genomeBrowser.configManager.setEvo2ApiKey('${apiKey}');
        }
      `);
      return { success: true };
    }
    return { success: false, error: 'Main window not available' };
  } catch (error) {
    console.error('Error setting Evo2 API key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('evo2-get-analysis-history', async () => {
  try {
    const mainWindow = getCurrentMainWindow();
    if (mainWindow && mainWindow.webContents) {
      const history = await mainWindow.webContents.executeJavaScript(`
        if (window.genomeBrowser && window.genomeBrowser.configManager) {
          window.genomeBrowser.configManager.getEvo2AnalysisHistory();
        } else {
          Promise.resolve([]);
        }
      `);
      return history;
    }
    return [];
  } catch (error) {
    console.error('Error getting Evo2 analysis history:', error);
    return [];
  }
});

ipcMain.handle('evo2-set-analysis-history', async (event, history) => {
  try {
    const mainWindow = getCurrentMainWindow();
    if (mainWindow && mainWindow.webContents) {
      await mainWindow.webContents.executeJavaScript(`
        if (window.genomeBrowser && window.genomeBrowser.configManager) {
          window.genomeBrowser.configManager.setEvo2AnalysisHistory(${JSON.stringify(history)});
        }
      `);
      return { success: true };
    }
    return { success: false, error: 'Main window not available' };
  } catch (error) {
    console.error('Error setting Evo2 analysis history:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler for BLAST installation check
ipcMain.on('check-blast-installation', (event) => {
  console.log('IPC: Checking BLAST installation...');
  const { exec } = require('child_process');
  const path = require('path');
  const fs = require('fs');
  const os = require('os');

  // Function to check BLAST+ at specific path
  function checkBlastAtPath(blastPath) {
    return new Promise((resolve) => {
      const command = `"${blastPath}" -version`;
      console.log('Checking BLAST at:', command);

      exec(command, (error, stdout, stderr) => {
        if (error) {
          resolve({ found: false, error: error.message });
        } else {
          const versionMatch = stdout.match(/blastn: ([\d.]+)/);
          const version = versionMatch ? versionMatch[1] : 'Unknown version';
          resolve({
            found: true,
            version: version,
            path: blastPath,
            output: stdout
          });
        }
      });
    });
  }

  // Function to find BLAST+ executable
  async function findBlastExecutable() {
    const homeDir = os.homedir();
    const commonPaths = [
      '/usr/local/bin/blastn',
      '/usr/bin/blastn',
      '/opt/homebrew/bin/blastn',
      '/usr/local/blast+/bin/blastn',
      path.join(homeDir, 'Applications', 'blast+', 'bin', 'blastn'),
      path.join(homeDir, '.local', 'blast+', 'bin', 'blastn'),
      path.join(homeDir, '.local', 'bin', 'blastn'),
      '/opt/blast+/bin/blastn'
    ];

    // First try direct command execution (for PATH-based installations)
    try {
      const result = await checkBlastAtPath('blastn');
      if (result.found) {
        return result;
      }
    } catch (error) {
      console.log('Direct blastn command failed, trying specific paths...');
    }

    // Try specific paths
    for (const blastPath of commonPaths) {
      try {
        if (fs.existsSync(blastPath)) {
          const result = await checkBlastAtPath(blastPath);
          if (result.found) {
            return result;
          }
        }
      } catch (error) {
        continue;
      }
    }

    return { found: false, error: 'BLAST+ not found in any common locations' };
  }

  // Execute the search
  findBlastExecutable().then(result => {
    if (result.found) {
      event.sender.send('blast-check-result', {
        installed: true,
        message: `BLAST+ installed successfully (version ${result.version})`,
        version: result.version,
        path: result.path,
        output: result.output
      });
    } else {
      event.sender.send('blast-check-result', {
        installed: false,
        message: 'BLAST+ not found or not installed',
        error: result.error
      });
    }
  }).catch(error => {
    event.sender.send('blast-check-result', {
      installed: false,
      message: 'Error checking BLAST+ installation',
      error: error.message
    });
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
    totalMemory: (os.totalmem() / (1024 ** 3)).toFixed(2) + ' GB',
    freeMemory: (os.freemem() / (1024 ** 3)).toFixed(2) + ' GB',
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
  try {  // Check if Project Manager window already exists in this process
    const existingPMWindow = BrowserWindow.getAllWindows().find(win =>
      win.getTitle().includes('Project Manager') && !win.isDestroyed()
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
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      title: 'Project Manager - CodeXomics',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      resizable: true,
      minimizable: true,
      maximizable: true,
      show: false
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
      const mainWindows = BrowserWindow.getAllWindows().filter(win =>
        win.getTitle().includes('CodeXomics') && !win.getTitle().includes('Project Manager')
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
        win.getTitle().includes('CodeXomics') && !win.getTitle().includes('Project Manager')
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
                { name: 'CodeXomics Project Files', extensions: ['GAI', 'prj.GAI'] },
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
                { name: 'Genome Files', extensions: ['fasta', 'fa', 'fas', 'gff', 'gff3', 'gtf', 'vcf', 'bam', 'sam', 'wig', 'bw', 'bigwig', 'bed', 'gb', 'gbk', 'gbff'] },
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

    // Search && Edit Menu
    {
      label: 'Search && Edit',
      submenu: [
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
        },
        { type: 'separator' },
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
          label: 'Download BLAST+ Tools',
          accelerator: 'CmdOrCtrl+Alt+B',
          click: () => {
            createBlastDownloaderWindow();
          }
        },
        {
          label: 'Configure BLAST Tools',
          click: () => {
            createBlastConfigWindow();
          }
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

// Handler for showing project open dialog
ipcMain.handle('show-project-open-dialog', async (event, projectName) => {
  try {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Open in Current Window', 'Open in New Window', 'Cancel'],
      defaultId: 0,
      title: 'Open Project',
      message: `Open "${projectName}"?`,
      detail: `Choose how to open this project:\n\n` +
        `• Open in Current Window: Close current project and open new project here\n` +
        `• Open in New Window: Keep current project and open new project in a new application instance\n` +
        `• Cancel: Don't open the project`,
      noLink: true
    });

    return { success: true, choice: response }; // 0 = current, 1 = new, 2 = cancel
  } catch (error) {
    console.error('Error showing project open dialog:', error);
    return { success: false, error: error.message };
  }
});

// Handler for opening project in new process
ipcMain.handle('open-project-in-new-process', async (event, filePath) => {
  try {
    const { spawn } = require('child_process');
    const electronPath = process.execPath;
    const appPath = app.getAppPath();

    console.log('🚀 Starting new application instance...');
    console.log('   Electron path:', electronPath);
    console.log('   App path:', appPath);
    console.log('   Project file:', filePath);

    // Start new process with project file path as argument
    const child = spawn(electronPath, [appPath, '--open-project', filePath], {
      detached: true,
      stdio: 'ignore'
    });

    child.unref();

    console.log('✅ New application instance started with PID:', child.pid);
    return { success: true, pid: child.pid };
  } catch (error) {
    console.error('Error opening project in new process:', error);
    return { success: false, error: error.message };
  }
});

// ... existing code ...

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
        { name: 'CodeXomics Project Files', extensions: ['GAI', 'prj.GAI'] },
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
        { name: 'Genome Files', extensions: ['fasta', 'fa', 'fas', 'gff', 'gff3', 'gtf', 'vcf', 'bam', 'sam', 'wig', 'bw', 'bigwig', 'bed', 'gb', 'gbk', 'gbff'] },
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

// Handle FASTA file selection for BLAST
ipcMain.handle('selectFastaFile', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(null, {
      properties: ['openFile'],
      filters: [
        { name: 'FASTA files', extensions: ['fasta', 'fa', 'fas'] },
        { name: 'Text files', extensions: ['txt'] },
        { name: 'All files', extensions: ['*'] }
      ],
      title: 'Select FASTA file for BLAST database'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] };
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
        error: 'File is already locked by another instance of CodeXomics'
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
    const dirResult = await ipcMain.invoke('getProjectDirectoryName');
    const projectsDir = path.join(documentsPath, dirResult.directoryName);
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

    // Helper function to get project-relative path
    function getProjectRelativePath(absolutePath, projectBasePath) {
      const relativePath = path.relative(projectBasePath, absolutePath);
      return relativePath.replace(/\\/g, '/'); // Normalize path separators
    }

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

              // Create folder object with relative path
              newFolders.push({
                name: item,
                icon: getFolderIcon(item),
                path: newFolderPath,
                files: [],
                created: stats.birthtime ? stats.birthtime.toISOString() : new Date().toISOString(),
                custom: true,
                autoDiscovered: true,
                discoveredDate: new Date().toISOString(),
                relativePath: relativeFilePath,
                absolutePath: itemPath // Keep absolute path for system operations
              });
            }

            // Recursively scan subdirectories
            scanDirectory(itemPath, relativeFilePath, newFolderPath);

          } else if (stats.isFile()) {
            // Process file
            const tempId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const projectRelativePath = getProjectRelativePath(itemPath, projectPath);

            // Check if this file path already exists (use relative path for comparison)
            const isDuplicate = existingFileIds.some(existingPath =>
              existingPath === projectRelativePath ||
              existingPath === itemPath ||
              existingPath.endsWith(relativeFilePath)
            );

            if (!isDuplicate) {
              newFiles.push({
                id: tempId,
                name: item,
                path: projectRelativePath, // Use relative path for storage
                absolutePath: itemPath, // Keep absolute path for system operations
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
                  projectRelativePath: projectRelativePath,
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
    console.log(`🆕 Found ${newFiles.length} new files (using relative paths)`);
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

    // 新结构：默认保存为 Project.GAI
    let defaultFileName = defaultPath;
    if (defaultFileName.endsWith('.prj.GAI') || defaultFileName.endsWith('.xml')) {
      // 如果是旧格式，转换为新格式
      const dir = path.dirname(defaultFileName);
      defaultFileName = path.join(dir, 'Project.GAI');
    } else if (!defaultFileName.endsWith('Project.GAI')) {
      defaultFileName = path.join(defaultFileName, 'Project.GAI');
    }

    const result = await dialog.showSaveDialog(null, {
      defaultPath: defaultFileName,
      filters: [
        { name: 'CodeXomics Project Files', extensions: ['GAI'] },
        { name: 'XML Files', extensions: ['xml'] },
        { name: 'Project Files', extensions: ['genomeproj'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Save Project File'
    });

    if (!result.canceled && result.filePath) {
      // 确保父目录存在
      const parentDir = path.dirname(result.filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(result.filePath, content, 'utf8');
      console.log(`✅ Project saved: ${result.filePath}`);
      return { success: true, filePath: result.filePath };
    }

    return { success: false, canceled: true };
  } catch (error) {
    console.error('Error saving project file:', error);
    return { success: false, error: error.message };
  }
});

// Handle saving project file directly without dialog (for auto-save)
ipcMain.handle('saveProjectFileDirect', async (event, filePath, content) => {
  try {
    // 确保文件路径存在
    if (!filePath) {
      throw new Error('File path is required for direct save');
    }

    // 确保父目录存在
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // 直接写入文件，不显示对话框
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Project saved directly: ${filePath}`);
    return { success: true, filePath: filePath };
  } catch (error) {
    console.error('Error saving project file directly:', error);
    return { success: false, error: error.message };
  }
});

// Handle creating temporary file
ipcMain.handle('createTempFile', async (event, fileName, content) => {
  try {
    const tempDir = app.getPath('temp');
    const tempFilePath = path.join(tempDir, 'codexomics_temp_' + Date.now() + '_' + fileName);

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

// Handle checking if file exists
ipcMain.handle('checkFileExists', async (event, filePath) => {
  try {
    const exists = fs.existsSync(filePath);
    return { success: true, exists: exists };
  } catch (error) {
    return { success: false, exists: false, error: error.message };
  }
});

// Handle deleting physical file
ipcMain.handle('deletePhysicalFile', async (event, filePath) => {
  try {
    if (!filePath) {
      throw new Error('File path is required for deletion');
    }

    if (!fs.existsSync(filePath)) {
      console.log(`File does not exist, skipping deletion: ${filePath}`);
      return { success: true, message: 'File does not exist' };
    }

    // Delete the file
    fs.unlinkSync(filePath);
    console.log(`✅ File deleted: ${filePath}`);
    return { success: true, message: 'File deleted successfully' };
  } catch (error) {
    console.error('Error deleting file:', error);
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
    const dirResult = await ipcMain.invoke('getProjectDirectoryName');
    const projectsDir = path.join(documentsPath, dirResult.directoryName);
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
    console.log(`🏗️ Creating project structure: "${projectName}" at "${location}"`);

    // 新的目录结构：所有文件都在项目目录内
    const projectDir = path.join(location, projectName);
    const projectFilePath = path.join(projectDir, 'Project.GAI'); // 固定文件名

    // 检查项目目录是否已存在
    if (fs.existsSync(projectDir)) {
      return {
        success: false,
        error: `Project directory "${projectName}" already exists at this location`
      };
    }

    // 创建项目目录
    console.log(`📁 Creating project directory: ${projectDir}`);
    fs.mkdirSync(projectDir, { recursive: true });

    // 创建子文件夹结构
    const subFolders = ['genomes', 'annotations', 'variants', 'reads', 'analysis'];
    console.log(`📂 Creating subdirectories: ${subFolders.join(', ')}`);

    subFolders.forEach(folderName => {
      const subFolderPath = path.join(projectDir, folderName);
      fs.mkdirSync(subFolderPath, { recursive: true });
      console.log(`  ✅ Created: ${folderName}/`);
    });

    console.log(`✅ Project structure created successfully`);
    console.log(`📁 Project directory: ${projectDir}`);
    console.log(`📄 Project file will be: ${projectFilePath}`);

    return {
      success: true,
      projectFilePath: projectFilePath,
      dataFolderPath: projectDir, // 项目目录即为数据目录
      projectDir: projectDir
    };

  } catch (error) {
    console.error('❌ Error creating project structure:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Handle saving project to specific file
ipcMain.handle('saveProjectToSpecificFile', async (event, filePath, content) => {
  try {
    console.log(`💾 Saving project file to: ${filePath}`);

    // 确保目录存在
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      console.log(`📁 Creating directory: ${dirPath}`);
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(filePath, content, 'utf8');

    // 验证文件是否创建成功
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ Project file saved successfully: ${filePath}`);
      console.log(`📊 File size: ${stats.size} bytes`);
      return { success: true, filePath: filePath, size: stats.size };
    } else {
      throw new Error('File was not created successfully');
    }

  } catch (error) {
    console.error('❌ Error saving project to specific file:', error);
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

// Handle saving refined gene annotation
ipcMain.handle('save-refined-annotation', async (event, data) => {
  try {
    const { gene, originalAnnotation, refinedAnnotation, timestamp } = data;

    console.log('Saving refined annotation for gene:', gene);

    // Get the main window to access the genome browser
    const mainWindow = getCurrentMainWindow();
    if (!mainWindow || !mainWindow.webContents) {
      throw new Error('Main window not available');
    }

    // Send the refined annotation to the main window for saving
    const result = await mainWindow.webContents.executeJavaScript(`
      (async function() {
        if (window.genomeBrowser && window.genomeBrowser.updateGeneAnnotation) {
          try {
            await window.genomeBrowser.updateGeneAnnotation('${gene}', ${JSON.stringify(refinedAnnotation)});
            return { success: true, message: 'Annotation updated successfully' };
          } catch (error) {
            return { success: false, error: error.message };
          }
        } else {
          return { success: false, error: 'Genome browser not available' };
        }
      })()
    `);

    if (result.success) {
      console.log('Refined annotation saved successfully for gene:', gene);
      return { success: true, message: result.message };
    } else {
      throw new Error(result.error || 'Failed to save annotation');
    }

  } catch (error) {
    console.error('Error saving refined annotation:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Handle checking if project exists
ipcMain.handle('checkProjectExists', async (event, directory, projectName) => {
  try {
    // 新结构：检查项目目录内的 Project.GAI 文件
    const projectDir = path.join(directory, projectName);
    const newProjectFilePath = path.join(projectDir, 'Project.GAI');

    // 向后兼容：也检查旧结构
    const oldProjectFilePath = path.join(directory, `${projectName}.prj.GAI`);

    const newFileExists = fs.existsSync(newProjectFilePath);
    const oldFileExists = fs.existsSync(oldProjectFilePath);
    const folderExists = fs.existsSync(projectDir);

    return {
      exists: newFileExists || oldFileExists || folderExists,
      fileExists: newFileExists || oldFileExists,
      folderExists: folderExists,
      projectFilePath: newFileExists ? newProjectFilePath : oldProjectFilePath,
      dataFolderPath: projectDir,
      isNewStructure: newFileExists
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
    // 新结构：目标项目目录和文件
    const targetProjectDir = path.join(targetDirectory, projectName);
    const targetProjectFile = path.join(targetProjectDir, 'Project.GAI');

    // 创建目标项目目录
    if (!fs.existsSync(targetProjectDir)) {
      fs.mkdirSync(targetProjectDir, { recursive: true });
    }

    // 复制项目文件到新位置
    if (fs.existsSync(sourceProjectFile)) {
      fs.copyFileSync(sourceProjectFile, targetProjectFile);
      console.log(`✅ Copied project file: ${sourceProjectFile} → ${targetProjectFile}`);
    }

    // 复制数据文件夹内容（如果源数据文件夹存在且不同于目标目录）
    if (fs.existsSync(sourceDataFolder) && sourceDataFolder !== targetProjectDir) {
      await copyDirectoryRecursive(sourceDataFolder, targetProjectDir);
      console.log(`✅ Copied data folder: ${sourceDataFolder} → ${targetProjectDir}`);
    }

    return {
      success: true,
      targetProjectFile: targetProjectFile,
      targetDataFolder: targetProjectDir
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

        // Track if we received a response
        let responseReceived = false;

        // Listen for project info response
        const handleProjectInfo = (event, projectInfo) => {
          console.log('📥 Received project info from Project Manager:', projectInfo);
          responseReceived = true;
          // Update the global current active project
          if (projectInfo) {
            setActiveProject(projectInfo);
          }
          downloadWindow.webContents.send('set-active-project', projectInfo);
          // Remove the listener after receiving the response
          ipcMain.removeListener('project-manager-current-project-response', handleProjectInfo);
        };

        ipcMain.on('project-manager-current-project-response', handleProjectInfo);

        // Fallback timeout - if no response in 1 second, use current active project
        setTimeout(() => {
          if (!responseReceived) {
            ipcMain.removeListener('project-manager-current-project-response', handleProjectInfo);
            const fallbackProject = getCurrentProjectInfo();
            console.log('⏰ Using fallback project info:', fallbackProject);
            downloadWindow.webContents.send('set-active-project', fallbackProject);
          } else {
            console.log('✅ Project info already received from Project Manager, skipping fallback');
          }
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

// Intelligent file categorization function for genomic data
function categorizeGenomicFile(filePath, url, database) {
  const fileName = path.basename(filePath);
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, extension).toLowerCase();

  // Database-specific categorization (highest priority)
  if (database) {
    switch (database) {
      case 'protein':
      case 'uniprot':
        return 'proteins';
      case 'sra':
        return 'sequencing_data';
      case 'assembly':
        return 'genomes';
      case 'pubmed':
        return 'literature';
      default:
        break;
    }
  }

  // Extension-based categorization (medium priority)
  switch (extension) {
    case '.fasta':
    case '.fa':
    case '.fas':
    case '.fna':
    case '.ffn':
    case '.faa':
      // Further categorize FASTA files based on content indicators
      if (baseName.includes('protein') || baseName.includes('prot') || baseName.includes('aa') || extension === '.faa') {
        return 'proteins';
      } else if (baseName.includes('cds') || baseName.includes('mrna') || baseName.includes('transcript') || extension === '.ffn') {
        return 'transcripts';
      } else if (baseName.includes('genome') || baseName.includes('chromosome') || extension === '.fna') {
        return 'genomes';
      } else {
        return 'genomes'; // Default for FASTA files
      }

    case '.gb':
    case '.gbk':
    case '.genbank':
      return 'genomes';

    case '.gff':
    case '.gff3':
    case '.gtf':
      return 'annotations';

    case '.vcf':
    case '.bcf':
      return 'variants';

    case '.bed':
    case '.wig':
    case '.bigwig':
    case '.bw':
      return 'tracks';

    case '.sam':
    case '.bam':
      return 'alignments';

    case '.fastq':
    case '.fq':
    case '.sra':
      return 'sequencing_data';

    case '.embl':
      return 'genomes';

    case '.xml':
      if (baseName.includes('pubmed') || baseName.includes('literature')) {
        return 'literature';
      }
      return 'metadata';

    case '.json':
    case '.yaml':
    case '.yml':
      return 'metadata';

    default:
      // URL-based categorization as fallback (lowest priority)
      if (url) {
        const urlLower = url.toLowerCase();
        if (urlLower.includes('protein') || urlLower.includes('uniprot')) {
          return 'proteins';
        } else if (urlLower.includes('sra') || urlLower.includes('fastq')) {
          return 'sequencing_data';
        } else if (urlLower.includes('assembly') || urlLower.includes('genome')) {
          return 'genomes';
        } else if (urlLower.includes('annotation') || urlLower.includes('gff')) {
          return 'annotations';
        } else if (urlLower.includes('variant') || urlLower.includes('vcf')) {
          return 'variants';
        }
      }

      // Default fallback - return null for root directory placement
      return null;
  }
}

ipcMain.handle('downloadFile', async (event, url, outputPath, projectInfo) => {
  return new Promise((resolve) => {
    try {
      const https = require('https');
      const http = require('http');
      const fs = require('fs');
      const path = require('path');

      // If project info is provided, download to project directory with intelligent categorization
      let finalOutputPath = outputPath;
      if (projectInfo && projectInfo.dataFolderPath) {
        // Determine file category based on extension, URL, and database type
        const fileName = path.basename(outputPath);

        // Extract database type from enhanced project info or URL/filename patterns
        let databaseType = null;

        // Priority 1: Use database info from download context if available
        if (projectInfo.downloadContext && projectInfo.downloadContext.database) {
          databaseType = projectInfo.downloadContext.database;
        } else if (url) {
          // Priority 2: Extract from URL patterns
          const urlLower = url.toLowerCase();
          if (urlLower.includes('protein') || urlLower.includes('uniprot')) {
            databaseType = 'protein';
          } else if (urlLower.includes('sra')) {
            databaseType = 'sra';
          } else if (urlLower.includes('assembly')) {
            databaseType = 'assembly';
          } else if (urlLower.includes('pubmed')) {
            databaseType = 'pubmed';
          }
        }

        const category = categorizeGenomicFile(outputPath, url, databaseType);

        let targetDir;
        if (category) {
          // Create categorized subdirectory
          targetDir = path.join(projectInfo.dataFolderPath, category);
          console.log(`📁 Intelligent categorization: ${fileName} -> ${category}/ (database: ${databaseType || 'auto-detected'})`);
        } else {
          // Place in root directory for unclassifiable files
          targetDir = projectInfo.dataFolderPath;
          console.log(`📁 Root directory placement: ${fileName} (unclassifiable type)`);
        }

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        finalOutputPath = path.join(targetDir, fileName);
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

                // Enhanced project integration - notify about new file
                if (projectInfo && projectInfo.dataFolderPath) {
                  // Send file addition notification to project manager
                  const allWindows = BrowserWindow.getAllWindows();
                  const projectManagerWindow = allWindows.find(win =>
                    win.getTitle().includes('Project Manager') ||
                    win.webContents.getURL().includes('project-manager')
                  );

                  if (projectManagerWindow) {
                    const relativePath = path.relative(projectInfo.dataFolderPath, finalOutputPath);
                    const category = projectInfo.downloadContext ?
                      categorizeGenomicFile(finalOutputPath, url, projectInfo.downloadContext.database) :
                      categorizeGenomicFile(finalOutputPath, url, null);

                    projectManagerWindow.webContents.send('file-downloaded', {
                      filePath: finalOutputPath,
                      relativePath: relativePath,
                      category: category || 'uncategorized',
                      projectPath: projectInfo.dataFolderPath,
                      downloadContext: projectInfo.downloadContext || {}
                    });

                    console.log(`📢 Notified project manager about new file: ${relativePath} → ${category}/`);
                  }
                }

                resolve({
                  success: true,
                  filePath: finalOutputPath,
                  category: projectInfo ? categorizeGenomicFile(finalOutputPath, url,
                    projectInfo.downloadContext ? projectInfo.downloadContext.database : null) : null
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

            // Enhanced project integration - notify about new file
            if (projectInfo && projectInfo.dataFolderPath) {
              // Send file addition notification to project manager
              const allWindows = BrowserWindow.getAllWindows();
              const projectManagerWindow = allWindows.find(win =>
                win.getTitle().includes('Project Manager') ||
                win.webContents.getURL().includes('project-manager')
              );

              if (projectManagerWindow) {
                const relativePath = path.relative(projectInfo.dataFolderPath, finalOutputPath);
                const category = projectInfo.downloadContext ?
                  categorizeGenomicFile(finalOutputPath, url, projectInfo.downloadContext.database) :
                  categorizeGenomicFile(finalOutputPath, url, null);

                projectManagerWindow.webContents.send('file-downloaded', {
                  filePath: finalOutputPath,
                  relativePath: relativePath,
                  category: category || 'uncategorized',
                  projectPath: projectInfo.dataFolderPath,
                  downloadContext: projectInfo.downloadContext || {}
                });

                console.log(`📢 Notified project manager about new file: ${relativePath} → ${category}/`);
              }
            }

            resolve({
              success: true,
              filePath: finalOutputPath,
              category: projectInfo ? categorizeGenomicFile(finalOutputPath, url,
                projectInfo.downloadContext ? projectInfo.downloadContext.database : null) : null
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
    win.getTitle().includes('CodeXomics') &&
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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      title: `Test: ${filename}`,
      icon: path.join(__dirname, 'assets', 'icon.png')
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

// Handle getting project directory name
ipcMain.handle('getProjectDirectoryName', async () => {
  try {
    const documentsPath = app.getPath('documents');

    // Check which project directory exists
    const possibleNames = [
      'CodeXomics Projects',
      'CodeXomics Projects',
      'GenomeExplorer Projects',
      'Genome Explorer Projects'
    ];

    for (const name of possibleNames) {
      const testPath = path.join(documentsPath, name);
      if (fs.existsSync(testPath)) {
        console.log(`✅ Found existing project directory: ${name}`);
        return { success: true, directoryName: name };
      }
    }

    // If none exist, use the default
    const defaultName = PROJECT_DIRECTORY_NAME;
    console.log(`📁 Using default project directory name: ${defaultName}`);
    return { success: true, directoryName: defaultName };

  } catch (error) {
    console.error('Error getting project directory name:', error);
    return { success: false, error: error.message };
  }
});

// External Tools Configuration IPC handlers
ipcMain.on('update-external-tools-menu', (event, tools) => {
  console.log('📋 [ExternalTools] Updating external tools menu:', tools);
  // Store the tools data for menu creation
  global.customExternalTools = tools;
  // Recreate the main menu to include new tools
  createMenu();
});

ipcMain.on('open-custom-external-tool', (event, toolData) => {
  console.log('🔧 [ExternalTools] Opening custom external tool:', toolData);
  createCustomExternalToolWindow(toolData);
});

// Built-in external tools IPC handlers
ipcMain.on('open-deep-gene-research-window', async (event, params = {}) => {
  console.log('IPC: Opening Deep Gene Research window with params:', params);
  await createDeepGeneResearchWindow(params);
});

ipcMain.on('open-chopchop-window', () => {
  console.log('IPC: Opening CHOPCHOP window...');
  createChopchopWindow();
});

ipcMain.on('open-progenfixer-window', () => {
  console.log('IPC: Opening ProGenFixer window...');
  createProGenFixerWindow();
});
