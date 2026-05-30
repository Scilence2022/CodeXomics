// @ts-check
'use strict';

/**
 * Project Manager IPC Handlers Module for CodeXomics
 *
 * Contains all Project-Manager-related IPC handlers extracted from main.js.
 * This module exports a registerProjectIpcHandlers(deps) function.
 *
 * @module project-ipc
 */

const { ipcMain, dialog, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Register all Project Manager IPC handlers.
 *
 * @param {Object} deps - Dependencies object containing shared state and functions
 * @param {BrowserWindow} deps.mainWindow - Main BrowserWindow instance
 * @param {Map} deps.windowRegistry - Window registry for multi-window support
 * @param {Function} deps.createProjectManagerWindow - Create Project Manager window
 * @param {Function} deps.generateWindowId - Generate unique window ID
 * @param {Function} deps.registerGenomeWindow - Register a genome window
 * @param {Function} deps.unregisterGenomeWindow - Unregister a genome window
 * @param {Function} deps.cleanupWindowRegistration - Cleanup window registration
 * @param {BrowserWindow} deps.currentActiveWindow - Currently active window
 * @param {Function} deps.createMenu - Menu creation function
 * @param {Function} deps.createToolWindowMenu - Tool window menu creation
 * @param {Function} deps.getCurrentMainWindow - Get current main window reference
 */
function registerProjectIpcHandlers(deps) {
  const {
    mainWindow,
    windowRegistry,
    createProjectManagerWindow,
    generateWindowId,
    registerGenomeWindow,
    unregisterGenomeWindow,
    cleanupWindowRegistration,
    currentActiveWindow,
    createMenu,
    createToolWindowMenu,
    getCurrentMainWindow,
  } = deps;

  // Handler for showing project open dialog
  ipcMain.handle('show-project-open-dialog', async (event, projectName) => {
    try {
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Open in Current Window', 'Open in New Window', 'Cancel'],
        defaultId: 0,
        title: 'Open Project',
        message: `Open "${projectName}"?`,
        detail:
          `Choose how to open this project:\n\n` +
          `• Open in Current Window: Close current project and open new project here\n` +
          `• Open in New Window: Keep current project and open new project in a new application instance\n` +
          `• Cancel: Don't open the project`,
        noLink: true,
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
        stdio: 'ignore',
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
        title: 'Select Project Location',
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
          { name: 'All Files', extensions: ['*'] },
        ],
        title: 'Open Project File',
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
          { name: 'All Files', extensions: ['*'] },
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
        ],
        title: 'Select Files to Add',
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
          { name: 'All files', extensions: ['*'] },
        ],
        title: 'Select FASTA file for BLAST database',
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
      if (deps.mainWindow && !deps.mainWindow.isDestroyed()) {
        deps.mainWindow.webContents.send('load-file', filePath);
        deps.mainWindow.focus();
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
        message: 'File renamed successfully',
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
          error: 'File is already locked by another instance of CodeXomics',
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
          processId: process.pid,
        });

        console.log(`🔒 Project file locked: ${filePath} (ID: ${lockId})`);
        return { success: true, lockId: lockId };
      } catch (fileError) {
        if (fileError.code === 'EBUSY' || fileError.code === 'EACCES') {
          return {
            success: false,
            error: 'File is currently being used by another application',
          };
        }
        throw fileError;
      }
    } catch (error) {
      console.error('Error locking project file:', error);
      return {
        success: false,
        error: `Failed to lock file: ${error.message}`,
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
          error: 'Invalid lock ID',
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
        error: `Failed to unlock file: ${error.message}`,
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
    deps.createProjectManagerWindow();
  });

  // Handle checking main window status
  ipcMain.handle('checkMainWindowStatus', async () => {
    try {
      if (deps.mainWindow && !deps.mainWindow.isDestroyed()) {
        // Send request to main window to check if it has a file open
        return new Promise(resolve => {
          const timeout = setTimeout(() => {
            resolve({ hasOpenFile: false, error: 'Timeout' });
          }, 1000);

          deps.mainWindow.webContents.once('main-window-status-response', (event, hasOpenFile) => {
            clearTimeout(timeout);
            resolve({ hasOpenFile: hasOpenFile });
          });

          deps.mainWindow.webContents.send('check-file-status');
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
    let windowId = null;

    try {
      // Generate a unique window ID for multi-window support
      windowId = deps.generateWindowId();
      console.log(`📋 [createNewMainWindow] Creating new window with ID: ${windowId}`);

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

          allowRunningInsecureContent: true,
          cache: false,
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        show: false,
      });

      // Store windowId on the BrowserWindow object for easy lookup
      newMainWindow.windowId = windowId;

      // Register in window registry with skipResolve since we're handling async
      deps.registerGenomeWindow(windowId, newMainWindow, { skipResolve: true });
      console.log(`📋 [createNewMainWindow] Window ${windowId} registered in registry`);

      // Set up the new window with same initialization as original main window
      newMainWindow.loadFile(path.join(__dirname, '..', 'renderer/index.html'));

      // Clear cache aggressively to ensure fresh file loading (same as original)
      newMainWindow.webContents.session.clearCache();
      newMainWindow.webContents.session.clearStorageData();

      // Handle multiple reload cycles to ensure proper initialization
      let reloadCount = 0;
      const maxReloads = 1; // Only one reload cycle

      newMainWindow.webContents.on('did-finish-load', () => {
        if (reloadCount < maxReloads) {
          console.log(`📋 [createNewMainWindow] Reload cycle ${reloadCount + 1}/${maxReloads} for ${windowId}`);
          reloadCount++;
          newMainWindow.webContents.reload();
        } else {
          console.log(`📋 [createNewMainWindow] Window ${windowId} fully loaded, waiting for complete initialization`);
          // Window is fully loaded, wait for DOM and modules to be ready
          setTimeout(() => {
            console.log(`📋 [createNewMainWindow] Sending initialization events to ${windowId}`);
            // Send windowId to renderer process for MCPBridge identification
            newMainWindow.webContents.send('set-window-id', windowId);
            // Send a test message to verify the window is responsive
            newMainWindow.webContents.send('ping-test');

            // Wait a bit more and then send the file
            setTimeout(() => {
              console.log(`📋 [createNewMainWindow] Sending load-file event to ${windowId}: ${filePath}`);
              newMainWindow.webContents.send('load-file', filePath);
            }, 500);
          }, 1500); // Extended delay for complete module initialization
        }
      });

      // Show window when ready
      newMainWindow.once('ready-to-show', () => {
        console.log(`📋 [createNewMainWindow] Window ${windowId} ready to show`);
        newMainWindow.show();
        // Set focus to new window and ensure proper menu
        newMainWindow.focus();
        deps.currentActiveWindow = newMainWindow;
        deps.createMenu(); // Set main window menu immediately
        console.log(`📋 [createNewMainWindow] Window ${windowId} shown and focused with main menu set`);
      });

      // Open DevTools to debug UI issues (same as original main window)
      newMainWindow.webContents.openDevTools();

      // Handle window focus to manage menu properly
      newMainWindow.on('focus', () => {
        if (deps.currentActiveWindow !== newMainWindow) {
          deps.currentActiveWindow = newMainWindow;
          deps.createMenu(); // Set main window menu when focused
          console.log(`📋 [createNewMainWindow] Window ${windowId} focused - set main menu`);
        }
      });

      // Handle window closed - cleanup is handled automatically via the 'closed' event listener in registerGenomeWindow
      newMainWindow.on('closed', () => {
        console.log(`📋 [createNewMainWindow] Window ${windowId} closed`);
        deps.unregisterGenomeWindow(windowId);
        if (deps.currentActiveWindow === newMainWindow) {
          deps.currentActiveWindow = null;
        }
      });

      // Handle errors
      newMainWindow.webContents.on('crashed', (event, killed) => {
        console.error(`📋 [createNewMainWindow] Window ${windowId} crashed (killed: ${killed})`);
        deps.cleanupWindowRegistration(windowId);
      });

      newMainWindow.webContents.on('render-process-gone', (event, details) => {
        console.error(`📋 [createNewMainWindow] Window ${windowId} render process gone: ${details.reason}`);
        deps.cleanupWindowRegistration(windowId);
      });

      return { success: true, message: 'New window created with file', windowId };
    } catch (error) {
      console.error(`📋 [createNewMainWindow] Error creating window: ${error.message}`);
      if (windowId) {
        deps.cleanupWindowRegistration(windowId);
      }
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
          if (
            item.startsWith('.') ||
            item.startsWith('~') ||
            item.includes('.tmp') ||
            item.includes('.temp') ||
            item.endsWith('.prj.GAI') ||
            item.endsWith('.genomeproj')
          ) {
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
                  absolutePath: itemPath, // Keep absolute path for system operations
                });
              }

              // Recursively scan subdirectories
              scanDirectory(itemPath, relativeFilePath, newFolderPath);
            } else if (stats.isFile()) {
              // Process file
              const tempId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const projectRelativePath = getProjectRelativePath(itemPath, projectPath);

              // Check if this file path already exists (use relative path for comparison)
              const isDuplicate = existingFileIds.some(
                existingPath =>
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
                      size: stats.size,
                    },
                  },
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
          total: newFiles.length + newFolders.length,
        },
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
      genomes: '🧬',
      genome: '🧬',
      annotations: '📋',
      annotation: '📋',
      variants: '🔄',
      variant: '🔄',
      reads: '📊',
      read: '📊',
      analysis: '📈',
      analyses: '📈',
      results: '📈',
      output: '📤',
      outputs: '📤',
      input: '📥',
      inputs: '📥',
      data: '💾',
      database: '🗃️',
      databases: '🗃️',
      tools: '🔧',
      scripts: '📝',
      logs: '📄',
      temp: '🗂️',
      tmp: '🗂️',
      backup: '💾',
      archive: '📦',
      downloads: '⬇️',
      upload: '⬆️',
      uploads: '⬆️',
      config: '⚙️',
      configuration: '⚙️',
      settings: '⚙️',
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
      fasta: ['fasta', 'fa', 'fas'],
      gff: ['gff', 'gff3', 'gtf'],
      vcf: ['vcf'],
      bam: ['bam', 'sam'],
      wig: ['wig', 'bw', 'bigwig'],
      bed: ['bed'],
      genbank: ['gb', 'gbk', 'gbff'],
      fastq: ['fastq', 'fq'],
      txt: ['txt', 'text'],
      csv: ['csv'],
      tsv: ['tsv'],
      json: ['json'],
      xml: ['xml'],
      html: ['html', 'htm'],
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
          { name: 'All Files', extensions: ['*'] },
        ],
        title: 'Save Project File',
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
          { name: 'All Files', extensions: ['*'] },
        ],
        title: 'Save Project File',
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
      setTimeout(
        () => {
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
              console.log('Cleaned up temp file:', tempFilePath);
            }
          } catch (err) {
            console.error('Error cleaning up temp file:', err);
          }
        },
        5 * 60 * 1000
      );

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
          name: fileName,
        },
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
      recentProjectsMenuItem.submenu.append(
        new MenuItem({
          label: 'No recent projects',
          enabled: false,
        })
      );
    } else {
      // Add recent projects
      recentProjects.slice(0, 10).forEach((project, index) => {
        recentProjectsMenuItem.submenu.append(
          new MenuItem({
            label: `${project.name}`,
            accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : undefined,
            click: () => {
              if (deps.mainWindow && !deps.mainWindow.isDestroyed()) {
                deps.mainWindow.webContents.send('open-recent-project', project);
              }
            },
          })
        );
      });

      // Add separator and clear menu item
      recentProjectsMenuItem.submenu.append(new MenuItem({ type: 'separator' }));
      recentProjectsMenuItem.submenu.append(
        new MenuItem({
          label: 'Clear Recent Projects',
          click: () => {
            if (deps.mainWindow && !deps.mainWindow.isDestroyed()) {
              deps.mainWindow.webContents.send('clear-recent-projects');
            }
          },
        })
      );
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
        targetFolder: targetFolderDir,
      };
    } catch (error) {
      console.error('Error copying file to project:', error);
      return {
        success: false,
        error: error.message,
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
          error: `Project directory "${projectName}" already exists at this location`,
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
        projectDir: projectDir,
      };
    } catch (error) {
      console.error('❌ Error creating project structure:', error);
      return {
        success: false,
        error: error.message,
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
        error: error.message,
      };
    }
  });

  // Handle save project as (select directory)
  ipcMain.handle('saveProjectAs', async (event, defaultProjectName) => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog(null, {
        properties: ['openDirectory'],
        title: 'Select Directory to Save Project',
      });

      if (!result.canceled && result.filePaths.length > 0) {
        return {
          success: true,
          selectedDirectory: result.filePaths[0],
        };
      }

      return { success: false, canceled: true };
    } catch (error) {
      console.error('Error in save project as dialog:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Handle saving refined gene annotation
  ipcMain.handle('save-refined-annotation', async (event, data) => {
    try {
      const { gene, originalAnnotation, refinedAnnotation, timestamp } = data;

      console.log('Saving refined annotation for gene:', gene);

      // Get the main window to access the genome browser
      const mainWindow = deps.getCurrentMainWindow();
      if (!deps.mainWindow || !deps.mainWindow.webContents) {
        throw new Error('Main window not available');
      }

      // Send the refined annotation to the main window for saving
      const result = await deps.mainWindow.webContents.executeJavaScript(`
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
        error: error.message,
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
        isNewStructure: newFileExists,
      };
    } catch (error) {
      console.error('Error checking project exists:', error);
      return {
        exists: false,
        error: error.message,
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
        targetDataFolder: targetProjectDir,
      };
    } catch (error) {
      console.error('Error copying project:', error);
      return {
        success: false,
        error: error.message,
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
          preload: path.join(__dirname, '..', 'preload.js'),
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        title: `Download Genomic Data - ${downloadType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
        show: false,
      });

      // Set menu for the download window - fix the menu creation
      deps.createToolWindowMenu(downloadWindow, 'Genomic Data Download');

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
        title: 'Select Output Directory',
      });

      return {
        success: true,
        canceled: result.canceled,
        filePath: result.canceled ? null : result.filePaths[0],
      };
    } catch (error) {
      console.error('Error selecting directory:', error);
      return {
        success: false,
        error: error.message,
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
        if (
          baseName.includes('protein') ||
          baseName.includes('prot') ||
          baseName.includes('aa') ||
          extension === '.faa'
        ) {
          return 'proteins';
        } else if (
          baseName.includes('cds') ||
          baseName.includes('mrna') ||
          baseName.includes('transcript') ||
          extension === '.ffn'
        ) {
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
    return new Promise(resolve => {
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
            console.log(
              `📁 Intelligent categorization: ${fileName} -> ${category}/ (database: ${databaseType || 'auto-detected'})`
            );
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

        const request = client.get(url, response => {
          // 处理重定向
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            console.log(`Redirecting to: ${redirectUrl}`);

            // 递归处理重定向
            const redirectClient = redirectUrl.startsWith('https:') ? https : http;
            const redirectRequest = redirectClient.get(redirectUrl, redirectResponse => {
              if (redirectResponse.statusCode === 200) {
                redirectResponse.pipe(file);

                file.on('finish', () => {
                  file.close();
                  console.log(`✅ Downloaded: ${finalOutputPath}`);

                  // Enhanced project integration - notify about new file
                  if (projectInfo && projectInfo.dataFolderPath) {
                    // Send file addition notification to project manager
                    const allWindows = BrowserWindow.getAllWindows();
                    const projectManagerWindow = allWindows.find(
                      win =>
                        win.getTitle().includes('Project Manager') ||
                        win.webContents.getURL().includes('project-manager')
                    );

                    if (projectManagerWindow) {
                      const relativePath = path.relative(projectInfo.dataFolderPath, finalOutputPath);
                      const category = projectInfo.downloadContext
                        ? categorizeGenomicFile(finalOutputPath, url, projectInfo.downloadContext.database)
                        : categorizeGenomicFile(finalOutputPath, url, null);

                      projectManagerWindow.webContents.send('file-downloaded', {
                        filePath: finalOutputPath,
                        relativePath: relativePath,
                        category: category || 'uncategorized',
                        projectPath: projectInfo.dataFolderPath,
                        downloadContext: projectInfo.downloadContext || {},
                      });

                      console.log(`📢 Notified project manager about new file: ${relativePath} → ${category}/`);
                    }
                  }

                  resolve({
                    success: true,
                    filePath: finalOutputPath,
                    category: projectInfo
                      ? categorizeGenomicFile(
                          finalOutputPath,
                          url,
                          projectInfo.downloadContext ? projectInfo.downloadContext.database : null
                        )
                      : null,
                  });
                });
              } else {
                file.close();
                fs.unlinkSync(finalOutputPath); // 删除空文件
                resolve({
                  success: false,
                  error: `HTTP ${redirectResponse.statusCode}: ${redirectResponse.statusMessage}`,
                });
              }
            });

            redirectRequest.on('error', error => {
              file.close();
              fs.unlinkSync(finalOutputPath);
              resolve({
                success: false,
                error: error.message,
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
                const projectManagerWindow = allWindows.find(
                  win =>
                    win.getTitle().includes('Project Manager') || win.webContents.getURL().includes('project-manager')
                );

                if (projectManagerWindow) {
                  const relativePath = path.relative(projectInfo.dataFolderPath, finalOutputPath);
                  const category = projectInfo.downloadContext
                    ? categorizeGenomicFile(finalOutputPath, url, projectInfo.downloadContext.database)
                    : categorizeGenomicFile(finalOutputPath, url, null);

                  projectManagerWindow.webContents.send('file-downloaded', {
                    filePath: finalOutputPath,
                    relativePath: relativePath,
                    category: category || 'uncategorized',
                    projectPath: projectInfo.dataFolderPath,
                    downloadContext: projectInfo.downloadContext || {},
                  });

                  console.log(`📢 Notified project manager about new file: ${relativePath} → ${category}/`);
                }
              }

              resolve({
                success: true,
                filePath: finalOutputPath,
                category: projectInfo
                  ? categorizeGenomicFile(
                      finalOutputPath,
                      url,
                      projectInfo.downloadContext ? projectInfo.downloadContext.database : null
                    )
                  : null,
              });
            });
          } else {
            file.close();
            fs.unlinkSync(finalOutputPath); // 删除空文件
            resolve({
              success: false,
              error: `HTTP ${response.statusCode}: ${response.statusMessage}`,
            });
          }
        });

        request.on('error', error => {
          file.close();
          if (fs.existsSync(finalOutputPath)) {
            fs.unlinkSync(finalOutputPath);
          }
          resolve({
            success: false,
            error: error.message,
          });
        });

        file.on('error', error => {
          file.close();
          if (fs.existsSync(finalOutputPath)) {
            fs.unlinkSync(finalOutputPath);
          }
          resolve({
            success: false,
            error: error.message,
          });
        });
      } catch (error) {
        console.error('Download error:', error);
        resolve({
          success: false,
          error: error.message,
        });
      }
    });
  });
}

module.exports = { registerProjectIpcHandlers };
