const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Resource management APIs
  getLoadedResources: () => ipcRenderer.invoke('get-loaded-resources'),
  refreshResources: () => ipcRenderer.invoke('refresh-resources'),
  removeResource: (resourceId) => ipcRenderer.invoke('remove-resource', resourceId),
  exportResource: (resourceId, options) => ipcRenderer.invoke('export-resource', resourceId, options),
  openResourceInBrowser: (resourceId) => ipcRenderer.invoke('open-resource-in-browser', resourceId),
  
  // File operations
  selectAndLoadFile: () => ipcRenderer.invoke('select-and-load-file'),
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  
  // Project Manager APIs
  selectProjectDirectory: () => ipcRenderer.invoke('selectProjectDirectory'),
  selectProjectFile: () => ipcRenderer.invoke('selectProjectFile'),
  selectMultipleFiles: () => ipcRenderer.invoke('selectMultipleFiles'),
  createProjectDirectory: (location, projectName) => ipcRenderer.invoke('createProjectDirectory', location, projectName),
  loadProjectFile: (filePath) => ipcRenderer.invoke('loadProjectFile', filePath),
  openFileInMainWindow: (filePath) => ipcRenderer.invoke('openFileInMainWindow', filePath),
  openFolderInExplorer: (folderPath) => ipcRenderer.invoke('openFolderInExplorer', folderPath),
  moveFileInProject: (currentPath, projectName, targetFolderPath) => ipcRenderer.invoke('moveFileInProject', currentPath, projectName, targetFolderPath),
  
  // Project file locking APIs
  lockProjectFile: (filePath) => ipcRenderer.invoke('lockProjectFile', filePath),
  unlockProjectFile: (filePath, lockId) => ipcRenderer.invoke('unlockProjectFile', filePath, lockId),
  saveProjectsData: (projectsData) => ipcRenderer.invoke('saveProjectsData', projectsData),
  loadProjectsData: () => ipcRenderer.invoke('loadProjectsData'),
  saveProjectSettings: (settings) => ipcRenderer.invoke('saveProjectSettings', settings),
  loadProjectSettings: () => ipcRenderer.invoke('loadProjectSettings'),
  
  // Enhanced File Opening APIs
  checkMainWindowStatus: () => ipcRenderer.invoke('checkMainWindowStatus'),
  createNewMainWindow: (filePath) => ipcRenderer.invoke('createNewMainWindow', filePath),
  
  // File Save APIs
                  saveFile: (fileName, content) => ipcRenderer.invoke('saveFile', fileName, content),
        saveProjectFile: (fileName, content) => ipcRenderer.invoke('saveProjectFile', fileName, content),
    createTempFile: (fileName, content) => ipcRenderer.invoke('createTempFile', fileName, content),
    getFileInfo: (filePath) => ipcRenderer.invoke('getFileInfo', filePath),
    updateRecentProjects: (recentProjects) => ipcRenderer.invoke('updateRecentProjects', recentProjects),

      // File copying APIs
  copyFileToProject: (sourcePath, projectName, folderPath) => ipcRenderer.invoke('copyFileToProject', sourcePath, projectName, folderPath),
  
  // New project structure APIs
  createNewProjectStructure: (location, projectName) => ipcRenderer.invoke('createNewProjectStructure', location, projectName),
  saveProjectToSpecificFile: (filePath, content) => ipcRenderer.invoke('saveProjectToSpecificFile', filePath, content),
  saveProjectAs: (defaultProjectName) => ipcRenderer.invoke('saveProjectAs', defaultProjectName),
  checkProjectExists: (directory, projectName) => ipcRenderer.invoke('checkProjectExists', directory, projectName),
  copyProject: (sourceProjectFile, sourceDataFolder, targetDirectory, projectName) => ipcRenderer.invoke('copyProject', sourceProjectFile, sourceDataFolder, targetDirectory, projectName),
  
  // Communication with main window
  sendToMainWindow: (channel, data) => ipcRenderer.invoke('send-to-main-window', channel, data),
  
  // Window management
  closeWindow: () => ipcRenderer.send('close-resource-manager'),
  
  // Event listeners
  onResourceUpdate: (callback) => {
    ipcRenderer.on('resource-update', callback);
  },
  
  onResourceRemoved: (callback) => {
    ipcRenderer.on('resource-removed', callback);
  },
  
  onResourceAdded: (callback) => {
    ipcRenderer.on('resource-added', callback);
  },

  // Project Manager specific event listeners
  onCreateNewProject: (callback) => {
    ipcRenderer.on('create-new-project', callback);
  },
  
  onLoadProjectFromMenu: (callback) => {
    ipcRenderer.on('load-project-from-menu', callback);
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Genomic Data Download APIs
  selectDirectory: () => ipcRenderer.invoke('selectDirectory'),
  downloadFile: (url, outputPath, projectInfo) => ipcRenderer.invoke('downloadFile', url, outputPath, projectInfo),
  getCurrentProject: () => ipcRenderer.invoke('getCurrentProject'),
  setActiveProject: (projectInfo) => ipcRenderer.invoke('setActiveProject', projectInfo),
  
  // Event listeners for genomic downloader
  onSetDownloadType: (callback) => {
    ipcRenderer.on('set-download-type', (event, downloadType) => {
      callback(downloadType);
    });
  },
  
  onSetActiveProject: (callback) => {
    ipcRenderer.on('set-active-project', (event, projectInfo) => {
      callback(projectInfo);
    });
  },
  
  // Window close handling
  onBeforeWindowClose: (callback) => {
    ipcRenderer.on('before-window-close', callback);
  },
  
  // File reading API for project manager
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath)
});

// Provide access to node process information (for development)
contextBridge.exposeInMainWorld('nodeAPI', {
  platform: process.platform,
  version: process.version
});

console.log('Resource Manager preload script loaded'); 