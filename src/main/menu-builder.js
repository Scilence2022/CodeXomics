'use strict';
// @ts-check

const { Menu, dialog, app, BrowserWindow } = require('electron');
const { rememberApprovedDialogPaths } = require('./security-utils');
const workspaceHostManager = require('./workspace-host-manager');

// External references (set by main module via setMenuDependencies)
let APP_NAME;
let VERSION_INFO;
let mainWindow;
let toolMenuTemplates;
let currentActiveWindow;

// External function references (set by main module via setMenuDependencies)
let createProjectManagerWindow;
let createWindow;
let createCircosWindow;
let createKEGGWindow;
let createGOWindow;
let createInterProWindow;
let createDeepGeneResearchWindow;
let createChopchopWindow;
let createProGenFixerWindow;
let createBlastDownloaderWindow;
let createBlastConfigWindow;
let createMCPServerManagerWindow;
let createGenomicDownloadWindow;
let sendToCurrentMainWindow;
let getCurrentMainWindow;
let getCustomExternalToolsMenuItems;
let arrangeWindowsOptimal;
let arrangeWindowsSideBySide;
let arrangeMainWindowFocus;
let arrangeProjectManagerFocus;
let arrangeWindowsVertical;
let arrangeWindowsCascade;

function isMainGenomeWindow(win) {
  return !!(win && !win.isDestroyed() && (win.windowId || workspaceHostManager.getActiveWindowIdForHost(win)));
}

function toggleCurrentGenomeDevTools() {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const currentMainWindow =
    (typeof getCurrentMainWindow === 'function' && getCurrentMainWindow()) ||
    (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null);
  const targetWindow = isMainGenomeWindow(focusedWindow) ? focusedWindow : currentMainWindow || currentActiveWindow;
  const result = workspaceHostManager.toggleDevToolsForHost(targetWindow);
  if (result.handled) return;

  const fallbackWindow = focusedWindow || currentMainWindow || currentActiveWindow;
  const fallbackWebContents = fallbackWindow && !fallbackWindow.isDestroyed() ? fallbackWindow.webContents : null;
  if (fallbackWebContents && !fallbackWebContents.isDestroyed()) {
    fallbackWebContents.toggleDevTools();
  }
}

function restoreMainMenuAfterToolWindow(toolName, reason) {
  setTimeout(() => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const currentMainWindow =
      (typeof getCurrentMainWindow === 'function' && getCurrentMainWindow()) ||
      (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null);

    if (isMainGenomeWindow(focusedWindow) || (!focusedWindow && currentMainWindow)) {
      currentActiveWindow = currentMainWindow || focusedWindow;
      createMenu();
      console.log(`Restored main menu after ${toolName} ${reason}`);
    }
  }, 50);
}
let resetWindowPositions;

const genomeFileDialogFilters = [
  {
    name: 'All Genome Files',
    extensions: ['fasta', 'fa', 'gb', 'gbk', 'genbank', 'gff', 'gtf', 'bed', 'vcf', 'bam', 'sam'],
  },
  { name: 'FASTA Files', extensions: ['fasta', 'fa'] },
  { name: 'GenBank Files', extensions: ['gb', 'gbk', 'genbank'] },
  { name: 'Annotation Files', extensions: ['gff', 'gtf', 'bed'] },
  { name: 'Variant Files', extensions: ['vcf'] },
  { name: 'Alignment Files', extensions: ['bam', 'sam'] },
  { name: 'All Files', extensions: ['*'] },
];

function openFileInNewMainWindow(filePath) {
  const newWindow = createWindow();

  const sendFileToNewWindow = () => {
    setTimeout(() => {
      if (newWindow && !newWindow.isDestroyed()) {
        newWindow.webContents.send('file-opened', filePath);
        newWindow.focus();
      }
    }, 500);
  };

  if (newWindow.webContents.isLoading()) {
    newWindow.webContents.once('did-finish-load', sendFileToNewWindow);
  } else {
    sendFileToNewWindow();
  }
}

// 为 Circos Genome Plotter 创建专门的菜单系统
function createCircosPlotterMenu(circosWindow) {
  const template = [
    // 添加 CodeXomics 品牌菜单项（仅在 macOS 上）
    ...(process.platform === 'darwin'
      ? [
          {
            label: 'CodeXomics',
            submenu: [
              {
                label: 'About Circos Genome Plotter',
                click: () => {
                  circosWindow.webContents.send('circos-menu-action', 'about');
                },
              },
              { type: 'separator' },
              {
                label: 'Preferences',
                accelerator: 'Cmd+,',
                click: () => {
                  circosWindow.webContents.send('circos-menu-action', 'preferences');
                },
              },
              { type: 'separator' },
              {
                label: `Hide ${APP_NAME}`,
                accelerator: 'Cmd+H',
                role: 'hide',
              },
              {
                label: 'Hide Others',
                accelerator: 'Cmd+Shift+H',
                role: 'hideothers',
              },
              {
                label: 'Show All',
                role: 'unhide',
              },
              { type: 'separator' },
              {
                label: `Quit ${APP_NAME}`,
                accelerator: 'Cmd+Q',
                click: () => {
                  app.quit();
                },
              },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'new-project');
          },
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
                { name: 'All Files', extensions: ['*'] },
              ],
            });
            rememberApprovedDialogPaths(result);

            if (!result.canceled && result.filePaths.length > 0) {
              circosWindow.webContents.send('circos-menu-action', 'open-project', result.filePaths[0]);
            }
          },
        },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'save-project');
          },
        },
        {
          label: 'Save Project As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'save-project-as');
          },
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
                    { name: 'All Files', extensions: ['*'] },
                  ],
                });
                rememberApprovedDialogPaths(result);

                if (!result.canceled && result.filePaths.length > 0) {
                  circosWindow.webContents.send('circos-menu-action', 'import-fasta', result.filePaths[0]);
                }
              },
            },
            {
              label: 'Annotations (GFF/GFF3)',
              click: async () => {
                const result = await dialog.showOpenDialog(circosWindow, {
                  properties: ['openFile'],
                  filters: [
                    { name: 'GFF Files', extensions: ['gff', 'gff3', 'gtf'] },
                    { name: 'All Files', extensions: ['*'] },
                  ],
                });
                rememberApprovedDialogPaths(result);

                if (!result.canceled && result.filePaths.length > 0) {
                  circosWindow.webContents.send('circos-menu-action', 'import-gff', result.filePaths[0]);
                }
              },
            },
            {
              label: 'GenBank File',
              click: async () => {
                const result = await dialog.showOpenDialog(circosWindow, {
                  properties: ['openFile'],
                  filters: [
                    { name: 'GenBank Files', extensions: ['gb', 'gbk', 'genbank'] },
                    { name: 'All Files', extensions: ['*'] },
                  ],
                });
                rememberApprovedDialogPaths(result);

                if (!result.canceled && result.filePaths.length > 0) {
                  circosWindow.webContents.send('circos-menu-action', 'import-genbank', result.filePaths[0]);
                }
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Export...',
          submenu: [
            {
              label: 'SVG Image',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'export-svg');
              },
            },
            {
              label: 'PNG Image',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'export-png');
              },
            },
            {
              label: 'PDF Document',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'export-pdf');
              },
            },
            { type: 'separator' },
            {
              label: 'Data (JSON)',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'export-data');
              },
            },
          ],
        },
        ...(process.platform !== 'darwin'
          ? [
              { type: 'separator' },
              {
                label: 'Exit',
                accelerator: 'Ctrl+Q',
                click: () => {
                  app.quit();
                },
              },
            ]
          : []),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'zoom-in');
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'zoom-out');
          },
        },
        {
          label: 'Fit to Window',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'fit-to-window');
          },
        },
        {
          label: 'Reset View',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'reset-view');
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Parameters Panel',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'toggle-parameters-panel');
          },
        },
        {
          label: 'Toggle Genes',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'toggle-genes');
          },
        },
        {
          label: 'Data Tracks',
          submenu: [
            {
              label: 'GC Content',
              accelerator: 'CmdOrCtrl+1',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'toggle-gc-content');
              },
            },
            {
              label: 'GC Skew',
              accelerator: 'CmdOrCtrl+2',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'toggle-gc-skew');
              },
            },
            {
              label: 'WIG Data',
              accelerator: 'CmdOrCtrl+3',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'toggle-wig-data');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Refresh',
          accelerator: 'F5',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'refresh');
          },
        },
      ],
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
              },
            },
            {
              label: 'Gene Type Distribution',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'gene-type-distribution');
              },
            },
            {
              label: 'Gene Expression Analysis',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'gene-expression-analysis');
              },
            },
          ],
        },
        {
          label: 'Sequence Analysis',
          submenu: [
            {
              label: 'GC Content Analysis',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'gc-content-analysis');
              },
            },
            {
              label: 'Sequence Complexity',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'sequence-complexity');
              },
            },
            {
              label: 'Repeat Analysis',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'repeat-analysis');
              },
            },
          ],
        },
        {
          label: 'Comparative Genomics',
          submenu: [
            {
              label: 'Synteny Analysis',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'synteny-analysis');
              },
            },
            {
              label: 'Ortholog Detection',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'ortholog-detection');
              },
            },
            {
              label: 'Evolutionary Analysis',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'evolutionary-analysis');
              },
            },
          ],
        },

        {
          label: 'Custom Annotations',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'custom-annotations');
          },
        },
      ],
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
              },
            },
            {
              label: 'Remove Track',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'remove-track');
              },
            },
            {
              label: 'Reorder Tracks',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'reorder-tracks');
              },
            },
            {
              label: 'Track Settings',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'track-settings');
              },
            },
          ],
        },
        {
          label: 'Gene Filtering',
          submenu: [
            {
              label: 'By Type',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'filter-by-type');
              },
            },
            {
              label: 'By Expression',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'filter-by-expression');
              },
            },
            {
              label: 'By Location',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'filter-by-location');
              },
            },
            {
              label: 'Custom Filter',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'custom-filter');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Data Validation',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'data-validation');
          },
        },
      ],
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
              },
            },
            {
              label: 'Track Heights',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'track-heights');
              },
            },
            {
              label: 'Font Settings',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'font-settings');
              },
            },
          ],
        },
        {
          label: 'Performance',
          submenu: [
            {
              label: 'Rendering Mode',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'rendering-mode');
              },
            },
            {
              label: 'Memory Usage',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'memory-usage');
              },
            },
            {
              label: 'Update Frequency',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'update-frequency');
              },
            },
          ],
        },
        {
          label: 'Advanced',
          submenu: [
            {
              label: 'Window Size',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'window-size');
              },
            },
            {
              label: 'Export Quality',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'export-quality');
              },
            },
            {
              label: 'Debug Mode',
              click: () => {
                circosWindow.webContents.send('circos-menu-action', 'debug-mode');
              },
            },
          ],
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'documentation');
          },
        },
        {
          label: 'Tutorials',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'tutorials');
          },
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+?',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'keyboard-shortcuts');
          },
        },
        { type: 'separator' },
        {
          label: 'About Circos Plotter',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'about');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            circosWindow.webContents.send('circos-menu-action', 'report-issue');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

function createToolWindowMenu(toolWindow, toolName) {
  const template = [
    // 添加 CodeXomics 品牌菜单项（仅在 macOS 上）
    ...(process.platform === 'darwin'
      ? [
          {
            label: 'CodeXomics',
            submenu: [
              {
                label: `About ${toolName}`,
                click: () => {
                  toolWindow.webContents.send('tool-menu-action', 'about', toolName);
                },
              },
              { type: 'separator' },
              {
                label: 'Preferences',
                accelerator: 'Cmd+,',
                click: () => {
                  toolWindow.webContents.send('tool-menu-action', 'preferences');
                },
              },
              { type: 'separator' },
              {
                label: `Hide ${APP_NAME}`,
                accelerator: 'Cmd+H',
                role: 'hide',
              },
              {
                label: 'Hide Others',
                accelerator: 'Cmd+Shift+H',
                role: 'hideothers',
              },
              {
                label: 'Show All',
                role: 'unhide',
              },
              { type: 'separator' },
              {
                label: `Quit ${APP_NAME}`,
                accelerator: 'Cmd+Q',
                click: () => {
                  app.quit();
                },
              },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Analysis',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'new-analysis');
          },
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
                { name: 'All Files', extensions: ['*'] },
              ],
            });
            rememberApprovedDialogPaths(result);

            if (!result.canceled && result.filePaths.length > 0) {
              toolWindow.webContents.send('tool-menu-action', 'open-file', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Save Results',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'save-results');
          },
        },
        {
          label: 'Export Data',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'export-data');
          },
        },
        { type: 'separator' },
        ...(process.platform !== 'darwin'
          ? [
              {
                label: 'Exit',
                accelerator: 'Ctrl+Q',
                click: () => {
                  app.quit();
                },
              },
            ]
          : [
              {
                label: 'Close Window',
                accelerator: 'Cmd+W',
                click: () => {
                  toolWindow.close();
                },
              },
            ]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'copy');
          },
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'paste');
          },
        },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'cut');
          },
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'select-all');
          },
        },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'find');
          },
        },
        {
          label: 'Find Next',
          accelerator: 'F3',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'find-next');
          },
        },
      ],
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
        ...(process.platform === 'darwin' ? [{ role: 'togglefullscreen' }] : [{ role: 'togglefullscreen' }]),
        { type: 'separator' },
        {
          label: 'Refresh Data',
          accelerator: 'F5',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'refresh-data');
          },
        },
        {
          label: 'Clear Results',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'clear-results');
          },
        },
      ],
    },
    {
      label: 'Analysis',
      submenu: [
        {
          label: 'Run Analysis',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'run-analysis');
          },
        },
        {
          label: 'Stop Analysis',
          accelerator: 'Escape',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'stop-analysis');
          },
        },
        { type: 'separator' },
        {
          label: 'Load Sample Data',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'load-sample');
          },
        },
        {
          label: 'Reset Parameters',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'reset-parameters');
          },
        },
      ],
    },
    {
      label: 'Options',
      submenu: [
        ...(process.platform !== 'darwin'
          ? [
              {
                label: 'Preferences',
                accelerator: 'Ctrl+,',
                click: () => {
                  toolWindow.webContents.send('tool-menu-action', 'preferences');
                },
              },
              { type: 'separator' },
            ]
          : []),
        {
          label: 'Analysis Settings',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'analysis-settings');
          },
        },
        {
          label: 'Output Format',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'output-format');
          },
        },
        { type: 'separator' },
        {
          label: 'Advanced Options',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'advanced-options');
          },
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize',
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            toolWindow.close();
          },
        },
        { type: 'separator' },
        {
          label: 'Return to Main Window',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => {
            const targetWindow = (typeof getCurrentMainWindow === 'function' && getCurrentMainWindow()) || mainWindow;
            if (targetWindow) {
              targetWindow.focus();
            }
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        ...(process.platform !== 'darwin'
          ? [
              {
                label: `About ${toolName}`,
                click: () => {
                  toolWindow.webContents.send('tool-menu-action', 'about', toolName);
                },
              },
              { type: 'separator' },
            ]
          : []),
        {
          label: 'User Guide',
          accelerator: 'F1',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'user-guide');
          },
        },
        {
          label: 'Tool Documentation',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'documentation');
          },
        },
        {
          label: 'Online Resources',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'online-resources');
          },
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => {
            require('electron').shell.openExternal('https://github.com/Scilence2022/CodeXomics/issues');
          },
        },
        {
          label: 'Contact Support',
          click: () => {
            toolWindow.webContents.send('tool-menu-action', 'contact-support');
          },
        },
      ],
    },
  ];

  // 存储工具窗口的菜单模板
  toolMenuTemplates.set(toolWindow.id, { template, toolName });

  // 创建菜单（不立即设置为应用菜单，等窗口获得焦点时再设置）
  const menu = Menu.buildFromTemplate(template);

  // 设置窗口聚焦时切换菜单
  toolWindow.on('focus', () => {
    currentActiveWindow = toolWindow;
    Menu.setApplicationMenu(menu);
    console.log(`Switched to ${toolName} menu`);
  });

  // 窗口失焦时恢复主窗口菜单
  toolWindow.on('blur', () => {
    if (currentActiveWindow === toolWindow) {
      currentActiveWindow = null;
    }
    restoreMainMenuAfterToolWindow(toolName, 'blur');
  });

  // 当窗口关闭时清理
  toolWindow.on('closed', () => {
    toolMenuTemplates.delete(toolWindow.id);
    if (currentActiveWindow === toolWindow) {
      currentActiveWindow = null;
    }
    restoreMainMenuAfterToolWindow(toolName, 'close');
  });

  // 如果这是当前活动窗口，立即设置菜单
  if (toolWindow.isFocused()) {
    currentActiveWindow = toolWindow;
    Menu.setApplicationMenu(menu);
    console.log(`Initial menu set for ${toolName}`);
  }
}

function createMenu() {
  const template = [
    // 添加 CodeXomics 品牌菜单项（仅在 macOS 上）
    ...(process.platform === 'darwin'
      ? [
          {
            label: 'CodeXomics',
            submenu: [
              {
                label: 'About CodeXomics',
                click: () => {
                  sendToCurrentMainWindow('show-about');
                },
              },
              { type: 'separator' },
              {
                label: 'Preferences',
                accelerator: 'Cmd+,',
                click: () => {
                  sendToCurrentMainWindow('general-settings');
                },
              },
              { type: 'separator' },
              {
                label: 'Hide CodeXomics',
                accelerator: 'Cmd+H',
                role: 'hide',
              },
              {
                label: 'Hide Others',
                accelerator: 'Cmd+Shift+H',
                role: 'hideothers',
              },
              {
                label: 'Show All',
                role: 'unhide',
              },
              { type: 'separator' },
              {
                label: 'Quit CodeXomics',
                accelerator: 'Cmd+Q',
                click: () => {
                  app.quit();
                },
              },
            ],
          },
        ]
      : []),
    {
      label: 'Project',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // Create Project Manager window and trigger new project creation
            createProjectManagerWindow();
            // Send event to trigger new project modal after window is ready
            setTimeout(() => {
              const projectManagerWindow = BrowserWindow.getAllWindows().find(win =>
                win.getTitle().includes('Project Manager')
              );
              if (projectManagerWindow && !projectManagerWindow.isDestroyed()) {
                projectManagerWindow.webContents.send('create-new-project');
              }
            }, 500);
          },
        },
        {
          label: 'Open File',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(
              workspaceHostManager.getNativeWindow(
                (typeof getCurrentMainWindow === 'function' && getCurrentMainWindow()) || mainWindow
              ),
              {
                properties: ['openFile'],
                filters: [
                  {
                    name: 'All Genome Files',
                    extensions: ['fasta', 'fa', 'gb', 'gbk', 'genbank', 'gff', 'gtf', 'bed', 'vcf', 'bam', 'sam'],
                  },
                  { name: 'FASTA Files', extensions: ['fasta', 'fa'] },
                  { name: 'GenBank Files', extensions: ['gb', 'gbk', 'genbank'] },
                  { name: 'Annotation Files', extensions: ['gff', 'gtf', 'bed'] },
                  { name: 'Variant Files', extensions: ['vcf'] },
                  { name: 'Alignment Files', extensions: ['bam', 'sam'] },
                  { name: 'All Files', extensions: ['*'] },
                ],
              }
            );
            rememberApprovedDialogPaths(result);

            if (!result.canceled && result.filePaths.length > 0) {
              sendToCurrentMainWindow('file-opened', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Project Manager',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            createProjectManagerWindow();
          },
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
                  { name: 'All Files', extensions: ['*'] },
                ],
                title: 'Open Project',
              });
              rememberApprovedDialogPaths(result);

              if (!result.canceled && result.filePaths.length > 0) {
                // Send the file path to the Project Manager window
                const projectManagerWindow = BrowserWindow.getAllWindows().find(win =>
                  win.getTitle().includes('Project Manager')
                );
                if (projectManagerWindow && !projectManagerWindow.isDestroyed()) {
                  projectManagerWindow.webContents.send('load-project-from-menu', result.filePaths[0]);
                }
              }
            }, 100);
          },
        },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            sendToCurrentMainWindow('save-current-project');
          },
        },
        {
          label: 'Save Project As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            sendToCurrentMainWindow('save-project-as');
          },
        },
        { type: 'separator' },
        {
          label: 'Recent Projects',
          id: 'recent-projects',
          submenu: [
            {
              label: 'No recent projects',
              enabled: false,
            },
          ],
        },
        ...(process.platform !== 'darwin'
          ? [
              { type: 'separator' },
              {
                label: 'Exit',
                accelerator: 'Ctrl+Q',
                click: () => {
                  app.quit();
                },
              },
            ]
          : []),
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          click: () => {
            createWindow();
          },
        },
        {
          label: 'Open (New Window)',
          click: async () => {
            const parentWindow = workspaceHostManager.getNativeWindow(getCurrentMainWindow() || mainWindow);
            const result = await dialog.showOpenDialog(parentWindow, {
              properties: ['openFile'],
              filters: genomeFileDialogFilters,
            });
            rememberApprovedDialogPaths(result);

            if (!result.canceled && result.filePaths.length > 0) {
              openFileInNewMainWindow(result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Load File',
          submenu: [
            {
              label: 'Genome File...',
              click: () => {
                sendToCurrentMainWindow('menu-load-genome');
              },
            },
            {
              label: 'Annotation (Merge)...',
              click: () => {
                sendToCurrentMainWindow('menu-load-annotation-merge');
              },
            },
            {
              label: 'Annotation (New Track)...',
              click: () => {
                sendToCurrentMainWindow('menu-load-annotation-new');
              },
            },
            {
              label: 'Variant File...',
              click: () => {
                sendToCurrentMainWindow('menu-load-variant');
              },
            },
            {
              label: 'Reads File...',
              click: () => {
                sendToCurrentMainWindow('menu-load-reads');
              },
            },
            {
              label: 'WIG/BigWig Tracks...',
              click: () => {
                sendToCurrentMainWindow('menu-load-wig');
              },
            },
            {
              label: 'Operon File...',
              click: () => {
                sendToCurrentMainWindow('menu-load-operon');
              },
            },
            {
              label: 'Blast Results...',
              click: () => {
                sendToCurrentMainWindow('menu-load-blast');
              },
            },
            { type: 'separator' },
            {
              label: 'Any Supported File...',
              click: () => {
                sendToCurrentMainWindow('menu-load-any');
              },
            },
          ],
        },
        {
          label: 'Export As',
          submenu: [
            {
              label: 'FASTA Sequence...',
              click: () => {
                sendToCurrentMainWindow('menu-export-fasta');
              },
            },
            {
              label: 'GenBank Format...',
              click: () => {
                sendToCurrentMainWindow('menu-export-genbank');
              },
            },
            { type: 'separator' },
            {
              label: 'CDS FASTA...',
              click: () => {
                sendToCurrentMainWindow('menu-export-cds');
              },
            },
            {
              label: 'Protein FASTA...',
              click: () => {
                sendToCurrentMainWindow('menu-export-protein');
              },
            },
            { type: 'separator' },
            {
              label: 'GFF Annotations...',
              click: () => {
                sendToCurrentMainWindow('menu-export-gff');
              },
            },
            {
              label: 'BED Format...',
              click: () => {
                sendToCurrentMainWindow('menu-export-bed');
              },
            },
            { type: 'separator' },
            {
              label: 'Current View (FASTA)...',
              click: () => {
                sendToCurrentMainWindow('menu-export-current-view');
              },
            },
            { type: 'separator' },
            {
              label: 'Configure Export...',
              click: () => {
                sendToCurrentMainWindow('menu-export-configure');
              },
            },
          ],
        },
      ],
    },
    {
      label: 'Search && Edit',
      submenu: [
        {
          label: 'Search Sequence',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            sendToCurrentMainWindow('show-search');
          },
        },
        {
          label: 'Go to Position',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            sendToCurrentMainWindow('show-goto');
          },
        },
        { type: 'separator' },
        {
          label: 'Configure Search',
          click: () => {
            sendToCurrentMainWindow('configure-search');
          },
        },
        { type: 'separator' },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            sendToCurrentMainWindow('menu-copy');
          },
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            sendToCurrentMainWindow('menu-paste');
          },
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            sendToCurrentMainWindow('menu-select-all');
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: toggleCurrentGenomeDevTools,
        },
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
          },
        },
        {
          label: 'Show Navigation',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            sendToCurrentMainWindow('show-panel', 'navigationSection');
          },
        },
        {
          label: 'Show Statistics',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            sendToCurrentMainWindow('show-panel', 'statisticsSection');
          },
        },
        {
          label: 'Show All Panels',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            sendToCurrentMainWindow('show-all-panels');
          },
        },
        { type: 'separator' },
        {
          label: 'Show Tracks Panel',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            sendToCurrentMainWindow('show-panel', 'tracksSection');
          },
        },
        {
          label: 'Show Features Panel',
          accelerator: 'CmdOrCtrl+5',
          click: () => {
            sendToCurrentMainWindow('show-panel', 'featuresSection');
          },
        },
        { type: 'separator' },
        {
          label: 'Resource Manager',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            sendToCurrentMainWindow('open-resource-manager');
          },
        },
      ],
    },
    {
      label: 'Action',
      submenu: [
        {
          label: 'Copy Sequence',
          click: () => {
            sendToCurrentMainWindow('action-copy-sequence');
          },
        },
        {
          label: 'Copy Reverse-Complement Sequence',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            sendToCurrentMainWindow('action-copy-reverse-complement-sequence');
          },
        },
        {
          label: 'Cut Sequence',
          accelerator: 'CmdOrCtrl+Shift+X',
          click: () => {
            sendToCurrentMainWindow('action-cut-sequence');
          },
        },
        {
          label: 'Paste Sequence',
          accelerator: 'CmdOrCtrl+Shift+V',
          click: () => {
            sendToCurrentMainWindow('action-paste-sequence');
          },
        },
        {
          label: 'Paste (Reverse)',
          click: () => {
            sendToCurrentMainWindow('action-paste-sequence-reverse');
          },
        },
        {
          label: 'Del Sequence',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            sendToCurrentMainWindow('action-delete-sequence');
          },
        },
        {
          label: 'Insert Sequence',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            sendToCurrentMainWindow('action-insert-sequence');
          },
        },
        {
          label: 'Insert (Reverse)',
          click: () => {
            sendToCurrentMainWindow('action-insert-sequence-reverse');
          },
        },
        { type: 'separator' },
        {
          label: 'Show Action List',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => {
            sendToCurrentMainWindow('show-action-list');
          },
        },
        {
          label: 'Execute All Actions',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            sendToCurrentMainWindow('execute-all-actions');
          },
        },
        { type: 'separator' },
        {
          label: 'Create Checkpoint',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            sendToCurrentMainWindow('create-checkpoint');
          },
        },
        {
          label: 'Rollback to Checkpoint',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            sendToCurrentMainWindow('rollback-checkpoint');
          },
        },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Circos Genome Plotter',
          accelerator: 'CmdOrCtrl+Alt+C',
          click: () => {
            createCircosWindow();
          },
        },

        { type: 'separator' },
        {
          label: 'Restriction Enzymes',
          submenu: [
            {
              label: 'Enzyme Browser',
              click: () => {
                sendToCurrentMainWindow('open-enzyme-browser');
              },
            },
          ],
        },
        {
          label: 'DNA Markers / Ladders',
          submenu: [
            {
              label: 'Marker Browser',
              click: () => {
                sendToCurrentMainWindow('open-dna-marker-browser');
              },
            },
          ],
        },

        { type: 'separator' },
        {
          label: 'KEGG Pathway Enrichment Analysis',
          accelerator: 'CmdOrCtrl+Shift+K',
          enabled: false,
          click: () => {
            createKEGGWindow();
          },
        },
        {
          label: 'Gene Ontology (GO) Analyzer',
          accelerator: 'CmdOrCtrl+Alt+G',
          enabled: false,
          click: () => {
            createGOWindow();
          },
        },
        {
          label: 'InterPro Domain Analysis',
          accelerator: 'CmdOrCtrl+Shift+I',
          enabled: false,
          click: () => {
            createInterProWindow();
          },
        },
        { type: 'separator' },
        {
          label: 'Deep Gene Research',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: async () => {
            await createDeepGeneResearchWindow();
          },
        },
        {
          label: 'CHOPCHOP CRISPR Toolbox',
          accelerator: 'CmdOrCtrl+Alt+H',
          click: async () => {
            await createChopchopWindow();
          },
        },
        {
          label: 'ProGenFixer',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: async () => {
            await createProGenFixerWindow();
          },
        },
        {
          label: 'Download BLAST+ Tools',
          accelerator: 'CmdOrCtrl+Alt+B',
          click: () => {
            createBlastDownloaderWindow();
          },
        },
        {
          label: 'Configure BLAST Tools',
          click: () => {
            createBlastConfigWindow();
          },
        },
        // Add custom external tools dynamically
        ...(getCustomExternalToolsMenuItems ? getCustomExternalToolsMenuItems() : []),
        { type: 'separator' },
        {
          label: 'Configure External Tools',
          accelerator: 'CmdOrCtrl+Alt+T',
          click: () => {
            sendToCurrentMainWindow('configure-external-tools');
          },
        },
        { type: 'separator' },
        {
          label: 'CodeXomics MCP Server Manager',
          accelerator: 'CmdOrCtrl+Alt+M',
          click: () => {
            createMCPServerManagerWindow();
          },
        },
        { type: 'separator' },
        {
          label: 'External MCP Servers',
          click: () => {
            sendToCurrentMainWindow('mcp-settings');
          },
        },
      ],
    },
    {
      label: 'Options',
      submenu: [
        {
          label: 'Configure LLMs',
          click: () => {
            sendToCurrentMainWindow('configure-llms');
          },
        },
        { type: 'separator' },
        {
          label: 'ChatBox Settings',
          click: () => {
            sendToCurrentMainWindow('chatbox-settings');
          },
        },
        {
          label: 'Multi-Agent Settings',
          click: () => {
            sendToCurrentMainWindow('multi-agent-settings');
          },
        },
        { type: 'separator' },
        {
          label: 'External MCP Servers',
          click: () => {
            sendToCurrentMainWindow('mcp-settings');
          },
        },
        { type: 'separator' },
        {
          label: 'General Settings',
          click: () => {
            sendToCurrentMainWindow('general-settings');
          },
        },
      ],
    },
    {
      label: 'Plugins',
      submenu: [
        {
          label: 'Plugin Management',
          accelerator: 'CmdOrCtrl+Alt+P',
          click: () => {
            sendToCurrentMainWindow('show-plugin-management');
          },
        },
        {
          label: 'Plugin Marketplace',
          click: () => {
            sendToCurrentMainWindow('show-plugin-marketplace');
          },
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize',
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.close();
            }
          },
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
              },
            },
            {
              label: 'Side by Side (50% + 50%)',
              accelerator: 'CmdOrCtrl+Alt+S',
              click: () => {
                arrangeWindowsSideBySide();
              },
            },
            {
              label: 'Main Window Focus',
              accelerator: 'CmdOrCtrl+Alt+M',
              click: () => {
                arrangeMainWindowFocus();
              },
            },
            {
              label: 'Project Manager Focus',
              accelerator: 'CmdOrCtrl+Alt+P',
              click: () => {
                arrangeProjectManagerFocus();
              },
            },
            { type: 'separator' },
            {
              label: 'Stack Vertically',
              click: () => {
                arrangeWindowsVertical();
              },
            },
            {
              label: 'Cascade Windows',
              click: () => {
                arrangeWindowsCascade();
              },
            },
            { type: 'separator' },
            {
              label: 'Reset to Default Positions',
              click: () => {
                resetWindowPositions();
              },
            },
          ],
        },
        ...(process.platform === 'darwin'
          ? [
              { type: 'separator' },
              {
                label: 'Bring All to Front',
                role: 'front',
              },
            ]
          : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        ...(process.platform !== 'darwin'
          ? [
              {
                label: `About ${APP_NAME}`,
                click: () => {
                  const currentWindow = getCurrentMainWindow();
                  dialog.showMessageBox(currentWindow || null, {
                    type: 'info',
                    title: `About ${APP_NAME}`,
                    message: VERSION_INFO.appTitle,
                    detail: 'A modern AI-powered genome analysis studio built with Electron',
                  });
                },
              },
              { type: 'separator' },
            ]
          : []),
        {
          label: 'User Guide',
          accelerator: 'F1',
          click: () => {
            sendToCurrentMainWindow('show-user-guide');
          },
        },
        {
          label: 'Documentation',
          click: () => {
            require('electron').shell.openExternal('https://scilence2022.github.io/CodeXomics/');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            require('electron').shell.openExternal('https://github.com/Scilence2022/CodeXomics/issues');
          },
        },
        { type: 'separator' },
        {
          label: 'Check for Updates…',
          click: () => {
            require('./updater').checkForUpdates();
          },
        },
      ],
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
              buttons: ['OK'],
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Services',
          role: 'services',
          submenu: [],
        },
        { type: 'separator' },
        {
          label: `Hide ${APP_NAME}`,
          accelerator: 'Command+H',
          role: 'hide',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideothers',
        },
        {
          label: 'Show All',
          role: 'unhide',
        },
        { type: 'separator' },
        {
          label: `Quit ${APP_NAME}`,
          accelerator: 'Command+Q',
          click: () => app.quit(),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Create specialized menu for Deep Gene Research window
function createDeepGeneResearchMenu(deepGeneResearchWindow) {
  const template = [
    // macOS app menu
    ...(process.platform === 'darwin'
      ? [
          {
            label: 'CodeXomics',
            submenu: [
              {
                label: 'About Deep Gene Research',
                click: () => {
                  deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'about');
                },
              },
              { type: 'separator' },
              {
                label: 'Preferences',
                accelerator: 'Cmd+,',
                click: () => {
                  deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'preferences');
                },
              },
              { type: 'separator' },
              {
                label: `Hide ${APP_NAME}`,
                accelerator: 'Cmd+H',
                role: 'hide',
              },
              {
                label: 'Hide Others',
                accelerator: 'Cmd+Shift+H',
                role: 'hideothers',
              },
              {
                label: 'Show All',
                role: 'unhide',
              },
              { type: 'separator' },
              {
                label: `Quit ${APP_NAME}`,
                accelerator: 'Cmd+Q',
                click: () => {
                  app.quit();
                },
              },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Analysis',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'new-analysis');
          },
        },
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'open');
          },
        },
        { type: 'separator' },
        {
          label: 'Save Results',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'save-results');
          },
        },
        {
          label: 'Export Data',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'export-data');
          },
        },
        { type: 'separator' },
        ...(process.platform !== 'darwin'
          ? [
              {
                label: 'Exit',
                accelerator: 'Ctrl+Q',
                click: () => {
                  app.quit();
                },
              },
            ]
          : [
              {
                label: 'Close Window',
                accelerator: 'Cmd+W',
                click: () => {
                  deepGeneResearchWindow.close();
                },
              },
            ]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'copy');
          },
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'paste');
          },
        },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'cut');
          },
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'select-all');
          },
        },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'find');
          },
        },
        {
          label: 'Find Next',
          accelerator: 'F3',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'find-next');
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'reload');
          },
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'force-reload');
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'toggle-dev-tools');
          },
        },
        { type: 'separator' },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'reset-zoom');
          },
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'zoom-in');
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'zoom-out');
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'toggle-fullscreen');
          },
        },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Back to Main Window',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => {
            const targetWindow = (typeof getCurrentMainWindow === 'function' && getCurrentMainWindow()) || mainWindow;
            if (targetWindow && !targetWindow.isDestroyed()) {
              targetWindow.focus();
              targetWindow.show();
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Refresh Page',
          accelerator: 'F5',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'reload');
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        ...(process.platform !== 'darwin'
          ? [
              {
                label: 'About Deep Gene Research',
                click: () => {
                  deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'about');
                },
              },
              { type: 'separator' },
            ]
          : []),
        {
          label: 'User Guide',
          accelerator: 'F1',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'user-guide');
          },
        },
        {
          label: 'Tool Documentation',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'documentation');
          },
        },
        {
          label: 'Online Resources',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'online-resources');
          },
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => {
            require('electron').shell.openExternal('https://github.com/Scilence2022/CodeXomics/issues');
          },
        },
        {
          label: 'Contact Support',
          click: () => {
            deepGeneResearchWindow.webContents.send('deep-gene-research-menu-action', 'contact-support');
          },
        },
      ],
    },
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
          },
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
                { name: 'All Files', extensions: ['*'] },
              ],
              title: 'Open Project',
            });
            rememberApprovedDialogPaths(result);

            if (!result.canceled && result.filePaths.length > 0) {
              projectManagerWindow.webContents.send('menu-open-project', result.filePaths[0]);
            }
          },
        },
        {
          label: 'Open Recent',
          submenu: [
            {
              label: 'No Recent Projects',
              enabled: false,
            },
            // Recent projects will be dynamically populated
          ],
        },
        { type: 'separator' },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            projectManagerWindow.webContents.send('menu-save-project');
          },
        },
        {
          label: 'Save Project As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            projectManagerWindow.webContents.send('menu-save-project-as');
          },
        },
        {
          label: 'Export Project',
          submenu: [
            {
              label: 'Export as XML',
              click: () => {
                projectManagerWindow.webContents.send('menu-export-xml');
              },
            },
            {
              label: 'Export as JSON',
              click: () => {
                projectManagerWindow.webContents.send('menu-export-json');
              },
            },
            {
              label: 'Export Project Archive',
              click: () => {
                projectManagerWindow.webContents.send('menu-export-archive');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Import Files...',
          accelerator: 'CmdOrCtrl+I',
          click: async () => {
            const result = await dialog.showOpenDialog(projectManagerWindow, {
              properties: ['openFile', 'multiSelections'],
              filters: [
                {
                  name: 'Genome Files',
                  extensions: [
                    'fasta',
                    'fa',
                    'fas',
                    'gff',
                    'gff3',
                    'gtf',
                    'vcf',
                    'bam',
                    'sam',
                    'wig',
                    'bw',
                    'bigwig',
                    'bed',
                    'gb',
                    'gbk',
                    'gbff',
                  ],
                },
                { name: 'All Files', extensions: ['*'] },
              ],
              title: 'Import Files to Project',
            });
            rememberApprovedDialogPaths(result);

            if (!result.canceled && result.filePaths.length > 0) {
              projectManagerWindow.webContents.send('menu-import-files', result.filePaths);
            }
          },
        },
        {
          label: 'Import Project...',
          click: async () => {
            const result = await dialog.showOpenDialog(projectManagerWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Project Files', extensions: ['prj.GAI', 'xml', 'json', 'genomeproj'] },
                { name: 'All Files', extensions: ['*'] },
              ],
              title: 'Import Project',
            });
            rememberApprovedDialogPaths(result);

            if (!result.canceled && result.filePaths.length > 0) {
              projectManagerWindow.webContents.send('menu-import-project', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Close Project',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            projectManagerWindow.webContents.send('menu-close-project');
          },
        },
        {
          label: 'Close Window',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+W' : 'Ctrl+Shift+W',
          click: () => {
            projectManagerWindow.close();
          },
        },
      ],
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
          },
        },
        {
          label: 'Find and Replace...',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            projectManagerWindow.webContents.send('menu-find-replace');
          },
        },
        { type: 'separator' },
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            projectManagerWindow.webContents.send('menu-undo');
          },
        },
        {
          label: 'Redo',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+Z' : 'Ctrl+Y',
          click: () => {
            projectManagerWindow.webContents.send('menu-redo');
          },
        },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => {
            projectManagerWindow.webContents.send('menu-cut');
          },
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            projectManagerWindow.webContents.send('menu-copy');
          },
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            projectManagerWindow.webContents.send('menu-paste');
          },
        },
        { type: 'separator' },
        {
          label: 'Select All Files',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            projectManagerWindow.webContents.send('menu-select-all');
          },
        },
        {
          label: 'Clear Selection',
          accelerator: 'Escape',
          click: () => {
            projectManagerWindow.webContents.send('menu-clear-selection');
          },
        },
      ],
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
          },
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
              },
            },
            {
              label: 'List View',
              type: 'radio',
              click: () => {
                projectManagerWindow.webContents.send('menu-view-mode', 'list');
              },
            },
            {
              label: 'Details View',
              type: 'radio',
              click: () => {
                projectManagerWindow.webContents.send('menu-view-mode', 'details');
              },
            },
          ],
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
              },
            },
            {
              label: 'Date Modified',
              type: 'radio',
              click: () => {
                projectManagerWindow.webContents.send('menu-sort-by', 'modified');
              },
            },
            {
              label: 'Size',
              type: 'radio',
              click: () => {
                projectManagerWindow.webContents.send('menu-sort-by', 'size');
              },
            },
            {
              label: 'Type',
              type: 'radio',
              click: () => {
                projectManagerWindow.webContents.send('menu-sort-by', 'type');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Show Hidden Files',
          type: 'checkbox',
          click: menuItem => {
            projectManagerWindow.webContents.send('menu-toggle-hidden-files', menuItem.checked);
          },
        },
        {
          label: 'Show File Extensions',
          type: 'checkbox',
          checked: true,
          click: menuItem => {
            projectManagerWindow.webContents.send('menu-toggle-file-extensions', menuItem.checked);
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Sidebar',
          accelerator: 'F8',
          click: () => {
            projectManagerWindow.webContents.send('menu-toggle-sidebar');
          },
        },
        {
          label: 'Toggle Details Panel',
          accelerator: 'F9',
          click: () => {
            projectManagerWindow.webContents.send('menu-toggle-details-panel');
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          click: () => {
            const isFullScreen = projectManagerWindow.isFullScreen();
            projectManagerWindow.setFullScreen(!isFullScreen);
          },
        },
        { type: 'separator' },
        {
          label: 'Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Cmd+Alt+I' : 'Ctrl+Shift+I',
          click: () => {
            projectManagerWindow.webContents.toggleDevTools();
          },
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            projectManagerWindow.webContents.reload();
          },
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            projectManagerWindow.webContents.reloadIgnoringCache();
          },
        },
      ],
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
          },
        },
        {
          label: 'Project Statistics',
          click: () => {
            projectManagerWindow.webContents.send('menu-project-statistics');
          },
        },
        { type: 'separator' },
        {
          label: 'Create Folder',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            projectManagerWindow.webContents.send('menu-create-folder');
          },
        },
        {
          label: 'Organize Files',
          submenu: [
            {
              label: 'Auto-organize by Type',
              click: () => {
                projectManagerWindow.webContents.send('menu-auto-organize');
              },
            },
            {
              label: 'Group by Date',
              click: () => {
                projectManagerWindow.webContents.send('menu-group-by-date');
              },
            },
            {
              label: 'Clean Empty Folders',
              click: () => {
                projectManagerWindow.webContents.send('menu-clean-empty-folders');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Backup Project',
          click: () => {
            projectManagerWindow.webContents.send('menu-backup-project');
          },
        },
        {
          label: 'Restore from Backup',
          click: () => {
            projectManagerWindow.webContents.send('menu-restore-backup');
          },
        },
        { type: 'separator' },
        {
          label: 'Archive Project',
          click: () => {
            projectManagerWindow.webContents.send('menu-archive-project');
          },
        },
        {
          label: 'Delete Project',
          click: () => {
            projectManagerWindow.webContents.send('menu-delete-project');
          },
        },
      ],
    },

    // Tools Menu
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Validate Files',
          click: () => {
            projectManagerWindow.webContents.send('menu-validate-files');
          },
        },
        {
          label: 'Find Duplicates',
          click: () => {
            projectManagerWindow.webContents.send('menu-find-duplicates');
          },
        },
        {
          label: 'Check File Integrity',
          click: () => {
            projectManagerWindow.webContents.send('menu-check-integrity');
          },
        },
        { type: 'separator' },
        {
          label: 'Convert Files',
          submenu: [
            {
              label: 'FASTA to GenBank',
              click: () => {
                projectManagerWindow.webContents.send('menu-convert-fasta-genbank');
              },
            },
            {
              label: 'GFF to BED',
              click: () => {
                projectManagerWindow.webContents.send('menu-convert-gff-bed');
              },
            },
            {
              label: 'Custom Conversion...',
              click: () => {
                projectManagerWindow.webContents.send('menu-custom-conversion');
              },
            },
          ],
        },
        {
          label: 'Batch Operations',
          submenu: [
            {
              label: 'Batch Rename',
              click: () => {
                projectManagerWindow.webContents.send('menu-batch-rename');
              },
            },
            {
              label: 'Batch Move',
              click: () => {
                projectManagerWindow.webContents.send('menu-batch-move');
              },
            },
            {
              label: 'Batch Delete',
              click: () => {
                projectManagerWindow.webContents.send('menu-batch-delete');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Download BLAST+ Tools',
          accelerator: 'CmdOrCtrl+Alt+B',
          click: () => {
            createBlastDownloaderWindow();
          },
        },
        {
          label: 'Configure BLAST Tools',
          click: () => {
            createBlastConfigWindow();
          },
        },
        { type: 'separator' },
        {
          label: 'External Tools',
          submenu: [
            {
              label: 'Open in Genome Viewer',
              click: () => {
                projectManagerWindow.webContents.send('menu-open-genome-viewer');
              },
            },
            {
              label: 'Open in External Editor',
              click: () => {
                projectManagerWindow.webContents.send('menu-open-external-editor');
              },
            },
            {
              label: 'Open in File Explorer',
              click: () => {
                projectManagerWindow.webContents.send('menu-open-file-explorer');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,',
          click: () => {
            projectManagerWindow.webContents.send('menu-preferences');
          },
        },
      ],
    },

    // Download Menu - copied from main window
    {
      label: '📥 Download',
      submenu: [
        {
          label: 'NCBI Databases',
          click: () => {
            createGenomicDownloadWindow('ncbi-unified');
          },
        },
        {
          label: 'EMBL-EBI Databases',
          click: () => {
            createGenomicDownloadWindow('embl-unified');
          },
        },
        {
          label: 'DDBJ Sequences',
          click: () => {
            createGenomicDownloadWindow('ddbj-sequences');
          },
        },
        {
          label: 'UniProt Proteins',
          click: () => {
            createGenomicDownloadWindow('uniprot-proteins');
          },
        },
        {
          label: 'KEGG Pathways',
          click: () => {
            createGenomicDownloadWindow('kegg-pathways');
          },
        },
        { type: 'separator' },
        {
          label: 'Bulk Download Manager',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            createGenomicDownloadWindow('bulk-manager');
          },
        },
      ],
    },

    // Window Menu - cloned from main window
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize',
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.close();
            }
          },
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
              },
            },
            {
              label: 'Side by Side (50% + 50%)',
              accelerator: 'CmdOrCtrl+Alt+S',
              click: () => {
                arrangeWindowsSideBySide();
              },
            },
            {
              label: 'Main Window Focus',
              accelerator: 'CmdOrCtrl+Alt+M',
              click: () => {
                arrangeMainWindowFocus();
              },
            },
            {
              label: 'Project Manager Focus',
              accelerator: 'CmdOrCtrl+Alt+P',
              click: () => {
                arrangeProjectManagerFocus();
              },
            },
            { type: 'separator' },
            {
              label: 'Stack Vertically',
              click: () => {
                arrangeWindowsVertical();
              },
            },
            {
              label: 'Cascade Windows',
              click: () => {
                arrangeWindowsCascade();
              },
            },
            { type: 'separator' },
            {
              label: 'Reset to Default Positions',
              click: () => {
                resetWindowPositions();
              },
            },
          ],
        },
        ...(process.platform === 'darwin'
          ? [
              { type: 'separator' },
              {
                label: 'Bring All to Front',
                role: 'front',
              },
            ]
          : []),
      ],
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
          },
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => {
            projectManagerWindow.webContents.send('menu-keyboard-shortcuts');
          },
        },
        {
          label: 'User Guide',
          click: () => {
            projectManagerWindow.webContents.send('menu-user-guide');
          },
        },
        { type: 'separator' },
        {
          label: 'File Format Support',
          click: () => {
            projectManagerWindow.webContents.send('menu-file-formats');
          },
        },
        {
          label: 'Best Practices',
          click: () => {
            projectManagerWindow.webContents.send('menu-best-practices');
          },
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => {
            projectManagerWindow.webContents.send('menu-report-issue');
          },
        },
        {
          label: 'Send Feedback',
          click: () => {
            projectManagerWindow.webContents.send('menu-send-feedback');
          },
        },
        { type: 'separator' },
        {
          label: 'About Project Manager',
          click: () => {
            projectManagerWindow.webContents.send('menu-about');
          },
        },
      ],
    },
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
          },
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'Cmd+,',
          click: () => {
            projectManagerWindow.webContents.send('menu-preferences');
          },
        },
        { type: 'separator' },
        {
          label: 'Hide Project Manager',
          accelerator: 'Cmd+H',
          role: 'hide',
        },
        {
          label: 'Hide Others',
          accelerator: 'Cmd+Alt+H',
          role: 'hideothers',
        },
        {
          label: 'Show All',
          role: 'unhide',
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Cmd+Q',
          click: () => {
            projectManagerWindow.close();
          },
        },
      ],
    });
  }

  return Menu.buildFromTemplate(template);
}

// Create specialized menu for MCP Server Manager window
function createMCPServerManagerMenu(mcpWindow) {
  const template = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: 'CodeXomics',
            submenu: [
              {
                label: 'About MCP Server Manager',
                click: () => {
                  mcpWindow.webContents.send('mcp-server-manager-menu-action', 'about');
                },
              },
              { type: 'separator' },
              {
                label: `Hide ${APP_NAME}`,
                accelerator: 'Cmd+H',
                role: 'hide',
              },
              {
                label: 'Hide Others',
                accelerator: 'Cmd+Shift+H',
                role: 'hideothers',
              },
              {
                label: 'Show All',
                role: 'unhide',
              },
              { type: 'separator' },
              {
                label: `Quit ${APP_NAME}`,
                accelerator: 'Cmd+Q',
                click: () => {
                  app.quit();
                },
              },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            mcpWindow.close();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            mcpWindow.webContents.send('mcp-server-manager-menu-action', 'copy');
          },
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            mcpWindow.webContents.send('mcp-server-manager-menu-action', 'paste');
          },
        },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => {
            mcpWindow.webContents.send('mcp-server-manager-menu-action', 'cut');
          },
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            mcpWindow.webContents.send('mcp-server-manager-menu-action', 'select-all');
          },
        },
      ],
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
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About MCP Server Manager',
          click: () => {
            mcpWindow.webContents.send('mcp-server-manager-menu-action', 'about');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

// Set all external dependencies at once
function setMenuDependencies(deps) {
  if (deps.APP_NAME !== undefined) APP_NAME = deps.APP_NAME;
  if (deps.VERSION_INFO !== undefined) VERSION_INFO = deps.VERSION_INFO;
  if (deps.mainWindow !== undefined) mainWindow = deps.mainWindow;
  if (deps.toolMenuTemplates !== undefined) toolMenuTemplates = deps.toolMenuTemplates;
  if (deps.currentActiveWindow !== undefined) currentActiveWindow = deps.currentActiveWindow;
  if (deps.sendToCurrentMainWindow !== undefined) sendToCurrentMainWindow = deps.sendToCurrentMainWindow;
  if (deps.getCurrentMainWindow !== undefined) getCurrentMainWindow = deps.getCurrentMainWindow;
  if (deps.createWindow !== undefined) createWindow = deps.createWindow;
  if (deps.createProjectManagerWindow !== undefined) createProjectManagerWindow = deps.createProjectManagerWindow;
  if (deps.createCircosWindow !== undefined) createCircosWindow = deps.createCircosWindow;
  if (deps.createKEGGWindow !== undefined) createKEGGWindow = deps.createKEGGWindow;
  if (deps.createGOWindow !== undefined) createGOWindow = deps.createGOWindow;
  if (deps.createInterProWindow !== undefined) createInterProWindow = deps.createInterProWindow;
  if (deps.createDeepGeneResearchWindow !== undefined) createDeepGeneResearchWindow = deps.createDeepGeneResearchWindow;
  if (deps.createChopchopWindow !== undefined) createChopchopWindow = deps.createChopchopWindow;
  if (deps.createProGenFixerWindow !== undefined) createProGenFixerWindow = deps.createProGenFixerWindow;
  if (deps.createBlastDownloaderWindow !== undefined) createBlastDownloaderWindow = deps.createBlastDownloaderWindow;
  if (deps.createBlastConfigWindow !== undefined) createBlastConfigWindow = deps.createBlastConfigWindow;
  if (deps.createMCPServerManagerWindow !== undefined) createMCPServerManagerWindow = deps.createMCPServerManagerWindow;
  if (deps.createGenomicDownloadWindow !== undefined) createGenomicDownloadWindow = deps.createGenomicDownloadWindow;
  if (deps.getCustomExternalToolsMenuItems !== undefined) {
    getCustomExternalToolsMenuItems = deps.getCustomExternalToolsMenuItems;
  }
  if (deps.arrangeWindowsOptimal !== undefined) arrangeWindowsOptimal = deps.arrangeWindowsOptimal;
  if (deps.arrangeWindowsSideBySide !== undefined) arrangeWindowsSideBySide = deps.arrangeWindowsSideBySide;
  if (deps.arrangeMainWindowFocus !== undefined) arrangeMainWindowFocus = deps.arrangeMainWindowFocus;
  if (deps.arrangeProjectManagerFocus !== undefined) arrangeProjectManagerFocus = deps.arrangeProjectManagerFocus;
  if (deps.arrangeWindowsVertical !== undefined) arrangeWindowsVertical = deps.arrangeWindowsVertical;
  if (deps.arrangeWindowsCascade !== undefined) arrangeWindowsCascade = deps.arrangeWindowsCascade;
  if (deps.resetWindowPositions !== undefined) resetWindowPositions = deps.resetWindowPositions;
}

module.exports = {
  createCircosPlotterMenu,
  createToolWindowMenu,
  createMenu,
  createDeepGeneResearchMenu,
  createProjectManagerMenu,
  createMCPServerManagerMenu,
  setMenuDependencies,
};
